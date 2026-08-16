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

import type { LensId, Level, NodeId, ProjectConfig } from "./model/types";
import type { SerializedGraph } from "./serialize";
import { visibleNodes } from "./navigation";
import { domainOf, layerOf } from "./lenses";

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
export type PortSide = "top" | "bottom" | "left" | "right";

export interface EdgePortResult {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  fromSide?: PortSide;
  toSide?: PortSide;
}

export interface BezierCurve {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  arrowAngle: number;
  fromSide: PortSide;
  toSide: PortSide;
}

/**
 * Endpoints de uma aresta sobre os perímetros de origem/destino: a linha sai
 * da borda do retângulo de origem e entra na borda do destino (não corta o
 * interior do nó, evitando sobrepor texto).
 */
export function edgePorts(from: Rect, to: Rect): EdgePortResult {
  const fc = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const tc = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  if ((dx === 0 && dy === 0) || from.width <= 0 || from.height <= 0) {
    return { fx: fc.x, fy: fc.y, tx: tc.x, ty: tc.y, fromSide: "right", toSide: "left" };
  }
  const sx = dx / (from.width / 2);
  const sy = dy / (from.height / 2);
  const k = 1 / Math.max(Math.abs(sx), Math.abs(sy));

  let fromSide: PortSide = "right";
  if (Math.abs(sx) > Math.abs(sy)) {
    fromSide = dx > 0 ? "right" : "left";
  } else {
    fromSide = dy > 0 ? "bottom" : "top";
  }

  let toSide: PortSide = "left";
  if (Math.abs(sx) > Math.abs(sy)) {
    toSide = dx > 0 ? "left" : "right";
  } else {
    toSide = dy > 0 ? "top" : "bottom";
  }

  return {
    fx: fc.x + dx * k,
    fy: fc.y + dy * k,
    tx: tc.x - dx * k,
    ty: tc.y - dy * k,
    fromSide,
    toSide,
  };
}

/**
 * Calcula uma curva Bezier cúbica fluida entre dois nós, projetando os
 * pontos de controle para fora da face de acoplamento para evitar cortes.
 */
export function bezierEdgeShape(from: Rect, to: Rect, curvatureOffset: number = 0): BezierCurve {
  const { fx, fy, tx, ty, fromSide = "right", toSide = "left" } = edgePorts(from, to);
  const dist = Math.hypot(tx - fx, ty - fy);
  const minHandle = Math.min(Math.max(dist * 0.45, 24), 160);

  // Vetores de projeção dos pontos de controle baseados nas faces
  let cx1 = fx;
  let cy1 = fy;
  let cx2 = tx;
  let cy2 = ty;

  switch (fromSide) {
    case "right":
      cx1 += minHandle;
      break;
    case "left":
      cx1 -= minHandle;
      break;
    case "bottom":
      cy1 += minHandle;
      break;
    case "top":
      cy1 -= minHandle;
      break;
  }

  switch (toSide) {
    case "right":
      cx2 += minHandle;
      break;
    case "left":
      cx2 -= minHandle;
      break;
    case "bottom":
      cy2 += minHandle;
      break;
    case "top":
      cy2 -= minHandle;
      break;
  }

  if (curvatureOffset !== 0) {
    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    cx1 += nx * curvatureOffset;
    cy1 += ny * curvatureOffset;
    cx2 += nx * curvatureOffset;
    cy2 += ny * curvatureOffset;
  }

  // Ângulo final da tangente no ponto de destino (para desenhar a ponta de seta)
  const arrowAngle = Math.atan2(ty - cy2, tx - cx2);

  return {
    fx,
    fy,
    tx,
    ty,
    cx1,
    cy1,
    cx2,
    cy2,
    arrowAngle,
    fromSide,
    toSide,
  };
}

const GRID_PADDING = 24;
const MODULE_MAX_W = 210;
const MODULE_MAX_H = 84;
const CLASS_MAX_W = 220;
const CLASS_MAX_H = 86;
const METHOD_ROW_H = 42;
const METHOD_GAP = 8;
const FOCUS_MAX_H = 110;

