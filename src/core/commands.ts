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
import { queryGraph } from "./query";
import { computeImpactSummary } from "./change-summary";

export interface CommandResult {
  nav: NavigationState;
  entries: HistoryEntry[];
  lines: string[];
  target: NodeId | null;
}

export interface CommandOptions {
  config?: ProjectConfig;
  now?: number;
  /** Files with git changes (for `changed` command) */
  gitDirty?: string[];
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
    case "query":
    case "q":
      return cmdQuery(graph, nav, arg, opts);
    case "impact":
      return cmdImpact(graph, nav, arg, opts);
    case "deps":
      return cmdDeps(graph, nav, arg, opts);
    case "dependents":
      return cmdDependents(graph, nav, arg, opts);
    case "trace":
      return cmdTrace(graph, nav, arg, opts);
    case "changed":
      return cmdChanged(graph, nav, opts);
    case "help":
      return cmdHelp(nav);
    default:
      return { nav, entries: [], lines: [`unknown command: "${name}" — type help`], target: null };
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
    } else if (nav.level === 5 && n.kind === "local") {
      lines.push(`  ${n.name.padEnd(24)} :${n.startLine} (local)`);
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

export function cmdQuery(
  graph: SerializedGraph,
  nav: NavigationState,
  arg: string,
  opts: CommandOptions = {},
): CommandResult {
  if (!arg) {
    return {
      nav,
      entries: [],
      lines: ["uso: query <expressao> — ex.: query kind:class layer:domain coupling:>2"],
      target: null,
    };
  }

  const matches = queryGraph(graph, arg, opts.config ?? {});
  const lines: string[] = [];

  if (matches.length === 0) {
    lines.push(`nenhum nó correspondeu à query: "${arg}"`);
  } else {
    lines.push(`encontrado${matches.length === 1 ? "" : "s"} ${matches.length} nó${matches.length === 1 ? "" : "s"}:`);
    for (const m of matches) {
      lines.push(`  ${m.kind.padEnd(8)} ${canonicalPathOf(graph, m.id, opts.config ?? {})}`);
    }
  }

  const firstTarget = matches.length === 1 ? matches[0].id : null;
  return {
    nav,
    entries: [],
    lines,
    target: firstTarget,
  };
}

export function cmdHelp(nav: NavigationState): CommandResult {
  return {
    nav,
    entries: [],
    lines: [
      "  goto <path>       navigate — format: module.Class.method (or unique name)",
      "  up                go up one level (parent focus)",
      "  ls                list nodes at current level",
      "  lens <lens>       layers | coupling | domain",
      "  query <expr>      declarative search — e.g.: query kind:class layer:domain",
      "  impact <symbol>   show blast radius of a symbol",
      "  deps <symbol>     show direct dependencies (callees)",
      "  dependents <sym>  show who depends on a symbol (callers)",
      "  trace <symbol>    show transitive call chain (up to 3 levels)",
      "  changed           list symbols in files with git changes",
      "  clear             clear terminal",
      "  help              this help",
    ],
    target: null,
  };
}

/** impact <symbol> — blast radius: dependents, affected modules */
export function cmdImpact(
  graph: SerializedGraph,
  nav: NavigationState,
  spec: string,
  opts: CommandOptions = {},
): CommandResult {
  if (!spec) return { nav, entries: [], lines: ["usage: impact <symbol>"], target: null };
  const resolved = resolveTarget(graph, spec, opts.config ?? {});
  if ("error" in resolved) return { nav, entries: [], lines: [resolved.error], target: null };
  const node = resolved.node;
  const impact = computeImpactSummary(graph, node.id, undefined, opts.config ?? {});
  if (!impact) return { nav, entries: [], lines: [`no impact data for: ${spec}`], target: null };

  const lines: string[] = [
    `impact: ${impact.canonicalPath}`,
    `  level:       ${impact.impactLevel}  (score: ${impact.impactScore}/100)`,
    `  dependents:  ${impact.directDependents.length}`,
    `  depth:       ${impact.transitiveDepth} level${impact.transitiveDepth !== 1 ? "s" : ""}`,
    `  modules:     ${impact.affectedModules.length > 0 ? impact.affectedModules.join(", ") : "none"}`,
  ];

  if (impact.directDependents.length > 0) {
    lines.push("");
    lines.push("  callers:");
    for (const d of impact.directDependents) {
      lines.push(`    ← ${d.path}`);
    }
  }

  if (impact.directDependencies.length > 0) {
    lines.push("");
    lines.push("  calls:");
    for (const d of impact.directDependencies) {
      lines.push(`    → ${d.path}`);
    }
  }

  return { nav, entries: [], lines, target: node.id };
}

/** deps <symbol> — outgoing call/import dependencies */
export function cmdDeps(
  graph: SerializedGraph,
  nav: NavigationState,
  spec: string,
  opts: CommandOptions = {},
): CommandResult {
  if (!spec) return { nav, entries: [], lines: ["usage: deps <symbol>"], target: null };
  const resolved = resolveTarget(graph, spec, opts.config ?? {});
  if ("error" in resolved) return { nav, entries: [], lines: [resolved.error], target: null };
  const node = resolved.node;

  const callEdges = graph.edges.filter((e) => e.type === "call" && e.from === node.id);
  const importEdges = graph.edges.filter((e) => e.type === "import" && e.from === node.id);

  const lines: string[] = [`deps: ${canonicalPathOf(graph, node.id, opts.config ?? {})}`, ""];
  if (callEdges.length === 0 && importEdges.length === 0) {
    lines.push("  (no direct dependencies)");
  } else {
    for (const e of callEdges) lines.push(`  → ${canonicalPathOf(graph, e.to, opts.config ?? {})}`);
    for (const e of importEdges) lines.push(`  import → ${canonicalPathOf(graph, e.to, opts.config ?? {})}`);
  }

  return { nav, entries: [], lines, target: node.id };
}

/** dependents <symbol> — incoming call edges (who depends on this) */
export function cmdDependents(
  graph: SerializedGraph,
  nav: NavigationState,
  spec: string,
  opts: CommandOptions = {},
): CommandResult {
  if (!spec) return { nav, entries: [], lines: ["usage: dependents <symbol>"], target: null };
  const resolved = resolveTarget(graph, spec, opts.config ?? {});
  if ("error" in resolved) return { nav, entries: [], lines: [resolved.error], target: null };
  const node = resolved.node;

  const inEdges = graph.edges.filter((e) => e.type === "call" && e.to === node.id);
  const lines: string[] = [`dependents: ${canonicalPathOf(graph, node.id, opts.config ?? {})}`, ""];
  if (inEdges.length === 0) {
    lines.push("  (no callers — leaf symbol)");
  } else {
    for (const e of inEdges) lines.push(`  ← ${canonicalPathOf(graph, e.from, opts.config ?? {})}`);
  }

  return { nav, entries: [], lines, target: node.id };
}

/** trace <symbol> — transitive call chain, BFS up to 3 levels */
export function cmdTrace(
  graph: SerializedGraph,
  nav: NavigationState,
  spec: string,
  opts: CommandOptions = {},
): CommandResult {
  if (!spec) return { nav, entries: [], lines: ["usage: trace <symbol>"], target: null };
  const resolved = resolveTarget(graph, spec, opts.config ?? {});
  if ("error" in resolved) return { nav, entries: [], lines: [resolved.error], target: null };
  const node = resolved.node;
  const config = opts.config ?? {};

  const rootPath = canonicalPathOf(graph, node.id, config);
  const lines: string[] = [`trace: ${rootPath}`];

  // BFS outgoing (callees)
  const visited = new Set<NodeId>([node.id]);
  let frontier = [node.id];
  let depth = 0;
  const MAX_DEPTH = 3;

  while (frontier.length > 0 && depth < MAX_DEPTH) {
    const next: NodeId[] = [];
    const indent = "  ".repeat(depth + 1);
    for (const id of frontier) {
      const outs = graph.edges.filter((e) => e.type === "call" && e.from === id);
      for (const e of outs) {
        if (!visited.has(e.to)) {
          visited.add(e.to);
          next.push(e.to);
          lines.push(`${indent}→ ${canonicalPathOf(graph, e.to, config)}`);
        }
      }
    }
    frontier = next;
    depth++;
  }

  if (lines.length === 1) lines.push("  (no outgoing calls)");
  return { nav, entries: [], lines, target: node.id };
}

/** changed — list symbols in files with git changes */
export function cmdChanged(
  graph: SerializedGraph,
  nav: NavigationState,
  opts: CommandOptions = {},
): CommandResult {
  const dirty = opts.gitDirty ?? [];
  if (dirty.length === 0) {
    return { nav, entries: [], lines: ["no git changes detected"], target: null };
  }

  const config = opts.config ?? {};
  const changedNodes = graph.nodes.filter(
    (n) => (n.kind === "class" || n.kind === "method") && "file" in n && dirty.includes(n.file),
  );

  const lines: string[] = [`changed: ${dirty.length} file${dirty.length !== 1 ? "s" : ""}, ${changedNodes.length} symbol${changedNodes.length !== 1 ? "s" : ""}`];
  if (changedNodes.length === 0) {
    lines.push("  (no structural symbols in changed files)");
  } else {
    for (const n of changedNodes) {
      lines.push(`  ${n.kind.padEnd(8)} ${canonicalPathOf(graph, n.id, config)}`);
    }
  }

  return { nav, entries: [], lines, target: changedNodes.length === 1 ? changedNodes[0].id : null };
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
