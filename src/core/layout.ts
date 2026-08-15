/**
 * Layout puro por nível (specs/05-rendering.md).
 *
 * Determinístico e testável sem canvas. Posições são cacheadas na UI por
 * `(level, focus)`; a lente nunca altera posição (D7 de produto).
 *
 * Tamanhos são limitados e o bloco é centralizado: em telas grandes os nós
 * não viram caixas gigantes (célula com tamanho máximo), e em telas pequenas
 * o grid encolhe para caber.
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

/**
 * Endpoints de uma aresta sobre os perímetros de origem/destino: a linha sai
 * da borda do retângulo de origem e entra na borda do destino (não corta o
 * interior do nó, evitando sobrepor texto).
 */
export function edgePorts(from: Rect, to: Rect): { fx: number; fy: number; tx: number; ty: number } {
  const fc = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const tc = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  if ((dx === 0 && dy === 0) || from.width <= 0 || from.height <= 0) {
    return { fx: fc.x, fy: fc.y, tx: tc.x, ty: tc.y };
  }
  const sx = dx / (from.width / 2);
  const sy = dy / (from.height / 2);
  const k = 1 / Math.max(Math.abs(sx), Math.abs(sy));
  return {
    fx: fc.x + dx * k,
    fy: fc.y + dy * k,
    tx: tc.x - dx * k,
    ty: tc.y - dy * k,
  };
}

const GRID_PADDING = 16;
const CELL_GAP = 8;
const CELL_MAX_W = 280;
const CELL_MAX_H = 150;
const METHOD_ROW_MAX_H = 110;
const FOCUS_MAX_H = 170;

/**
 * Posiciona os nós visíveis do nível atual em `width × height`.
 * - Nível 1 (módulos) e 2 (classes): grid por nome, células com tamanho máximo.
 * - Nível 3 (métodos): coluna por `startLine`, linhas com altura máxima.
 * - Nível 4: nó único centrado.
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
    const n = nodes.length;
    const rowH = Math.min(height / n, METHOD_ROW_MAX_H);
    const blockH = n * rowH;
    const y0 = Math.max(GRID_PADDING, (height - blockH) / 2);
    for (let i = 0; i < n; i++) {
      positions.set(nodes[i].id, {
        x: GRID_PADDING,
        y: y0 + i * rowH,
        width: Math.max(0, width - GRID_PADDING * 2),
        height: Math.max(0, rowH - CELL_GAP),
      });
    }
    return positions;
  }

  if (nav.level === 4) {
    const w = Math.max(0, width - GRID_PADDING * 2);
    const h = Math.min(Math.max(0, height - GRID_PADDING * 2), FOCUS_MAX_H);
    positions.set(nodes[0].id, {
      x: GRID_PADDING,
      y: Math.max(GRID_PADDING, (height - h) / 2),
      width: w,
      height: h,
    });
    return positions;
  }

  const n = nodes.length;
  const usableW = Math.max(0, width - GRID_PADDING * 2);
  const usableH = Math.max(0, height - GRID_PADDING * 2);
  const cols = Math.min(n, Math.max(1, Math.floor(usableW / CELL_MAX_W)));
  const rows = Math.ceil(n / cols);
  const cellW = Math.min(usableW / cols, CELL_MAX_W);
  const cellH = Math.min(usableH / rows, CELL_MAX_H);
  const blockW = cols * cellW;
  const blockH = rows * cellH;
  const x0 = Math.max(GRID_PADDING, (width - blockW) / 2);
  const y0 = Math.max(GRID_PADDING, (height - blockH) / 2);

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(nodes[i].id, {
      x: x0 + col * cellW,
      y: y0 + row * cellH,
      width: Math.max(0, cellW - CELL_GAP),
      height: Math.max(0, cellH - CELL_GAP),
    });
  }
  return positions;
}
