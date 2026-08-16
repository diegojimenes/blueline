import { canonicalPathOf } from "./navigation";
import type { CodeGraph, Edge, Node } from "./model/types";
import type { SerializedGraph, SerializedNode } from "./serialize";

export interface AgentAttentionEvent {
  type: "attention";
  agent: string;
  file: string;
  line?: number;
  symbol?: string;
  message?: string;
  timestamp: number;
}

export interface AgentContext {
  target: string;
  targetNode?: {
    id: string;
    kind: string;
    name: string;
    file?: string;
  };
  callers: string[];
  callees: string[];
  imports: string[];
  exportedSymbols: string[];
  summary: string;
}

/**
 * Constrói um contexto estruturado de código focado num nó/símbolo/arquivo,
 * otimizado para injeção em prompts de agentes LLM (Claude, Cursor, Copilot, Aider).
 */
export function buildAgentContext(
  graphSource: CodeGraph | SerializedGraph,
  targetQuery: string,
): AgentContext {
  const nodes = getNodesList(graphSource);
  const edges = getEdgesList(graphSource);

  // Busca nó correspondente por ID exato, nome ou arquivo
  let matchedNode: Node | SerializedNode | undefined = nodes.find(
    (n) => n.id === targetQuery || n.name === targetQuery,
  );

  if (!matchedNode) {
    matchedNode = nodes.find((n) => "file" in n && n.file === targetQuery);
  }

  if (!matchedNode) {
    return {
      target: targetQuery,
      callers: [],
      callees: [],
      imports: [],
      exportedSymbols: [],
      summary: `Nenhum símbolo ou arquivo correspondente a '${targetQuery}' foi encontrado no grafo.`,
    };
  }

  const targetId = matchedNode.id;
  const serializedGraph: SerializedGraph =
    "revision" in graphSource && Array.isArray(graphSource.nodes)
      ? (graphSource as SerializedGraph)
      : {
          projectRoot: (graphSource as CodeGraph).projectRoot,
          revision: graphSource.revision,
          nodes: Array.from((graphSource as CodeGraph).nodes.values()),
          edges: Array.from((graphSource as CodeGraph).edges.values()),
          moduleEdges: [],
        };

  // Encontra chamadores (incoming calls)
  const callers = edges
    .filter((e: Edge | SerializedGraph["edges"][number]) => e.type === "call" && e.to === targetId)
    .map((e: Edge | SerializedGraph["edges"][number]) => canonicalPathOf(serializedGraph, e.from));

  // Encontra chamadas feitas (outgoing calls)
  const callees = edges
    .filter((e: Edge | SerializedGraph["edges"][number]) => e.type === "call" && e.from === targetId)
    .map((e: Edge | SerializedGraph["edges"][number]) => canonicalPathOf(serializedGraph, e.to));

  // Encontra dependências de import
  const imports = edges
    .filter((e: Edge | SerializedGraph["edges"][number]) => e.type === "import" && (e.from === targetId || e.to === targetId))
    .map((e: Edge | SerializedGraph["edges"][number]) =>
      e.from === targetId
        ? `-> ${canonicalPathOf(serializedGraph, e.to)}`
        : `<- ${canonicalPathOf(serializedGraph, e.from)}`,
    );

  // Símbolos pertencentes (se for classe ou módulo)
  const exportedSymbols = edges
    .filter((e: Edge | SerializedGraph["edges"][number]) => e.type === "member" && e.from === targetId)
    .map((e: Edge | SerializedGraph["edges"][number]) => canonicalPathOf(serializedGraph, e.to));

  const summary = [
    `Symbol: ${matchedNode.name} (${matchedNode.kind})`,
    "file" in matchedNode && matchedNode.file ? `File: ${matchedNode.file}` : null,
    callers.length > 0 ? `Called by (${callers.length}): ${callers.join(", ")}` : "Called by: none",
    callees.length > 0 ? `Calls (${callees.length}): ${callees.join(", ")}` : "Calls: none",
    exportedSymbols.length > 0 ? `Members: ${exportedSymbols.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    target: targetQuery,
    targetNode: {
      id: matchedNode.id,
      kind: matchedNode.kind,
      name: matchedNode.name,
      file: "file" in matchedNode ? matchedNode.file : undefined,
    },
    callers,
    callees,
    imports,
    exportedSymbols,
    summary,
  };
}

function getNodesList(source: CodeGraph | SerializedGraph): (Node | SerializedNode)[] {
  if ("nodes" in source && source.nodes instanceof Map) {
    return Array.from(source.nodes.values());
  }
  return Array.isArray(source.nodes) ? source.nodes : [];
}

function getEdgesList(source: CodeGraph | SerializedGraph): (Edge | SerializedGraph["edges"][number])[] {
  if ("edges" in source && source.edges instanceof Map) {
    return Array.from(source.edges.values());
  }
  return Array.isArray(source.edges) ? source.edges : [];
}
