/**
 * Computa o impacto arquitetural de um símbolo no grafo (specs/impact-view).
 *
 * Determinístico: usa apenas edges do grafo e dados de diff já disponíveis.
 * Sem chamadas a LLM.
 */

import { canonicalPathOf } from "./navigation";
import { moduleOfPath } from "./analyze/build";
import type { NodeId, ProjectConfig } from "./model/types";
import type { ProjectDiffSummary, SymbolDiffInfo } from "./diff";
import type { SerializedGraph, SerializedNode } from "./serialize";

export interface ImpactSummary {
  node: SerializedNode;
  canonicalPath: string;

  /** Outgoing call edges — o que este símbolo chama */
  directDependencies: Array<{ id: NodeId; path: string }>;
  /** Incoming call edges — quem chama este símbolo */
  directDependents: Array<{ id: NodeId; path: string }>;
  /** Módulos únicos dos dependentes diretos */
  affectedModules: string[];
  /** Profundidade máxima de propagação (BFS limitado a 3 níveis) */
  transitiveDepth: number;
  /** Total de nós alcançáveis via dependentes (transitivo, máx 3 níveis) */
  reachableCount: number;

  /** Info de diff AST, se disponível */
  diffInfo?: SymbolDiffInfo;

  /** Nível de impacto heurístico */
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
  /** Score 0-100 para exibição em barra de progresso */
  impactScore: number;
}

/**
 * Computa o resumo de impacto arquitetural para um nó do grafo.
 *
 * @param graph - Grafo serializado atual
 * @param nodeId - ID do nó a analisar
 * @param diffSummary - Resumo de diff AST (opcional, enriquece o resultado)
 * @param config - Configuração do projeto (para layer/module)
 */
export function computeImpactSummary(
  graph: SerializedGraph,
  nodeId: NodeId,
  diffSummary?: ProjectDiffSummary | null,
  config: ProjectConfig = {},
): ImpactSummary | null {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const canonicalPath = canonicalPathOf(graph, nodeId, config);

  // Dependências diretas (outgoing calls)
  const outEdges = graph.edges.filter((e) => e.type === "call" && e.from === nodeId);
  const directDependencies = outEdges.map((e) => ({
    id: e.to,
    path: canonicalPathOf(graph, e.to, config),
  }));

  // Dependentes diretos (incoming calls)
  const inEdges = graph.edges.filter((e) => e.type === "call" && e.to === nodeId);
  const directDependents = inEdges.map((e) => ({
    id: e.from,
    path: canonicalPathOf(graph, e.from, config),
  }));

  // Módulos afetados — dos dependentes diretos
  const affectedModules = Array.from(
    new Set(
      directDependents
        .map(({ id }) => {
          const n = graph.nodes.find((x) => x.id === id);
          return n && "file" in n ? moduleOfPath(n.file, config) : null;
        })
        .filter((m): m is string => m !== null && m !== ""),
    ),
  );

  // BFS para profundidade e contagem transitiva (máx 3 níveis)
  const { depth, count } = computeTransitiveReach(graph, nodeId, 3);

  const diffInfo = diffSummary?.symbols.get(nodeId);

  const { impactLevel, impactScore } = computeImpactLevel(
    directDependents.length,
    affectedModules.length,
    depth,
    diffInfo,
  );

  return {
    node,
    canonicalPath,
    directDependencies,
    directDependents,
    affectedModules,
    transitiveDepth: depth,
    reachableCount: count,
    diffInfo,
    impactLevel,
    impactScore,
  };
}

/**
 * BFS para calcular profundidade e contagem de nós alcançáveis via dependentes.
 * Limitado a maxDepth para evitar travessia infinita em grafos cíclicos.
 */
function computeTransitiveReach(
  graph: SerializedGraph,
  startId: NodeId,
  maxDepth: number,
): { depth: number; count: number } {
  const visited = new Set<NodeId>([startId]);
  let frontier = [startId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const next: NodeId[] = [];
    for (const id of frontier) {
      const callers = graph.edges
        .filter((e) => e.type === "call" && e.to === id)
        .map((e) => e.from);
      for (const callerId of callers) {
        if (!visited.has(callerId)) {
          visited.add(callerId);
          next.push(callerId);
        }
      }
    }
    if (next.length > 0) depth++;
    frontier = next;
  }

  return { depth, count: visited.size - 1 }; // -1 para não contar o próprio nó
}

/**
 * Heurística determinística para nível de impacto.
 *
 * HIGH:   ≥3 dependentes diretos  OU magnitude "heavy"  OU ≥2 módulos afetados
 * MEDIUM: 1-2 dependentes         OU magnitude "medium" OU ≥1 módulo afetado
 * LOW:    sem dependentes         OU magnitude "light"  (ou sem diff)
 */
function computeImpactLevel(
  dependentCount: number,
  affectedModuleCount: number,
  transitiveDepth: number,
  diffInfo?: SymbolDiffInfo,
): { impactLevel: ImpactSummary["impactLevel"]; impactScore: number } {
  let score = 0;

  // Dependentes diretos (0-40 pts)
  score += Math.min(dependentCount * 10, 40);

  // Módulos afetados (0-30 pts)
  score += Math.min(affectedModuleCount * 15, 30);

  // Profundidade transitiva (0-15 pts)
  score += Math.min(transitiveDepth * 5, 15);

  // Magnitude do diff (0-15 pts)
  if (diffInfo) {
    if (diffInfo.magnitude === "heavy") score += 15;
    else if (diffInfo.magnitude === "medium") score += 8;
    else score += 3;
  }

  const impactScore = Math.min(score, 100);

  let impactLevel: ImpactSummary["impactLevel"];
  if (impactScore >= 50) impactLevel = "HIGH";
  else if (impactScore >= 20) impactLevel = "MEDIUM";
  else impactLevel = "LOW";

  return { impactLevel, impactScore };
}
