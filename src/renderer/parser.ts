import { createTypeScriptParser, type Parser } from "../core";
import tsWasm from "tree-sitter-typescript/tree-sitter-typescript.wasm?url";
import tsxWasm from "tree-sitter-typescript/tree-sitter-tsx.wasm?url";

let parserPromise: Promise<Parser> | null = null;

/**
 * Parser do webview (M5): as gramáticas tree-sitter WASM chegam via asset do
 * Vite (`?url`). A inicialização é única e lazy — o demo não paga o custo.
 */
export function getParser(): Promise<Parser> {
  if (!parserPromise) {
    parserPromise = createTypeScriptParser({ tsWasm, tsxWasm });
  }
  return parserPromise;
}

export function resetParser(): void {
  parserPromise = null;
}
