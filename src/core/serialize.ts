import type { CodeGraph, Edge, EdgeId, EdgeType, Node, NodeId, ProjectConfig } from "./model/types";
import { moduleOfPath } from "./analyze/build";

/** Formato canônico de saída do CodeGraph (specs/04-analysis-pipeline.md). */
export type SerializedNode =
  | { id: NodeId; kind: "project"; name: string }
  | { id: NodeId; kind: "module"; name: string; path: string }
  | {
      id: NodeId;
      kind: "class";
      name: string;
      file: string;
      startLine: number;
      endLine?: number;
      isSecondary?: boolean;
    }
  | {
      id: NodeId;
      kind: "method";
      name: string;
      file: string;
      startLine: number;
      endLine?: number;
      owner: NodeId;
    }
  | {
      id: NodeId;
      kind: "local";
      name: string;
      file: string;
      startLine: number;
      endLine?: number;
      owner: NodeId;
    };

export interface SerializedEdge {
  id: EdgeId;
  type: EdgeType;
  from: NodeId;
  to: NodeId;
  meta?: Edge["meta"];
}

export interface SerializedGraph {
  projectRoot: string;
  revision: number;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  moduleEdges: SerializedEdge[];
}

export function serializeNode(node: Node): SerializedNode {
  switch (node.kind) {
    case "project":
      return { id: node.id, kind: "project", name: node.name };
    case "module":
      return { id: node.id, kind: "module", name: node.name, path: node.path };
    case "class":
      return {
        id: node.id,
        kind: "class",
        name: node.name,
        file: node.file,
        startLine: node.startLine,
        endLine: node.endLine,
        isSecondary: node.isSecondary,
      };
    case "method":
      return {
        id: node.id,
        kind: "method",
        name: node.name,
        file: node.file,
        startLine: node.startLine,
        endLine: node.endLine,
        owner: node.owner,
      };
    case "local":
      return {
        id: node.id,
        kind: "local",
        name: node.name,
        file: node.file,
        startLine: node.startLine,
        endLine: node.endLine,
        owner: node.owner,
      };
  }
}

/** Ordenação canônica por ID — grafos golden estáveis. */
function sortById<T extends { id: string }>(items: T[]): T[] {
  return items.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Arestas de módulo derivadas por agregação (specs/03-data-model.md).
 * Sempre recalculadas a partir das arestas primárias — nunca fonte primária.
 */
export function aggregateModuleEdges(graph: CodeGraph, config: ProjectConfig = {}): Edge[] {
  const weight = new Map<string, number>();
  for (const edge of graph.edges.values()) {
    if (edge.type === "moduleEdge") continue;
    const fromModule = moduleIdOf(graph.nodes.get(edge.from), config);
    const toModule = moduleIdOf(graph.nodes.get(edge.to), config);
    if (!fromModule || !toModule || fromModule === toModule) continue;
    const key = `${fromModule}\u0000${toModule}`;
    weight.set(key, (weight.get(key) ?? 0) + 1);
  }
  return [...weight.entries()].map(([key, w]) => {
    const [from, to] = key.split("\u0000");
    return { id: `moduleEdge:${from}:${to}`, type: "moduleEdge", from, to, meta: { weight: w } };
  });
}

function moduleIdOf(node: Node | undefined, config: ProjectConfig): NodeId | null {
  if (!node) return null;
  if (node.kind === "module") return node.id;
  if (node.kind === "project") return "module:<root>";
  return `module:${moduleOfPath(node.file, config)}`;
}

export function toJSON(graph: CodeGraph, config: ProjectConfig = {}): SerializedGraph {
  return {
    projectRoot: graph.projectRoot,
    revision: graph.revision,
    nodes: sortById([...graph.nodes.values()].map(serializeNode)),
    edges: sortById([...graph.edges.values()]),
    moduleEdges: sortById(aggregateModuleEdges(graph, config)),
  };
}

/**
 * Reconstrói um CodeGraph a partir do formato canônico (M5: o store guarda a
 * versão serializada e precisa do modelo com Maps para o delta incremental).
 */
export function fromJSON(json: SerializedGraph): CodeGraph {
  const nodes = new Map<NodeId, Node>();
  for (const n of json.nodes) nodes.set(n.id, n as Node);
  const edges = new Map<EdgeId, Edge>();
  for (const e of json.edges) edges.set(e.id, e);
  const byFile = new Map<string, NodeId[]>();
  const byModule = new Map<NodeId, NodeId[]>();
  const callsIn = new Map<NodeId, NodeId[]>();
  const callsOut = new Map<NodeId, NodeId[]>();
  for (const node of nodes.values()) {
    if (node.kind === "class" || node.kind === "method") {
      const list = byFile.get(node.file) ?? [];
      list.push(node.id);
      byFile.set(node.file, list);
    }
    if (node.kind === "class") {
      const mod = `module:${moduleOfPath(node.file)}`;
      const list = byModule.get(mod) ?? [];
      if (!list.includes(node.id)) list.push(node.id);
      byModule.set(mod, list);
    }
  }
  for (const edge of edges.values()) {
    if (edge.type === "call") {
      const out = callsOut.get(edge.from) ?? [];
      out.push(edge.to);
      callsOut.set(edge.from, out);
      const inn = callsIn.get(edge.to) ?? [];
      inn.push(edge.from);
      callsIn.set(edge.to, inn);
    }
  }
  return { projectRoot: json.projectRoot, revision: json.revision, nodes, edges, indexes: { byFile, byModule, callsIn, callsOut } };
}
