import type { CodeGraph, ModelDelta, ProjectConfig } from "./model/types";
import { buildGraph, type BuildFileInput } from "./analyze/build";
import { computeDelta, hasChanges } from "./delta";
import type { FileSymbols } from "./parse/types";

/**
 * Atualização incremental do grafo (specs/09-live-updates.md, fase 3–4).
 *
 * O cache guarda os símbolos já parseados por arquivo. Um batch de arquivos
 * re-parseados entra num único `buildGraph` sobre o cache — só os arquivos
 * tocados foram re-parseados (D1), o resto é reutilizado. Como os IDs são
 * derivados de path + símbolo, os nós não afetados saem idênticos do rebuild,
 * então o `computeDelta` produz apenas as mudanças reais (garantias D6 e #3).
 */
export type SymbolCache = Map<string, FileSymbols>;

export interface ApplyResult {
  graph: CodeGraph;
  delta: ModelDelta;
}

export function cacheFrom(files: BuildFileInput[]): SymbolCache {
  const cache: SymbolCache = new Map();
  for (const file of files) cache.set(file.path, file.symbols);
  return cache;
}

/** Aplica um batch de arquivos re-parseados ao cache e reconstrói o grafo. */
export function applyFiles(
  prev: CodeGraph,
  cache: SymbolCache,
  changed: BuildFileInput[],
  projectRoot: string,
  config: ProjectConfig = {},
  cause: ModelDelta["cause"] = "parseIncremental",
): ApplyResult {
  for (const file of changed) cache.set(file.path, file.symbols);
  return rebuild(prev, cache, projectRoot, config, cause);
}

/** Remove arquivos do cache (evento de deleção) e reconstrói. */
export function applyFileRemovals(
  prev: CodeGraph,
  cache: SymbolCache,
  removedPaths: string[],
  projectRoot: string,
  config: ProjectConfig = {},
  cause: ModelDelta["cause"] = "parseIncremental",
): ApplyResult {
  for (const p of removedPaths) cache.delete(p);
  return rebuild(prev, cache, projectRoot, config, cause);
}

function rebuild(
  prev: CodeGraph,
  cache: SymbolCache,
  projectRoot: string,
  config: ProjectConfig,
  cause: ModelDelta["cause"],
): ApplyResult {
  const inputs: BuildFileInput[] = [];
  for (const [path, symbols] of cache) inputs.push({ path, symbols });
  const next = buildGraph(inputs, projectRoot, config).graph;
  next.revision = prev.revision + 1;
  const delta = computeDelta(prev, next, cause);
  if (!hasChanges(delta)) {
    // Sem mudança real (touch sem alteração): mantém o snapshot e a revisão.
    return { graph: prev, delta };
  }
  return { graph: next, delta };
}
