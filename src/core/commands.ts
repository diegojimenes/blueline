/**
 * Comandos determinísticos de navegação (specs/08-terminal.md).
 *
 * Puros: recebem `(graph, state, arg)` e retornam `(newState, output)`.
 * Testáveis sem terminal. Todo comando de navegação gera uma entrada de
 * histórico clicável.
 */

import type { HistoryEntry, LensId, NavigationState, NodeId, ProjectConfig } from "./model/types";
import type { SerializedGraph, SerializedNode } from "./serialize";
import { canonicalPathOf, navigationToNode, nodeById, upNavigation, visibleNodes } from "./navigation";
import { moduleOfPath } from "./analyze/build";

export interface CommandResult {
  nav: NavigationState;
  entries: HistoryEntry[];
  lines: string[];
  target: NodeId | null;
}

export interface CommandOptions {
  config?: ProjectConfig;
  now?: number;
}

export interface ParsedCommand {
  name: string;
  arg: string;
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { name: trimmed.toLowerCase(), arg: "" };
  return { name: trimmed.slice(0, space).toLowerCase(), arg: trimmed.slice(space + 1).trim() };
}

/** Executa um comando pelo input do terminal. */
export function runCommand(
  graph: SerializedGraph,
  nav: NavigationState,
  input: string,
  opts: CommandOptions = {},
): CommandResult {
  const { name, arg } = parseCommand(input);
  switch (name) {
    case "goto":
      return cmdGoto(graph, nav, arg, opts);
    case "up":
      return cmdUp(graph, nav, opts);
    case "ls":
      return cmdLs(graph, nav, opts);
    case "lens":
      return cmdLens(nav, arg, opts);
    case "help":
      return cmdHelp(nav);
    default:
      return { nav, entries: [], lines: [`comando desconhecido: "${name}" — use help`], target: null };
  }
}

/** Entra no nó diretamente (duplo clique no canvas usa isto — mesmo histórico do `goto`). */
export function gotoNode(graph: SerializedGraph, nav: NavigationState, id: NodeId, opts: CommandOptions = {}): CommandResult {
  const node = nodeById(graph, id);
  if (!node) return { nav, entries: [], lines: [`nó não encontrado: ${id}`], target: null };
  const target = navigationToNode(graph, nav, id, opts.config ?? {});
  const path = canonicalPathOf(graph, id, opts.config ?? {});
  return {
    nav: target,
    entries: [entry(opts.now ?? Date.now(), `goto ${path}`, path, id)],
    lines: [`→ ${path}`],
    target: id,
  };
}

export function cmdGoto(graph: SerializedGraph, nav: NavigationState, spec: string, opts: CommandOptions = {}): CommandResult {
  if (!spec) return { nav, entries: [], lines: ["uso: goto <caminho> — ex.: goto pedidos.PedidoService"], target: null };
  const resolved = resolveTarget(graph, spec, opts.config ?? {});
  if ("error" in resolved) return { nav, entries: [], lines: [resolved.error], target: null };
  return gotoNode(graph, nav, resolved.node.id, opts);
}

export function cmdUp(graph: SerializedGraph, nav: NavigationState, opts: CommandOptions = {}): CommandResult {
  const next = upNavigation(graph, nav, opts.config ?? {});
  if (next === nav) {
    return { nav, entries: [], lines: ["já estou no nível 1 (sistema)"], target: null };
  }
  const path = next.focus ? canonicalPathOf(graph, next.focus, opts.config ?? {}) : "sistema";
  return {
    nav: next,
    entries: [entry(opts.now ?? Date.now(), "up", path, next.focus)],
    lines: [`↑ ${path}`],
    target: next.focus,
  };
}

export function cmdLs(graph: SerializedGraph, nav: NavigationState, opts: CommandOptions = {}): CommandResult {
  const config = opts.config ?? {};
  const nodes = visibleNodes(graph, nav, config);
  const lines: string[] = [];
  for (const n of nodes) {
    if (nav.level === 1 && n.kind === "module") {
      const count = graph.nodes.filter((c) => c.kind === "class" && moduleOfPath(c.file, config) === n.path).length;
      lines.push(`  ${n.name.padEnd(24)} ${count} classe${count === 1 ? "" : "s"}`);
    } else if (nav.level === 2 && n.kind === "class") {
      lines.push(`  ${n.name.padEnd(24)} ${n.file}`);
    } else if (nav.level === 3 && n.kind === "method") {
      lines.push(`  ${n.name.padEnd(24)} :${n.startLine}`);
    } else {
      lines.push(...callLinesFor(graph, nav, config));
    }
  }
  if (lines.length === 0) {
    lines.push(nav.level === 1 ? "  (nenhum módulo)" : "  (vazio)");
  }
  return { nav, entries: [], lines, target: null };
}

