/**
 * API pública do núcleo de análise (src/core), framework-agnostic.
 *
 * Entrada compatível com browser (worker) e Node. Módulos específicos de Node
 * (walk, parse/node) NÃO são re-exportados daqui — são usados por testes,
 * CLI e pelo backend (specs/02-architecture.md).
 */
export * from "./events";
export * from "./model/types";
export * from "./parse/types";
export * from "./path";
export * from "./serialize";
export * from "./analyze";
export * from "./navigation";
export * from "./commands";
export * from "./layout";
export * from "./viewport";
export * from "./portals";
export * from "./lenses";
export * from "./tty";
export * from "./delta";
export * from "./incremental";
export * from "./search";
export * from "./diff";
export * from "./agent-protocol";
export * from "./parse/composite-parser";
export * from "./parse/python-parser";
export * from "./spatial-index";
export * from "./storage/graph-cache";
export * from "./query";
export * from "./workspace";
export * from "./change-summary";
export { createTypeScriptParser } from "./parse/ts-parser";
