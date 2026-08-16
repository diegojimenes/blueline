import { useCallback, useEffect, useRef, useState } from "react";
import {
  bezierEdgeShape,
  colorKey,
  cull,
  groupsFor,
  layoutVisible,
  moduleOfPath,
  portalsOf,
  visibleNodes,
  widthFor,
  type LayoutMap,
  type LensId,
  type NodeId,
  type Portal,
  type ProjectDiffSummary,
  type Rect,
  type SerializedGraph,
  type SerializedNode,
} from "../../core";
import { lensColor } from "../palette";
import { useStore } from "../store";
import { AIReviewBar } from "./AIReviewBar";

const NODE_RADIUS = 10;
const PORTAL_W = 126;
const PORTAL_H = 26;
/** Duração do pulso dos nós afetados por mudança externa (M5). */
const FLASH_MS = 1500;

interface CtxState {
  positions: LayoutMap;
  portals: Portal[];
}

interface DrawnEdgeInfo {
  from: NodeId;
  to: NodeId;
  type: string;
  weight?: number;
  curve: ReturnType<typeof bezierEdgeShape>;
  label: string;
}

interface HoveredEdgeTooltip {
  label: string;
  x: number;
  y: number;
}

export function Canvas() {
  const graph = useStore((s) => s.graph);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const lens = useStore((s) => s.lens);
  const selected = useStore((s) => s.selected);
  const visited = useStore((s) => s.visited);
  const trail = useStore((s) => s.trail);
  const theme = useStore((s) => s.theme);
  const layout = useStore((s) => s.layout);
  const config = useStore((s) => s.config);
  const gitDirty = useStore((s) => s.gitDirty);
  const diffSummary = useStore((s) => s.diffSummary);
  const reviewedNodes = useStore((s) => s.reviewedNodes);
  const setLayout = useStore((s) => s.setLayout);
  const enterNode = useStore((s) => s.enterNode);
  const gotoId = useStore((s) => s.gotoId);
  const up = useStore((s) => s.up);
  const back = useStore((s) => s.back);
  const forward = useStore((s) => s.forward);
  const setLens = useStore((s) => s.setLens);
  const cycleLens = useStore((s) => s.cycleLens);
  const focusTerminal = useStore((s) => s.focusTerminal);
  const select = useStore((s) => s.setSelected);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CtxState>({ positions: new Map(), portals: [] });
  const drawnEdgesRef = useRef<DrawnEdgeInfo[]>([]);
  const [hoveredNode, setHoveredNode] = useState<NodeId | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdgeTooltip | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // Reseta o pan ao trocar de nível ou foco
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [level, focus]);

  // Layout recalculado quando grafo, nível, foco ou tamanho mudam
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !graph) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) return;

    const nav = { level, focus };
    const next = layoutVisible(graph, nav, w, h, {});
    setLayout(next);
  }, [graph, level, focus, setLayout]);

  // Render principal do canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawBlueprintGrid(ctx, w, h);

    const s = useStore.getState();
    if (!s.graph) {
      drawEmpty(ctx, w, h);
      ctxRef.current = { positions: new Map(), portals: [] };
      drawnEdgesRef.current = [];
      return;
    }

    const positions = s.layout ?? layoutVisible(s.graph, { level: s.level, focus: s.focus }, w, h, s.config);
    const viewport: Rect = { x: -pan.x, y: -pan.y, width: w, height: h };
    const portals =
      s.level >= 3 && s.focus
        ? portalsOf(s.graph, { level: s.level, focus: s.focus }, positions, viewport, {})
        : [];

    ctxRef.current = { positions: positions ?? new Map(), portals };

    if (!positions || positions.size === 0) {
      drawEmpty(ctx, w, h);
      drawnEdgesRef.current = [];
      return;
    }

    const visible = new Set(cull(positions, viewport));

    ctx.save();
    ctx.translate(pan.x, pan.y);

    // Nós afetados pela última mudança externa
    let flashIds: Set<NodeId> | null = null;
    let flashT = 0;
    if (s.flash) {
      const elapsed = Date.now() - s.flash.at;
      if (elapsed < FLASH_MS) {
        flashIds = new Set(s.flash.ids);
        flashT = elapsed / FLASH_MS;
      }
    }

    const nodes = visibleNodes(s.graph, { level: s.level, focus: s.focus }, s.config);
    if (s.level === 1 && s.lens === "layers") {
      drawLensGroups(ctx, groupsFor(nodes, s.lens, s.config), positions, visible);
    }

    const activeNode = s.selected ?? hoveredNode;

    // Conectores elegantes com curvas Bezier, setas e realce interativo
    drawnEdgesRef.current = drawEdges(ctx, s.graph, positions, s.level, s.lens, visible, activeNode);

    // Cards estruturados ricos com suporte a AST diff e magnitude
    drawNodes(ctx, s.graph, positions, visible, {
      focus: s.focus,
      selected: s.selected,
      hovered: hoveredNode,
      visited: s.visited,
      lens: s.lens,
      config: s.config,
      flash: flashIds,
      flashT,
      gitDirty: s.gitDirty,
      diffSummary: s.diffSummary,
      reviewedNodes: s.reviewedNodes,
    });

    // Portais redesenhados (Jump Pills)
    drawPortals(ctx, portals, visible);

    ctx.restore();
  }, [hoveredNode, pan]);

  useEffect(() => {
    draw();
  }, [draw, graph, level, focus, selected, visited, trail, lens, theme, layout, gitDirty, diffSummary, reviewedNodes, hoveredNode, pan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
      const alt = e.altKey;
      if (e.key === "Escape" && !typing) {
        up();
      } else if (alt && e.key === "ArrowLeft" && !typing) {
        e.preventDefault();
        back();
      } else if (alt && e.key === "ArrowRight" && !typing) {
        e.preventDefault();
        forward();
      } else if (e.key === "l" && !typing && !alt && !e.ctrlKey && !e.metaKey) {
        cycleLens();
      } else if (e.key === "/" && !typing && !alt && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        focusTerminal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [up, back, forward, cycleLens, focusTerminal]);

  const pointOf = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - pan.x,
      y: e.clientY - rect.top - pan.y,
    };
  };

  const hitTest = (p: { x: number; y: number }): { kind: "node"; id: NodeId } | { kind: "portal"; id: NodeId } | null => {
    const { positions, portals } = ctxRef.current;
    for (const [id, rect] of positions) {
      if (p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height) {
        return { kind: "node", id };
      }
    }
    for (const portal of portals) {
      const px = portal.side === "right" ? portal.x - PORTAL_W : portal.x;
      const py = portal.y - PORTAL_H / 2;
      if (p.x >= px && p.x <= px + PORTAL_W && p.y >= py && p.y <= py + PORTAL_H) {
        return { kind: "portal", id: portal.target };
      }
    }
    return null;
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    setPan((prev) => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY,
    }));
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = pointOf(e);
    const hit = hitTest(p);
    if (!hit || e.button === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      didDragRef.current = false;
    }
  };

  const onMouseUp = () => {
    isDraggingRef.current = false;
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(pointOf(e));
    if (!hit) {
      up();
      return;
    }
    if (hit.kind === "portal") gotoId(hit.id);
    else enterNode(hit.id);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const hit = hitTest(pointOf(e));
    select(hit ? hit.id : null);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      if (Math.abs(newX - pan.x) > 2 || Math.abs(newY - pan.y) > 2) {
        didDragRef.current = true;
      }
      setPan({ x: newX, y: newY });
      return;
    }

    const p = pointOf(e);
    const hit = hitTest(p);
    setHoveredNode(hit && hit.kind === "node" ? hit.id : null);

    if (hit) {
      setHoveredEdge(null);
      return;
    }

    // Detecção de proximidade com arestas
    let closestEdge: DrawnEdgeInfo | null = null;
    let minDistance = 9; // tolerância em pixels

    for (const edge of drawnEdgesRef.current) {
      const d = distToCurve(p.x, p.y, edge.curve);
      if (d < minDistance) {
        minDistance = d;
        closestEdge = edge;
      }
    }

    if (closestEdge) {
      setHoveredEdge({
        label: closestEdge.label,
        x: p.x + pan.x,
        y: p.y + pan.y,
      });
    } else {
      setHoveredEdge(null);
    }
  };

  const onMouseLeave = () => {
    isDraggingRef.current = false;
    setHoveredNode(null);
    setHoveredEdge(null);
  };

  const hasPanned = pan.x !== 0 || pan.y !== 0;

  return (
    <section className="panel panel-canvas" aria-label="Canvas">
      <div className="panel-title">
        <Breadcrumb />

        {/* Seletor Visual de Lentes (Descoberta Direta) */}
        <div className="canvas-lens-pills" role="toolbar" aria-label="Seletor de Lentes">
          <button
            type="button"
            className={`lens-pill ${lens === "layers" ? "active" : ""}`}
            onClick={() => setLens("layers")}
            title="Lente de Camadas Arquiteturais"
          >
            🏗️ Camadas
          </button>
          <button
            type="button"
            className={`lens-pill ${lens === "coupling" ? "active" : ""}`}
            onClick={() => setLens("coupling")}
            title="Lente de Acoplamento Estrutural"
          >
            🔗 Acoplamento
          </button>
          <button
            type="button"
            className={`lens-pill ${lens === "domain" ? "active" : ""}`}
            onClick={() => setLens("domain")}
            title="Lente de Domínio de Negócio"
          >
            🏷️ Domínio
          </button>
          <span className="lens-shortcut-hint" title="Atalho de teclado para alternar lente">[L]</span>
        </div>

        <div className="canvas-header-actions">
          <span className="badge badge-level">nível {level}</span>
          {level > 1 && (
            <button className="btn btn-up" title="voltar um nível (duplo clique no vazio / Esc)" onClick={up}>
              ↑ voltar
            </button>
          )}
        </div>
      </div>
      <AIReviewBar />
      <div className="panel-body canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="canvas"
          style={{ cursor: hoveredNode ? "pointer" : isDraggingRef.current ? "grabbing" : "grab" }}
          aria-label="Grafo"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onDoubleClick={onDoubleClick}
          onClick={onClick}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />

        {/* Botão para resetar pan se o usuário arrastar a visualização */}
        {hasPanned && (
          <button
            type="button"
            className="btn-canvas-reset-pan"
            onClick={() => setPan({ x: 0, y: 0 })}
            title="Centralizar visualização do grafo"
          >
            ↺ Centralizar
          </button>
        )}

        {/* Legenda Visual Dinâmica */}
        {(lens === "coupling" || lens === "layers" || lens === "domain") && (
          <div className="coupling-canvas-legend" aria-label="Legenda de Cores">
            <span className="legend-title">
              {lens === "coupling" ? "Acoplamento:" : lens === "layers" ? "Camadas:" : "Domínios:"}
            </span>
            {lens === "coupling" ? (
              <>
                <span className="legend-item"><span className="legend-dot" style={{ background: "#10b981" }} /> 0 (Baixo)</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: "#06b6d4" }} /> 1-2 (Moderado)</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b" }} /> 3-4 (Alto)</span>
                <span className="legend-item"><span className="legend-dot" style={{ background: "#ef4444" }} /> 5+ (Crítico)</span>
              </>
            ) : graph ? (
              (() => {
                const nodes = visibleNodes(graph, { level, focus }, config);
                const groups = groupsFor(nodes, lens, config).slice(0, 8); // Max 8 items
                if (groups.length === 0) return <span className="legend-item" style={{opacity: 0.5}}>(Nenhum no nível atual)</span>;
                return groups.map((g) => (
                  <span key={g.id} className="legend-item">
                    <span className="legend-dot" style={{ background: lensColor(g.id) }} /> {g.label}
                  </span>
                ));
              })()
            ) : null}
          </div>
        )}

        {/* Tooltip Flutuante de Arestas */}
        {hoveredEdge && (
          <div
            className="canvas-edge-tooltip"
            style={{ left: hoveredEdge.x, top: hoveredEdge.y }}
          >
            {hoveredEdge.label}
          </div>
        )}
      </div>
    </section>
  );
}

