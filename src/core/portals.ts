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
 * arestas `call` que ligam um nó visível a um nó fora do foco. Cada alvo
 * externo vira um portal posicionado na borda mais próxima do nó de origem.
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

    const cx = anchor.x + anchor.width / 2;
    const cy = anchor.y + anchor.height / 2;
    const { x, y, side } = portalSpot(cx, cy, viewport);
    portals.push({ id: targetId, label, target: targetId, x, y, side });
  }

  return portals;
}

function portalSpot(cx: number, cy: number, viewport: Rect): { x: number; y: number; side: Side } {
  const left = cx - viewport.x;
  const right = viewport.x + viewport.width - cx;
  const top = cy - viewport.y;
  const bottom = viewport.y + viewport.height - cy;

  const min = Math.min(left, right, top, bottom);

  if (min === left) return { x: viewport.x + PORTAL_INSET, y: cy, side: "left" };
  if (min === right) return { x: viewport.x + viewport.width - PORTAL_INSET, y: cy, side: "right" };
  if (min === top) return { x: cx, y: viewport.y + PORTAL_INSET, side: "top" };
  return { x: cx, y: viewport.y + viewport.height - PORTAL_INSET, side: "bottom" };
}
