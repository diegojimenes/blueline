import { CompositeParser, createTypeScriptParser, PythonParser, type Parser } from "../core";
import tsWasm from "tree-sitter-typescript/tree-sitter-typescript.wasm?url";
import tsxWasm from "tree-sitter-typescript/tree-sitter-tsx.wasm?url";
import webTreeSitterWasm from "web-tree-sitter/web-tree-sitter.wasm?url";

let parserPromise: Promise<Parser> | null = null;

/**
 * Parser do webview (M5 + M11): as gramáticas tree-sitter WASM chegam via asset do
 * Vite (`?url`), inclusive o web-tree-sitter.wasm (via `locateFile`).
 * O CompositeParser agrega TS/JS e Python.
 */
export function getParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = createTypeScriptParser({ tsWasm, tsxWasm, treeSitterWasm: webTreeSitterWasm })
      .then((tsParser) => {
        const composite = new CompositeParser([tsParser, new PythonParser()]);
        return composite;
      })
      .catch((err) => {
        parserPromise = null;
        throw err;
      });
  }
  return parserPromise;
}

export function resetParser(): void {
  parserPromise = null;
}