function Breadcrumb() {
  const trail = useStore((s) => s.trail);
  const graph = useStore((s) => s.graph);
  const gotoId = useStore((s) => s.gotoId);
  const up = useStore((s) => s.up);
  const level = useStore((s) => s.level);

  if (!graph) return <span className="crumb-crumb">—</span>;

  return (
    <span className="crumbs" role="navigation" aria-label="Trilha">
      {level > 1 && (
        <button type="button" className="crumb-btn crumb-up" onClick={up} title="subir um nível (Esc)">
          ↑
        </button>
      )}
      {trail.map((id, i) => {
        const node = graph.nodes.find((n) => n.id === id);
        const label = node?.name ?? id;
        const last = i === trail.length - 1;
        return (
          <span key={id} className="crumb-item">
            {i > 0 && <span className="crumb-sep">›</span>}
            {last ? (
              <span className="crumb-crumb crumb-current">{label}</span>
            ) : (
              <button type="button" className="crumb-btn" onClick={() => gotoId(id)}>
                {label}
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Fundo com textura de grade blueprint para sensação de profundidade e escala */
function drawBlueprintGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = css("--bg");
  ctx.fillRect(0, 0, width, height);

  const dotSpacing = 28;
  ctx.fillStyle = withAlpha(css("--text-muted"), 0.08);

  for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
    for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
}

function drawEmpty(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = css("--text-faint");
  ctx.font = "13px var(--font-mono)";
  ctx.textAlign = "center";
  ctx.fillText("nenhum projeto aberto — use “Abrir” (ou `open <diretório>` no terminal)", width / 2, height / 2);
}

function drawLensGroups(
  ctx: CanvasRenderingContext2D,
  groups: ReturnType<typeof groupsFor>,
  positions: LayoutMap,
  visible: Set<NodeId>,
) {
  ctx.save();
  ctx.font = "600 11px var(--font-ui)";
  const pad = 10;
  for (const group of groups) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of group.nodeIds) {
      const r = positions.get(id);
      if (!r || !visible.has(id)) continue;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }
    if (minX === Infinity) continue;
    const box = { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
    const color = lensColor(group.id);

    roundRect(ctx, box.x, box.y, box.width, box.height, 14);
    ctx.fillStyle = withAlpha(color, 0.04);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Chip de cabeçalho da camada
    const label = `CAMADA: ${group.label.toUpperCase()}`;
    const labelW = ctx.measureText(label).width + 16;
    const chipX = box.x + 8;
    const chipY = box.y - 10;
    roundRect(ctx, chipX, chipY, labelW, 18, 5);
    ctx.fillStyle = withAlpha(color, 0.18);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, chipX + 8, chipY + 9);
  }
  ctx.restore();
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  graph: SerializedGraph,
  positions: LayoutMap,
  level: number,
  lens: LensId,
  visible: Set<NodeId>,
  activeNode: NodeId | null,
): DrawnEdgeInfo[] {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const resultEdges: DrawnEdgeInfo[] = [];
  const edgesToDraw: { from: NodeId; to: NodeId; type: string; weight?: number }[] = [];

  if (level === 1) {
    for (const edge of graph.moduleEdges) {
      edgesToDraw.push({ from: edge.from, to: edge.to, type: "moduleEdge", weight: widthFor(edge, lens, graph) });
    }
  } else if (level === 2) {
    for (const edge of graph.edges) {
      if (edge.type === "import") edgesToDraw.push({ from: edge.from, to: edge.to, type: "import" });
    }
  } else if (level === 3 || level === 5) {
    for (const edge of graph.edges) {
      if (edge.type === "call") edgesToDraw.push({ from: edge.from, to: edge.to, type: "call" });
    }
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const edge of edgesToDraw) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to || !visible.has(edge.from) || !visible.has(edge.to)) continue;

    const isOutgoing = activeNode === edge.from;
    const isIncoming = activeNode === edge.to;
    const isFocused = isOutgoing || isIncoming;
    const isAnyActive = activeNode !== null;

    const curve = bezierEdgeShape(from, to);

    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    const fromName = fromNode ? fromNode.name : edge.from.split(":").pop() ?? edge.from;
    const toName = toNode ? toNode.name : edge.to.split(":").pop() ?? edge.to;

    let edgeLabel = `${fromName} → ${toName}`;
    if (edge.type === "call") {
      edgeLabel = `⚡ Chamada: ${fromName}() → ${toName}()`;
    } else if (edge.type === "import") {
      edgeLabel = `🏛️ Importação: ${fromName} → ${toName}`;
    } else if (edge.type === "moduleEdge") {
      edgeLabel = `📦 Acoplamento: ${fromName} → ${toName} (peso ${edge.weight ?? 1})`;
    }

    resultEdges.push({
      from: edge.from,
      to: edge.to,
      type: edge.type,
      weight: edge.weight,
      curve,
      label: edgeLabel,
    });

    // Cores e estilização de acordo com tipo e foco
    let strokeColor = "#38bdf8"; // Ciano padrão
    let alpha = 0.28;
    let lineWidth = 1.4;

    if (edge.type === "call") {
      strokeColor = "#34d399"; // Esmeralda para chamadas
      alpha = 0.35;
    } else if (edge.type === "moduleEdge") {
      strokeColor = "#818cf8"; // Índigo para módulos
      alpha = 0.32;
    }

    if (isAnyActive) {
      if (isOutgoing) {
        strokeColor = "#10b981"; // Esmeralda brilhante
        alpha = 0.95;
        lineWidth = 2.2;
      } else if (isIncoming) {
        strokeColor = "#a855f7"; // Violeta brilhante
        alpha = 0.95;
        lineWidth = 2.2;
      } else {
        alpha = 0.08; // Esmaece nós não relacionados
        lineWidth = 1.0;
      }
    }

    ctx.strokeStyle = withAlpha(strokeColor, alpha);
    ctx.lineWidth = lineWidth;

    // Desenha a curva Bezier fluida
    ctx.beginPath();
    ctx.moveTo(curve.fx, curve.fy);
    ctx.bezierCurveTo(curve.cx1, curve.cy1, curve.cx2, curve.cy2, curve.tx, curve.ty);
    ctx.stroke();

    // Seta direcional triangular elegante no destino
    drawArrowHead(ctx, curve.tx, curve.ty, curve.arrowAngle, strokeColor, alpha, isFocused ? 7 : 5);
  }

  ctx.restore();
  return resultEdges;
}

function distToCurve(px: number, py: number, curve: ReturnType<typeof bezierEdgeShape>): number {
  let minDist = Infinity;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const inv = 1 - t;
    const x = inv * inv * inv * curve.fx + 3 * inv * inv * t * curve.cx1 + 3 * inv * t * t * curve.cx2 + t * t * t * curve.tx;
    const y = inv * inv * inv * curve.fy + 3 * inv * inv * t * curve.cy1 + 3 * inv * t * t * curve.cy2 + t * t * t * curve.ty;
    const d = Math.hypot(px - x, py - y);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  alpha: number,
  size: number = 6,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 1.5, -size * 0.8);
  ctx.lineTo(-size * 1.5, size * 0.8);
  ctx.closePath();

  ctx.fillStyle = withAlpha(color, alpha);
  ctx.fill();
  ctx.restore();
}

function drawPortals(ctx: CanvasRenderingContext2D, portals: Portal[], visible: Set<NodeId>) {
  ctx.save();
  ctx.font = "600 11px var(--font-mono)";

  for (const p of portals) {
    if (visible.has(p.target)) continue;

    const px = p.side === "right" ? p.x - PORTAL_W : p.x;
    const py = p.y - PORTAL_H / 2;

    // Linha sutil conectando o portal à borda
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = withAlpha(css("--accent"), 0.35);
    ctx.lineWidth = 1;
    if (p.side === "right") {
      ctx.moveTo(px, p.y);
      ctx.lineTo(px - 14, p.y);
    } else {
      ctx.moveTo(px + PORTAL_W, p.y);
      ctx.lineTo(px + PORTAL_W + 14, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Pílula com fundo sólido e borda de destaque
    roundRect(ctx, px, py, PORTAL_W, PORTAL_H, 6);
    ctx.fillStyle = withAlpha(css("--bg-panel"), 0.95);
    ctx.fill();
    ctx.strokeStyle = withAlpha(css("--accent"), 0.75);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = css("--accent");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fitText(ctx, p.label, PORTAL_W - 16), px + PORTAL_W / 2, py + PORTAL_H / 2);
  }
  ctx.restore();
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  graph: SerializedGraph,
  positions: LayoutMap,
  visible: Set<NodeId>,
  state: {
    focus: NodeId | null;
    selected: NodeId | null;
    hovered: NodeId | null;
    visited: Set<NodeId>;
    lens: LensId;
    config: Parameters<typeof colorKey>[2];
    flash: Set<NodeId> | null;
    flashT: number;
    gitDirty: string[];
    diffSummary?: ProjectDiffSummary | null;
    reviewedNodes?: Set<NodeId>;
  },
) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const [id, rect] of positions) {
    if (!visible.has(id)) continue;
    const node = nodeById.get(id);
    if (!node) continue;

    const diffInfo = state.diffSummary?.symbols.get(node.id);
    const isDirty =
      Boolean(diffInfo) ||
      (node.kind === "module"
        ? state.gitDirty.some((f) => moduleOfPath(f, state.config) === node.path)
        : "file" in node && state.gitDirty.includes(node.file));

    const isReviewed = state.reviewedNodes?.has(node.id) ?? false;

    drawNodeCard(ctx, node, rect, graph, {
      isFocus: id === state.focus,
      isSelected: id === state.selected,
      isHovered: id === state.hovered,
      isVisited: state.visited.has(id),
      color: lensColor(colorKey(node, state.lens, state.config, graph)),
      flash: state.flash?.has(id) ?? false,
      flashT: state.flashT,
      isDirty,
      isReviewed,
      diffInfo,
    });
  }
}

function drawNodeCard(
  ctx: CanvasRenderingContext2D,
  node: SerializedNode,
  rect: Rect,
  graph: SerializedGraph,
  state: {
    isFocus: boolean;
    isSelected: boolean;
    isHovered: boolean;
    isVisited: boolean;
    color: string;
    flash: boolean;
    flashT: number;
    isDirty: boolean;
    isReviewed: boolean;
    diffInfo?: import("../../core").SymbolDiffInfo;
  },
) {
  ctx.save();

  // Sombra suave para elevação
  if (state.isSelected || state.isHovered) {
    ctx.shadowColor = withAlpha(state.color, 0.35);
    ctx.shadowBlur = 14;
  } else if (state.isVisited) {
    ctx.shadowColor = withAlpha(css("--accent"), 0.15);
    ctx.shadowBlur = 6;
  }

  // Fundo do card
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, NODE_RADIUS);
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  gradient.addColorStop(0, withAlpha(state.color, state.isSelected ? 0.22 : 0.12));
  gradient.addColorStop(1, withAlpha(state.color, state.isSelected ? 0.10 : 0.04));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Borda do card com diferenciação de magnitude
  let borderColor = withAlpha(state.color, 0.45);
  let lineWidth = 1.2;

  if (state.isReviewed) {
    borderColor = "#10b981"; // Verde esmeralda para revisado
    lineWidth = 1.6;
  } else if (state.isDirty) {
    if (state.diffInfo?.magnitude === "heavy") {
      borderColor = "#ef4444"; // Vermelho vibrante para churn pesado
      lineWidth = 2.4;
    } else if (state.diffInfo?.magnitude === "light") {
      borderColor = "#fbbf24"; // Amarelo suave para leve
      lineWidth = 1.5;
    } else {
      borderColor = "#f59e0b"; // Âmbar para médio / padrão
      lineWidth = 2.0;
    }
  } else if (state.isFocus || state.isSelected) {
    borderColor = css("--accent");
    lineWidth = 2.2;
  } else if (state.isHovered) {
    borderColor = withAlpha(state.color, 0.9);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Anel de pulso da IA / Mudança Externa (M5)
  if (state.flash) {
    ctx.strokeStyle = withAlpha("#10b981", 0.9 * (1 - state.flashT));
    ctx.lineWidth = 4;
    roundRect(ctx, rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, NODE_RADIUS + 2);
    ctx.stroke();
  }

  // Conteúdo estruturado por Kind
  if (node.kind === "module") {
    drawModuleContent(ctx, node, rect, graph, state);
  } else if (node.kind === "class") {
    drawClassContent(ctx, node, rect, graph, state);
  } else if (node.kind === "method" || node.kind === "local") {
    drawMethodContent(ctx, node, rect, graph, state);
  }

  ctx.restore();
}

function drawModuleContent(
  ctx: CanvasRenderingContext2D,
  node: Extract<SerializedNode, { kind: "module" }>,
  rect: Rect,
  graph: SerializedGraph,
  state: {
    color: string;
    isDirty: boolean;
    isReviewed: boolean;
    diffInfo?: import("../../core").SymbolDiffInfo;
  },
) {
  const headerH = 24;
  roundTopRect(ctx, rect.x, rect.y, rect.width, headerH, NODE_RADIUS);
  ctx.fillStyle = withAlpha(state.color, 0.16);
  ctx.fill();

  let curRight = rect.x + rect.width - 8;
  if (state.isReviewed) {
    curRight = drawBadgeRight(ctx, curRight, rect.y + 4, "✓ REVISADO", "#10b981") - 6;
  } else if (state.isDirty) {
    curRight = drawBadgeRight(ctx, curRight, rect.y + 4, "⚡ MODIFICADO", "#f59e0b") - 6;
  }

  // Ícone e Nome do Módulo
  ctx.fillStyle = css("--text");
  ctx.font = "700 12px var(--font-ui)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const maxTitleW = curRight - (rect.x + 8);
  ctx.fillText(`📦 ${fitText(ctx, node.name, maxTitleW)}`, rect.x + 8, rect.y + headerH / 2);

  // Métricas do Módulo
  const classCount = graph.nodes.filter(
    (n) => n.kind === "class" && moduleOfPath(n.file, useStore.getState().config) === node.path,
  ).length;

  ctx.fillStyle = css("--text-muted");
  ctx.font = "11px var(--font-mono)";
  ctx.fillText(`🏛️ ${classCount} classe${classCount === 1 ? "" : "s"}`, rect.x + 10, rect.y + headerH + 18);

  // Caminho curto do módulo
  ctx.fillStyle = css("--text-faint");
  ctx.font = "10px var(--font-mono)";
  ctx.fillText(fitText(ctx, node.path, rect.width - 20), rect.x + 10, rect.y + rect.height - 10);
}

function drawClassContent(
  ctx: CanvasRenderingContext2D,
  node: Extract<SerializedNode, { kind: "class" }>,
  rect: Rect,
  graph: SerializedGraph,
  state: {
    color: string;
    isDirty: boolean;
    isReviewed: boolean;
    diffInfo?: import("../../core").SymbolDiffInfo;
  },
) {
  const headerH = 24;
  roundTopRect(ctx, rect.x, rect.y, rect.width, headerH, NODE_RADIUS);
  ctx.fillStyle = withAlpha(state.color, 0.14);
  ctx.fill();

  let curRight = rect.x + rect.width - 8;
  if (state.isReviewed) {
    curRight = drawBadgeRight(ctx, curRight, rect.y + 4, "✓ REVISADO", "#10b981") - 6;
  } else if (state.isDirty) {
    const total = state.diffInfo?.totalLinesChanged;
    const mag = state.diffInfo?.magnitude;
    let badgeText = "MODIFICADO";
    let badgeColor = "#f59e0b";

    if (mag === "heavy" && total) {
      badgeText = `⚡ +${total}L`;
      badgeColor = "#ef4444";
    } else if (mag === "light" && total) {
      badgeText = `${total}L`;
      badgeColor = "#fbbf24";
    } else if (total) {
      badgeText = `${total}L`;
      badgeColor = "#f59e0b";
    }

    curRight = drawBadgeRight(ctx, curRight, rect.y + 4, badgeText, badgeColor) - 6;
  }

  if (node.isSecondary) {
    curRight = drawBadgeRight(ctx, curRight, rect.y + 4, "INTERNA", "#818cf8") - 6;
  }

  // Ícone e Nome da Classe
  ctx.fillStyle = css("--text");
  ctx.font = "700 12px var(--font-ui)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const maxTitleW = curRight - (rect.x + 8);
  ctx.fillText(`🏛️ ${fitText(ctx, node.name, maxTitleW)}`, rect.x + 8, rect.y + headerH / 2);

  // Métodos
  const methodCount = graph.nodes.filter((n) => n.kind === "method" && n.owner === node.id).length;
  ctx.fillStyle = css("--text-muted");
  ctx.font = "11px var(--font-mono)";
  ctx.fillText(`⚡ ${methodCount} método${methodCount === 1 ? "" : "s"}  :L${node.startLine}`, rect.x + 10, rect.y + headerH + 18);

  // Arquivo / Contexto de declaração
  ctx.fillStyle = node.isSecondary ? "#a5b4fc" : css("--text-faint");
  ctx.font = "10px var(--font-mono)";
  const fileLabel = node.isSecondary ? `interna em ${shortFile(node.file)}` : shortFile(node.file);
  ctx.fillText(fitText(ctx, fileLabel, rect.width - 20), rect.x + 10, rect.y + rect.height - 10);
}

function drawMethodContent(
  ctx: CanvasRenderingContext2D,
  node: Extract<SerializedNode, { kind: "method" | "local" }>,
  rect: Rect,
  graph: SerializedGraph,
  state: {
    color: string;
    isDirty: boolean;
    isReviewed: boolean;
    diffInfo?: import("../../core").SymbolDiffInfo;
  },
) {
  // Barra lateral esquerda colorida
  let barColor = state.color;
  if (state.isReviewed) barColor = "#10b981";
  else if (state.diffInfo?.magnitude === "heavy") barColor = "#ef4444";
  else if (state.diffInfo?.magnitude === "light") barColor = "#fbbf24";
  else if (state.isDirty) barColor = "#f59e0b";

  roundLeftRect(ctx, rect.x, rect.y, 4, rect.height, NODE_RADIUS);
  ctx.fillStyle = barColor;
  ctx.fill();

  const isLocal = node.kind === "local";
  const icon = isLocal ? "🔀" : "⚡";

  // Linha e Chamadas à direita
  const outCalls = graph.edges.filter((e) => e.type === "call" && e.from === node.id).length;
  const inCalls = graph.edges.filter((e) => e.type === "call" && e.to === node.id).length;

  ctx.font = "10px var(--font-mono)";
  let rightText = `:L${node.startLine}`;
  if (outCalls > 0 || inCalls > 0) {
    rightText = `↓${outCalls} ↑${inCalls}  :L${node.startLine}`;
  }
  const rightTextW = ctx.measureText(rightText).width;

  ctx.fillStyle = css("--text-faint");
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(rightText, rect.x + rect.width - 8, rect.y + rect.height / 2);

  let curRight = rect.x + rect.width - 8 - rightTextW - 8;

  // Badge de Alteração / Revisão
  if (state.isReviewed) {
    curRight = drawBadgeRight(ctx, curRight, rect.y + (rect.height - 15) / 2, "✓ REVISADO", "#10b981") - 6;
  } else if (state.isDirty) {
    const total = state.diffInfo?.totalLinesChanged;
    const mag = state.diffInfo?.magnitude;
    let badgeText = "MODIFICADO";
    let badgeColor = "#f59e0b";

    if (mag === "heavy" && total) {
      badgeText = `⚡ +${total}L`;
      badgeColor = "#ef4444";
    } else if (mag === "light" && total) {
      badgeText = `${total}L`;
      badgeColor = "#fbbf24";
    } else if (total) {
      badgeText = `${total}L`;
      badgeColor = "#f59e0b";
    }

    curRight = drawBadgeRight(ctx, curRight, rect.y + (rect.height - 15) / 2, badgeText, badgeColor) - 6;
  }

  // Nome do Método
  ctx.fillStyle = css("--text");
  ctx.font = "600 12px var(--font-mono)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const maxTitleW = curRight - (rect.x + 12);
  ctx.fillText(`${icon} ${fitText(ctx, node.name, maxTitleW)}`, rect.x + 12, rect.y + rect.height / 2);
}

function drawBadgeRight(ctx: CanvasRenderingContext2D, rightX: number, y: number, text: string, color: string): number {
  ctx.save();
  ctx.font = "700 8px var(--font-ui)";
  const textW = ctx.measureText(text).width;
  const w = textW + 10;
  const h = 15;
  const x = rightX - w;

  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.fill();
  ctx.strokeStyle = withAlpha(color, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
  return x;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function roundLeftRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function shortFile(file: string | undefined): string {
  if (!file) return "";
  return file.split("/").slice(-2).join("/");
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith("#")) {
    const clean = hex.slice(1);
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return hex;
}
