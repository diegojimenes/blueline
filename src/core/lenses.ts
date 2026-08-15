/**
 * Lentes (specs/06-lenses.md): filtros que recolorem/regrupam o MESMO grafo,
 * mantendo posição espacial. Toda lógica é pura e determinística.
 *
 * A lente ativa vive no NavigationState; a UI apenas aplica `colorFor`/
 * `groupsFor`/`widthFor`. Trocar de lente nunca muda o layout (D7).
 */

import type { LensId, NodeId, ProjectConfig } from "./model/types";
import type { SerializedGraph, SerializedNode } from "./serialize";
import { moduleOfPath } from "./analyze/build";

export interface LensGroup {
  id: string;
  label: string;
  nodeIds: NodeId[];
}

/** Regras padrão de camada por convenção de caminho (specs/06-lenses.md). */
const DEFAULT_LAYER_RULES: Array<{ layer: string; prefixes: string[] }> = [
  { layer: "api", prefixes: ["api", "routes", "controllers"] },
  { layer: "domain", prefixes: ["domain", "entities", "models"] },
  { layer: "application", prefixes: ["services", "use-cases"] },
  { layer: "infra", prefixes: ["infra", "db", "clients"] },
];

function pathOf(node: SerializedNode, config: ProjectConfig): string {
  switch (node.kind) {
    case "project":
      return "sistema";
    case "module":
      return node.path;
    case "class":
    case "method":
      return moduleOfPath(node.file, config);
  }
}

/** Camada de um nó (lente Camadas). Determinístico por caminho. */
export function layerOf(node: SerializedNode, config: ProjectConfig = {}): string {
  const path = pathOf(node, config);
  if (node.kind === "project") return "sistema";
  const rules = config.layerPaths ? Object.entries(config.layerPaths) : [];
  for (const [layer, prefixes] of rules) {
    if (prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return layer;
  }
  for (const rule of DEFAULT_LAYER_RULES) {
    if (rule.prefixes.some((p) => path === p || path.startsWith(`${p}/`))) return rule.layer;
  }
  return "core";
}

/** Domínio de um nó (lente Domínio). Requer `domainPaths` no config. */
export function domainOf(node: SerializedNode, config: ProjectConfig = {}): string {
  const domains = config.domainPaths;
  if (!domains) return "outros";
  const path = pathOf(node, config);
  if (node.kind === "project") return "sistema";
  for (const [domain, prefix] of Object.entries(domains)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return domain;
  }
  return "outros";
}

/** Grau de acoplamento direto do nó (specs/06-lenses.md, lente Acoplamento). */
export function couplingOf(graph: SerializedGraph, node: SerializedNode): number {
  if (node.kind === "module") {
    let weight = 0;
    for (const e of graph.moduleEdges) {
      if (e.from === node.id || e.to === node.id) weight += e.meta?.weight ?? 1;
    }
    return weight;
  }
  if (node.kind === "method") {
    return graph.edges.filter((e) => e.type === "call" && (e.from === node.id || e.to === node.id)).length;
  }
  if (node.kind === "class") {
    return graph.edges.filter((e) => (e.type === "call" || e.type === "import") && (e.from === node.id || e.to === node.id)).length;
  }
  return 0;
}

/** Chave de cor determinística por `(lens, node)` — a UI mapeia chave→cor. */
export function colorKey(node: SerializedNode, lens: LensId, config: ProjectConfig = {}, graph?: SerializedGraph): string {
  switch (lens) {
    case "layers":
      return `layer:${layerOf(node, config)}`;
    case "domain":
      return `domain:${domainOf(node, config)}`;
    case "coupling": {
      if (!graph) return "coup:0";
      const d = couplingOf(graph, node);
      return `coup:${d >= 5 ? 3 : d >= 3 ? 2 : d >= 1 ? 1 : 0}`;
    }
  }
}

/** Espessura de aresta por lente (por padrão 1; acoplamento engrossa arestas quentes). */
export function widthFor(
  edge: { from: NodeId; to: NodeId; type: string; meta?: { weight?: number } },
  lens: LensId,
  graph: SerializedGraph,
): number {
  if (lens === "coupling") {
    const to = graph.nodes.find((n) => n.id === edge.to);
    if (to) {
      const d = couplingOf(graph, to);
      return Math.min(1 + d / 2, 4);
    }
  }
  if (edge.type === "moduleEdge") return 1 + (edge.meta?.weight ?? 1);
  return 1;
}

/** Agrupamento visual da lente (caixas de camada) — não move nós. */
export function groupsFor(nodes: SerializedNode[], lens: LensId, config: ProjectConfig = {}): LensGroup[] {
  if (lens === "layers") {
    const byLayer = new Map<string, NodeId[]>();
    for (const n of nodes) {
      const layer = layerOf(n, config);
      const list = byLayer.get(layer) ?? [];
      list.push(n.id);
      byLayer.set(layer, list);
    }
    return [...byLayer.entries()]
      .map(([label, nodeIds]) => ({ id: `layer:${label}`, label, nodeIds }))
      .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  }
  return [{ id: lens, label: lens, nodeIds: nodes.map((n) => n.id) }];
}