function callLinesFor(graph: SerializedGraph, nav: NavigationState, config: ProjectConfig): string[] {
  if (!nav.focus) return [];
  const out = graph.edges
    .filter((e) => e.type === "call" && e.from === nav.focus)
    .map((e) => `  chama:    ${canonicalPathOf(graph, e.to, config)}`);
  const inEdges = graph.edges
    .filter((e) => e.type === "call" && e.to === nav.focus)
    .map((e) => `  chamado:  ${canonicalPathOf(graph, e.from, config)}`);
  return [...out, ...inEdges];
}

export function cmdLens(nav: NavigationState, arg: string, opts: CommandOptions = {}): CommandResult {
  const lens = arg as LensId;
  if (lens !== "layers" && lens !== "coupling" && lens !== "domain") {
    return { nav, entries: [], lines: ["lente inválida — use lens layers|coupling|domain"], target: null };
  }
  return {
    nav: { ...nav, lens },
    entries: [entry(opts.now ?? Date.now(), `lens ${lens}`, lens, null)],
    lines: [`lente: ${lens}`],
    target: null,
  };
}

export function cmdHelp(nav: NavigationState): CommandResult {
  return {
    nav,
    entries: [],
    lines: [
      "  goto <caminho>   navega — formato: modulo.Classe.metodo (ou nome único)",
      "  up               sobe um nível (foco pai)",
      "  ls               lista nós do nível atual",
      "  lens <lens>      layers | coupling | domain",
      "  clear            limpa o terminal",
      "  help             esta ajuda",
    ],
    target: null,
  };
}

export type TargetResolution = { node: SerializedNode } | { error: string };

/** Resolve um alvo de `goto`: id exato, caminho pontilhado, caminho de arquivo ou nome único. */
export function resolveTarget(graph: SerializedGraph, spec: string, config: ProjectConfig = {}): TargetResolution {
  const exact = nodeById(graph, spec);
  if (exact) return { node: exact };

  const fileClasses = graph.nodes.filter((n) => n.kind === "class" && n.file === spec);
  if (fileClasses.length === 1) return { node: fileClasses[0] };
  if (fileClasses.length > 1) return { error: `caminho ambíguo: ${spec}` };

  const dotted = resolveDotted(graph, spec, config);
  if (dotted) return dotted;

  const matches = uniqueNameMatches(graph, spec);
  if (matches.length === 1) return { node: matches[0] };
  if (matches.length > 1) {
    return { error: `ambíguo (${matches.length}): ${matches.map((m) => canonicalPathOf(graph, m.id, config)).join(", ")}` };
  }
  return { error: `nada encontrado para: ${spec}` };
}

function resolveDotted(graph: SerializedGraph, spec: string, config: ProjectConfig): TargetResolution | null {
  const parts = spec.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;

  const moduleNode = graph.nodes.find(
    (n): n is Extract<typeof n, { kind: "module" }> =>
      n.kind === "module" && (n.name === parts[0] || n.path === parts[0] || n.path.endsWith(`/${parts[0]}`)),
  );
  if (!moduleNode) return { error: `módulo não encontrado: ${parts[0]}` };

  const classCandidates = graph.nodes.filter(
    (n) => n.kind === "class" && moduleOfPath(n.file, config) === moduleNode.path && n.name === parts[1],
  );
  if (classCandidates.length !== 1) return { error: `classe ${parts[1]} não encontrada em ${parts[0]}` };
  const classNode = classCandidates[0];

  if (parts.length === 2) return { node: classNode };

  const method = graph.nodes.find((n) => n.kind === "method" && n.owner === classNode.id && n.name === parts[2]);
  return method ? { node: method } : { error: `método ${parts[2]} não encontrado em ${parts[0]}.${parts[1]}` };
}

function uniqueNameMatches(graph: SerializedGraph, spec: string): SerializedNode[] {
  const exactName = graph.nodes.filter((n) => n.name === spec);
  if (exactName.length > 0) return exactName;
  return graph.nodes.filter((n): n is Extract<typeof n, { kind: "class" | "method" }> => (n.kind === "class" || n.kind === "method") && n.file === spec);
}

function entry(timestamp: number, command: string, humanPath: string, target: NodeId | null): HistoryEntry {
  return { timestamp, command, humanPath, target };
}
