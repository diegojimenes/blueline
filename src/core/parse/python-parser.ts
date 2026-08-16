import type {
  CallSymbol,
  ClassSymbol,
  FileSymbols,
  ImportSymbol,
  LocalSymbol,
  MethodSymbol,
  Parser,
} from "./types";

export class PythonParser implements Parser {
  supports(file: string): boolean {
    return file.endsWith(".py") || file.endsWith(".pyi");
  }

  parseFile(file: string, content: string): FileSymbols {
    const lines = content.split(/\r?\n/);
    const classes: ClassSymbol[] = [];
    const methods: MethodSymbol[] = [];
    const locals: LocalSymbol[] = [];
    const imports: ImportSymbol[] = [];
    const calls: CallSymbol[] = [];

    interface Scope {
      type: "class" | "method" | "local";
      name: string;
      indent: number;
      startLine: number;
      owner?: string;
    }

    const scopeStack: Scope[] = [];

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith("#")) continue;

      const indent = rawLine.search(/\S/);

      // Desempilha escopos que fecharam devido à indentação
      while (scopeStack.length > 0 && indent <= scopeStack[scopeStack.length - 1].indent) {
        const popped = scopeStack.pop()!;
        closeScope(popped, lineNum - 1, classes, methods, locals);
      }

      // 1. Imports
      if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
        parsePythonImport(trimmed, imports);
      }

      // 2. Classes
      const classMatch = /^class\s+([A-Za-z0-9_]+)/.exec(trimmed);
      if (classMatch) {
        scopeStack.push({
          type: "class",
          name: classMatch[1],
          indent,
          startLine: lineNum,
        });
        continue;
      }

      // 3. Funções / Métodos
      const funcMatch = /^def\s+([A-Za-z0-9_]+)/.exec(trimmed);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const currentParent = scopeStack[scopeStack.length - 1];

        if (!currentParent) {
          // Função de topo
          scopeStack.push({
            type: "method",
            name: funcName,
            indent,
            startLine: lineNum,
          });
        } else if (currentParent.type === "class") {
          // Método de classe
          scopeStack.push({
            type: "method",
            name: funcName,
            indent,
            startLine: lineNum,
            owner: currentParent.name,
          });
        } else {
          // Função local / aninhada
          scopeStack.push({
            type: "local",
            name: funcName,
            indent,
            startLine: lineNum,
            owner: currentParent.name,
          });
        }
        continue;
      }

      // 4. Chamadas de função
      extractPythonCalls(trimmed, lineNum, scopeStack, calls);
    }

    // Fecha escopos restantes no fim do arquivo
    while (scopeStack.length > 0) {
      const popped = scopeStack.pop()!;
      closeScope(popped, lines.length, classes, methods, locals);
    }

    return {
      file,
      classes,
      methods,
      locals,
      imports,
      calls,
    };
  }
}

function closeScope(
  scope: { type: "class" | "method" | "local"; name: string; startLine: number; owner?: string },
  endLine: number,
  classes: ClassSymbol[],
  methods: MethodSymbol[],
  locals: LocalSymbol[],
): void {
  if (scope.type === "class") {
    let cls = classes.find((c) => c.name === scope.name);
    if (!cls) {
      cls = { name: scope.name, startLine: scope.startLine, endLine, methods: [] };
      classes.push(cls);
    } else {
      cls.endLine = endLine;
    }
  } else if (scope.type === "method") {
    if (scope.owner) {
      let cls = classes.find((c) => c.name === scope.owner);
      if (!cls) {
        cls = { name: scope.owner, startLine: scope.startLine, methods: [] };
        classes.push(cls);
      }
      cls.methods.push({ name: scope.name, startLine: scope.startLine, endLine });
    } else {
      methods.push({ name: scope.name, startLine: scope.startLine, endLine });
    }
  } else if (scope.type === "local" && scope.owner) {
    locals.push({
      name: scope.name,
      owner: scope.owner,
      startLine: scope.startLine,
      endLine,
    });
  }
}

function parsePythonImport(line: string, imports: ImportSymbol[]): void {
  // from x import a as b, c
  const fromMatch = /^from\s+([A-Za-z0-9_.]+)\s+import\s+(.+)$/.exec(line);
  if (fromMatch) {
    const fromMod = fromMatch[1];
    const rawSymbols = fromMatch[2].split(",");
    const symbols: string[] = [];
    const items: { name: string; alias?: string }[] = [];

    for (const raw of rawSymbols) {
      const part = raw.trim();
      const asMatch = /^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/.exec(part);
      if (asMatch) {
        symbols.push(asMatch[1]);
        items.push({ name: asMatch[1], alias: asMatch[2] });
      } else if (part) {
        symbols.push(part);
        items.push({ name: part });
      }
    }

    imports.push({
      from: fromMod,
      symbols,
      items,
    });
    return;
  }

  // import a, b as c
  const importMatch = /^import\s+(.+)$/.exec(line);
  if (importMatch) {
    const parts = importMatch[1].split(",");
    for (const part of parts) {
      const p = part.trim();
      const asMatch = /^([A-Za-z0-9_.]+)\s+as\s+([A-Za-z0-9_]+)$/.exec(p);
      if (asMatch) {
        imports.push({
          from: asMatch[1],
          defaultOrNamespace: asMatch[2],
          symbols: [asMatch[1]],
        });
      } else if (p) {
        imports.push({
          from: p,
          defaultOrNamespace: p,
          symbols: [p],
        });
      }
    }
  }
}

function extractPythonCalls(
  line: string,
  lineNum: number,
  scopeStack: { type: string; name: string }[],
  calls: CallSymbol[],
): void {
  // Encontra chamadas do tipo: receiver.target(...) ou target(...)
  const callRegex = /([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\(/g;
  let match: RegExpExecArray | null;

  const currentMethodOrLocal = [...scopeStack]
    .reverse()
    .find((s) => s.type === "method" || s.type === "local");

  const owner = currentMethodOrLocal?.name;

  while ((match = callRegex.exec(line)) !== null) {
    const fullCallee = match[1];
    if (["def", "class", "if", "elif", "while", "for", "with", "return"].includes(fullCallee)) {
      continue;
    }

    const col = match.index + 1;
    if (fullCallee.includes(".")) {
      const parts = fullCallee.split(".");
      const target = parts.pop()!;
      const receiver = parts.join(".");
      calls.push({ target, receiver, line: lineNum, col, owner });
    } else {
      calls.push({ target: fullCallee, line: lineNum, col, owner });
    }
  }
}
