/**
 * Portais (specs/05-rendering.md): nós tracejados na borda do canvas que
 * representam arestas que saem do foco atual. Clique navega lateralmente,
 * mantendo o nível (muda o focus, não o level):
 *  - nível 3: alvo é a CLASSE dona do método externo;
 *  - nível 4: alvo é o próprio método (seguir chamadas fora do método).
 */

import type { NodeId, ProjectConfig } from "./model/types";
import type { LayoutMap, Rect } from "./layout";
import type { SerializedGraph } from "./serialize";
import { nodeById, visibleNodes } from "./navigation";

export type Side = "left" | "right" | "top" | "bottom";

export interface Portal {
  id: NodeId;
  label: string;
  target: NodeId;
  x: number;
  y: number;
  side: Side;
}

const PORTAL_INSET = 14;

/**
 * Calcula portais dos níveis 3 (classe), 4 (método) e 5 (funções locais):
 * arestas `call` que ligam um nó visível a um nó fora do foco.
 * - Chamadas de entrada (incoming): lateral esquerda (`← Nome`).
 * - Chamadas de saída (outgoing): lateral direita (`→ Nome`).
 */
export function portalsOf(
  graph: SerializedGraph,
  nav: { level: 1 | 2 | 3 | 4 | 5; focus: NodeId | null },
  positions: LayoutMap,
  viewport: Rect,
  config: ProjectConfig = {},
): Portal[] {
  if (nav.level < 3 || !nav.focus) return [];

  const visible = new Set(visibleNodes(graph, nav, config).map((n) => n.id));
  const portals: Portal[] = [];
  const seen = new Set<NodeId>();

  for (const edge of graph.edges) {
    if (edge.type !== "call") continue;
    const isOutgoing = visible.has(edge.from) && !visible.has(edge.to);
    const isIncoming = visible.has(edge.to) && !visible.has(edge.from);
    if (!isOutgoing && !isIncoming) continue;

    const anchorId = isOutgoing ? edge.from : edge.to;
    const externalId = isOutgoing ? edge.to : edge.from;
    const anchor = positions.get(anchorId);
    if (!anchor) continue;

    const external = nodeById(graph, externalId);
    if (!external) continue;
    // Nível 3: o alvo é a classe dona do método externo; níveis 4/5: o próprio método.
    const targetId = nav.level === 3 && external.kind === "method" ? external.owner : external.id;
    if (seen.has(targetId)) continue;
    seen.add(targetId);

    const target = nodeById(graph, targetId);
    const label = `${isOutgoing ? "→" : "←"} ${target?.name ?? "?"}`;
    const side: Side = isOutgoing ? "right" : "left";

    const cy = anchor.y + anchor.height / 2;
    const x = side === "left" ? viewport.x + PORTAL_INSET : viewport.x + viewport.width - PORTAL_INSET;
    const y = Math.max(viewport.y + 32, Math.min(viewport.y + viewport.height - 32, cy));

    portals.push({ id: targetId, label, target: targetId, x, y, side });
  }

  // Ajusta espaçamento vertical para evitar sobreposição de múltiplos portais na mesma lateral
  const bySide = new Map<Side, Portal[]>();
  for (const p of portals) {
    const list = bySide.get(p.side) ?? [];
    list.push(p);
    bySide.set(p.side, list);
  }
  for (const list of bySide.values()) {
    list.sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (curr.y < prev.y + 32) {
        curr.y = Math.min(viewport.y + viewport.height - 32, prev.y + 32);
      }
    }
  }

  return portals;
}
