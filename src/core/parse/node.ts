import { createRequire } from "node:module";
import type { Parser } from "./types";
import { createTypeScriptParser } from "./ts-parser";

const require = createRequire(import.meta.url);

/**
 * Factory Node para testes/CLI: resolve os WASM das gramáticas a partir de
 * node_modules. O worker do browser usa `createTypeScriptParser` com bytes
 * obtidos por fetch (src/renderer/workers).
 */
export function createNodeTypeScriptParser(): Promise<Parser> {
  return createTypeScriptParser({
    tsWasm: require.resolve("tree-sitter-typescript/tree-sitter-typescript.wasm"),
    tsxWasm: require.resolve("tree-sitter-typescript/tree-sitter-tsx.wasm"),
  });
}
