import { Language, Parser as WebTreeSitterParser, type Node as TsNode } from "web-tree-sitter";
import type { CallSymbol, ClassSymbol, FileSymbols, ImportSymbol, MethodSymbol, Parser } from "./types";

export interface TypeScriptParserOptions {
  /** Caminho ou bytes da gramática TS (tree-sitter-typescript.wasm). */
  tsWasm: string | Uint8Array;
  /** Caminho ou bytes da gramática TSX (tree-sitter-tsx.wasm). */
  tsxWasm: string | Uint8Array;
  /**
   * URL explícita do web-tree-sitter.wasm (webview). Sem isso, o init tenta
   * localizar `tree-sitter.wasm` ao lado do bundle — falha no Vite/TAURI
   * (recebe o HTML do fallback). Node/testes usam o autodetect padrão.
   */
  treeSitterWasm?: string;
}

const FILE_EXT = /\.(ts|tsx|js|jsx)$/;
const TSX_EXT = /\.(tsx|jsx)$/;

let initPromise: Promise<void> | null = null;

/**
 * Factory do parser TS/JS. O web-tree-sitter é inicializado uma única vez;
 * chamadas repetidas reutilizam a mesma instância do parser.
 */
export async function createTypeScriptParser(
  options: TypeScriptParserOptions,
): Promise<Parser> {
  initPromise ??= WebTreeSitterParser.init(
    options.treeSitterWasm ? { locateFile: () => options.treeSitterWasm! } : undefined,
  );
  await initPromise;
  const [tsLang, tsxLang] = await Promise.all([
    Language.load(options.tsWasm),
    Language.load(options.tsxWasm),
  ]);
  return new TypeScriptParser(tsLang, tsxLang);
}

class TypeScriptParser implements Parser {
  private ts: WebTreeSitterParser;
  private tsx: WebTreeSitterParser;

  constructor(tsLang: Language, tsxLang: Language) {
    this.ts = new WebTreeSitterParser();
    this.ts.setLanguage(tsLang);
    this.tsx = new WebTreeSitterParser();
    this.tsx.setLanguage(tsxLang);
  }

  supports(file: string): boolean {
    return FILE_EXT.test(file);
  }

  parseFile(file: string, content: string): FileSymbols {
    const parser = TSX_EXT.test(file) ? this.tsx : this.ts;
    const tree = parser.parse(content);
    if (!tree) {
      return { file, classes: [], methods: [], imports: [], calls: [] };
    }
    return extractSymbols(file, tree.rootNode);
  }
}

function extractSymbols(file: string, root: TsNode): FileSymbols {
  const classes: ClassSymbol[] = [];
  const methods: MethodSymbol[] = [];
  const imports: ImportSymbol[] = [];
  const calls: CallSymbol[] = [];
  /** Ranges de métodos para atribuir cada chamada ao dono (mais interno). */
  const methodRanges: MethodSymbol[] = [];

  collect(root);

  for (const call of calls) {
    call.owner = findOwner(methodRanges, call.line);
  }

  return { file, classes, methods, imports, calls };

  function collect(node: TsNode): void {
    switch (node.type) {
      case "class_declaration": {
        const name = node.childForFieldName("name")?.text ?? "(anonymous)";
        const body = node.namedChildren.find((c) => c.type === "class_body");
        const classMethods: MethodSymbol[] = [];
        for (const child of body ? body.namedChildren : []) {
          if (child.type !== "method_definition") continue;
          const mname = child.childForFieldName("name")?.text;
          if (mname && mname !== "constructor") {
            const symbol: MethodSymbol = {
              name: mname,
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
            };
            classMethods.push(symbol);
            methodRanges.push(symbol);
          }
        }
        classes.push({ name, startLine: node.startPosition.row + 1, methods: classMethods });
        break;
      }
      case "function_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          const symbol: MethodSymbol = {
            name,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          };
          methods.push(symbol);
          methodRanges.push(symbol);
        }
        break;
      }
      case "lexical_declaration": {
        for (const declarator of node.namedChildren) {
          if (declarator.type !== "variable_declarator") continue;
          const value = declarator.childForFieldName("value");
          if (!value) continue;
          const isFunction =
            value.type === "arrow_function" ||
            value.type === "function_expression" ||
            value.type === "generator_function";
          if (!isFunction) continue;
          const name = declarator.childForFieldName("name")?.text;
          if (name) {
            const symbol: MethodSymbol = {
              name,
              startLine: declarator.startPosition.row + 1,
              endLine: value.endPosition.row + 1,
            };
            methods.push(symbol);
            methodRanges.push(symbol);
          }
        }
        break;
      }
      case "import_statement": {
        const source = node.childForFieldName("source");
        if (source) {
          imports.push({ from: unquote(source.text), symbols: collectImportSymbols(node) });
        }
        break;
      }
      case "export_statement": {
        // Re-exportação: export { X } from '...' / export * from '...'
        const source = node.childForFieldName("source");
        if (source) {
          imports.push({ from: unquote(source.text), symbols: collectExportSymbols(node) });
        }
        break;
      }
      case "call_expression": {
        const target = calleeName(node.childForFieldName("function"));
        if (target) {
          calls.push({
            target,
            line: node.startPosition.row + 1,
            col: node.startPosition.column + 1,
          });
        }
        break;
      }
    }
    for (const child of node.namedChildren) {
      collect(child);
    }
  }
}

function calleeName(fn: TsNode | null): string | undefined {
  if (!fn) return undefined;
  if (fn.type === "identifier" || fn.type === "property_identifier") return fn.text;
  if (fn.type === "member_expression") {
    return fn.childForFieldName("property")?.text;
  }
  return undefined;
}

function findOwner(ranges: MethodSymbol[], line: number): string | undefined {
  let owner: MethodSymbol | undefined;
  for (const range of ranges) {
    if (range.startLine <= line && line <= range.endLine) {
      if (!owner || range.startLine > owner.startLine) owner = range;
    }
  }
  return owner?.name;
}

function collectImportSymbols(node: TsNode): string[] | undefined {
  const clause = node.namedChildren.find((c) => c.type === "import_clause");
  if (!clause) return undefined;
  const symbols: string[] = [];
  const visit = (n: TsNode): void => {
    if (n.type === "import_specifier" || n.type === "namespace_import") {
      const name = n.childForFieldName("name");
      if (name?.text) symbols.push(name.text);
    }
    for (const child of n.namedChildren) visit(child);
  };
  visit(clause);
  return symbols.length > 0 ? symbols : undefined;
}

function collectExportSymbols(node: TsNode): string[] | undefined {
  const clause = node.namedChildren.find(
    (c) => c.type === "export_clause" || c.type === "named_exports",
  );
  if (!clause) return undefined;
  const symbols: string[] = [];
  const visit = (n: TsNode): void => {
    if (n.type === "export_specifier") {
      const name = n.childForFieldName("name");
      if (name?.text) symbols.push(name.text);
    }
    for (const child of n.namedChildren) visit(child);
  };
  visit(clause);
  return symbols.length > 0 ? symbols : undefined;
}

function unquote(source: string): string {
  return source.replace(/^['"]|['"]$/g, "");
}