/**
 * Posiciona os nós visíveis do nível atual em `width × height`.
 * - Nível 1 (módulos) e 2 (classes): grid com tamanho consistente e canais generosos para arestas.
 * - Nível 3 (métodos): coluna por `startLine`, altura consistente e legível.
 * - Nível 4: nó único centrado.
 */
export function layoutVisible(
  graph: SerializedGraph,
  nav: { level: Level; focus: NodeId | null; lens?: LensId },
  width: number,
  height: number,
  config: ProjectConfig = {},
): LayoutMap {
  let nodes = visibleNodes(graph, nav, config);
  
  // Reordena os módulos no Nível 1 para agrupá-los conforme a lente ativa,
  // evitando que as caixas de agrupamento visual se sobreponham.
  if (nav.level === 1 && nav.lens) {
    nodes = [...nodes].sort((a, b) => {
      let ga = "", gb = "";
      if (nav.lens === "layers") {
        ga = layerOf(a, config);
        gb = layerOf(b, config);
      } else if (nav.lens === "domain") {
        ga = domainOf(a, config);
        gb = domainOf(b, config);
      }
      if (ga < gb) return -1;
      if (ga > gb) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  const positions: LayoutMap = new Map();

  if (width <= 0 || height <= 0 || nodes.length === 0) return positions;

  if (nav.level === 3) {
    const n = nodes.length;
    const rowH = METHOD_ROW_H;
    const totalH = n * rowH + (n - 1) * METHOD_GAP;
    const y0 = totalH < height - GRID_PADDING * 2 ? Math.max(GRID_PADDING, (height - totalH) / 2) : GRID_PADDING;
    // Gutter dedicado nas laterais para portais
    const sideGutter = width > 520 ? Math.min(150, Math.max(120, Math.round(width * 0.16))) : GRID_PADDING;
    const maxCardW = Math.min(Math.max(180, width - sideGutter * 2), 600);
    const x0 = Math.max(sideGutter, (width - maxCardW) / 2);
    for (let i = 0; i < n; i++) {
      positions.set(nodes[i].id, {
        x: x0,
        y: y0 + i * (rowH + METHOD_GAP),
        width: maxCardW,
        height: rowH,
      });
    }
    return positions;
  }

  if (nav.level === 4) {
    const w = Math.min(Math.max(0, width - GRID_PADDING * 2), 680);
    const h = Math.min(Math.max(0, height - GRID_PADDING * 2), FOCUS_MAX_H);
    positions.set(nodes[0].id, {
      x: Math.max(GRID_PADDING, (width - w) / 2),
      y: Math.max(GRID_PADDING, (height - h) / 2),
      width: w,
      height: h,
    });
    return positions;
  }

  const n = nodes.length;
  const isModule = nav.level === 1;
  const cellMaxW = isModule ? MODULE_MAX_W : CLASS_MAX_W;
  const cellMaxH = isModule ? MODULE_MAX_H : CLASS_MAX_H;
  const gapX = isModule ? 28 : 22;
  const gapY = isModule ? 24 : 20;

  const usableW = Math.max(0, width - GRID_PADDING * 2);
  const usableH = Math.max(0, height - GRID_PADDING * 2);
  const cols = Math.min(n, Math.max(1, Math.floor((usableW + gapX) / (cellMaxW + gapX))));
  const rows = Math.ceil(n / cols);
  const cellW = cellMaxW;
  const cellH = cellMaxH;
  const blockW = cols * cellW + (cols - 1) * gapX;
  const blockH = rows * cellH + (rows - 1) * gapY;
  const x0 = blockW < usableW ? Math.max(GRID_PADDING, (width - blockW) / 2) : GRID_PADDING;
  const y0 = blockH < usableH ? Math.max(GRID_PADDING, (height - blockH) / 2) : GRID_PADDING;

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(nodes[i].id, {
      x: x0 + col * (cellW + gapX),
      y: y0 + row * (cellH + gapY),
      width: cellW,
      height: cellH,
    });
  }
  return positions;
}
