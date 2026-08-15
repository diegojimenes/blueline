/**
 * Culling de viewport (specs/05-rendering.md).
 *
 * Função pura: recebe geometria e devolve o subconjunto exato de nós que
 * intersectam o retângulo visível. Testável sem canvas.
 */

import type { NodeId } from "./model/types";
import type { LayoutMap, Rect } from "./layout";

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** IDs dos nós cujos retângulos intersectam o viewport (com margem opcional). */
export function cull(positions: LayoutMap, viewport: Rect, margin = 0): NodeId[] {
  const expanded: Rect = {
    x: viewport.x - margin,
    y: viewport.y - margin,
    width: viewport.width + margin * 2,
    height: viewport.height + margin * 2,
  };
  const visible: NodeId[] = [];
  for (const [id, rect] of positions) {
    if (intersects(rect, expanded)) visible.push(id);
  }
  return visible;
}
