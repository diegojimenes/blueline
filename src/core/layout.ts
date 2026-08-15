/**
 * Layout puro por nível (specs/05-rendering.md).
 *
 * Determinístico e testável sem canvas. Posições são cacheadas na UI por
 * `(level, focus)`; a lente nunca altera posição (D7 de produto).
 */

import type { Level, NodeId, ProjectConfig } from "./model/types";
import type { SerializedGraph } from "./serialize";
import { visibleNodes } from "./navigation";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutMap = Map<NodeId, Rect>;

const GRID_PADDING = 16;

/**
 * Posiciona os nós visíveis do nível atual em `width × height`.
 * - Nível 1 (módulos) e 2 (classes): grid por nome.
 * - Nível 3 (métodos): coluna por `startLine`. Nível 4: nó único centrado.
 */
export function layoutVisible(
  graph: SerializedGraph,
  nav: { level: Level; focus: NodeId | null },
  width: number,
  height: number,
  config: ProjectConfig = {},
): LayoutMap {
  const nodes = visibleNodes(graph, nav, config);
  const positions: LayoutMap = new Map();

  if (width <= 0 || height <= 0 || nodes.length === 0) return positions;

  if (nav.level === 3) {
    const rowHeight = height / nodes.length;
    for (let i = 0; i < nodes.length; i++) {
      positions.set(nodes[i].id, {
        x: GRID_PADDING,
        y: i * rowHeight + GRID_PADDING,
        width: Math.max(0, width - GRID_PADDING * 2),
        height: Math.max(0, rowHeight - GRID_PADDING * 2),
      });
    }
    return positions;
  }

  if (nav.level === 4) {
    positions.set(nodes[0].id, {
      x: GRID_PADDING,
      y: GRID_PADDING,
      width: Math.max(0, width - GRID_PADDING * 2),
      height: Math.max(0, height - GRID_PADDING * 2),
    });
    return positions;
  }

  const n = nodes.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const cellW = width / cols;
  const cellH = height / rows;
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(nodes[i].id, {
      x: col * cellW + GRID_PADDING,
      y: row * cellH + GRID_PADDING,
      width: Math.max(0, cellW - GRID_PADDING * 2),
      height: Math.max(0, cellH - GRID_PADDING * 2),
    });
  }
  return positions;
}
