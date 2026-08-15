import { useCallback, useEffect, useRef } from "react";
import {
  colorKey,
  cull,
  groupsFor,
  layoutVisible,
  portalsOf,
  visibleNodes,
  widthFor,
  type LayoutMap,
  type LensId,
  type NodeId,
  type Portal,
  type Rect,
  type SerializedGraph,
  type SerializedNode,
} from "../../core";
import { lensColor } from "../palette";
import { useStore } from "../store";

const NODE_RADIUS = 8;
const PORTAL_RADIUS = 14;

interface CtxState {
  positions: LayoutMap;
  portals: Portal[];
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
  const setLayout = useStore((s) => s.setLayout);
  const enterNode = useStore((s) => s.enterNode);
  const gotoId = useStore((s) => s.gotoId);
  const up = useStore((s) => s.up);
  const back = useStore((s) => s.back);
  const forward = useStore((s) => s.forward);
  const cycleLens = useStore((s) => s.cycleLens);
  const focusTerminal = useStore((s) => s.focusTerminal);
  const select = useStore((s) => s.setSelected);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CtxState>({ positions: new Map(), portals: [] });

  // Layout recalculado quando grafo, nível, foco ou tamanho mudam
  // (posições cacheadas no store — a lente nunca move nós, D7).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      if (!graph) {
        setLayout(null);
        return;
      }
      const { width, height } = el.getBoundingClientRect();
      setLayout(layoutVisible(graph, { level, focus }, width, height, useStore.getState().config));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph, level, focus, setLayout]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // jsdom / canvas indisponível

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const s = useStore.getState();
    const positions = s.layout;
    const viewport: Rect = { x: 0, y: 0, width, height };
    const portals =
      s.graph && positions && s.level === 3 && s.focus
        ? portalsOf(s.graph, { level: s.level, focus: s.focus }, positions, viewport, {})
        : [];
    ctxRef.current = { positions: positions ?? new Map(), portals };

    ctx.fillStyle = css("--bg");
    ctx.fillRect(0, 0, width, height);

    if (!s.graph || !positions || positions.size === 0) {
      ctx.fillStyle = css("--text-faint");
      ctx.font = "12px var(--font-mono)";
      ctx.textAlign = "center";
      ctx.fillText("nenhum projeto carregado — demo é carregada automaticamente", width / 2, height / 2);
      return;
    }

    const visible = new Set(cull(positions, viewport));

    const nodes = visibleNodes(s.graph, { level: s.level, focus: s.focus }, s.config);
    if (s.level === 1) {
      drawLensGroups(ctx, groupsFor(nodes, s.lens, s.config), positions, visible);
    }
    drawEdges(ctx, s.graph, positions, s.level, s.lens, visible);
    drawPortals(ctx, portals, visible);
    drawNodes(ctx, s.graph, positions, visible, {
      focus: s.focus,
      selected: s.selected,
      visited: s.visited,
      lens: s.lens,
      config: s.config,
    });
  }, []);

  useEffect(() => {
    draw();
  }, [draw, graph, level, focus, selected, visited, trail, lens, theme, layout]);

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
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hitTest = (p: { x: number; y: number }): { kind: "node"; id: NodeId } | { kind: "portal"; id: NodeId } | null => {
    const { positions, portals } = ctxRef.current;
    for (const [id, rect] of positions) {
      if (p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height) {
        return { kind: "node", id };
      }
    }
    for (const portal of portals) {
      const dx = p.x - portal.x;
      const dy = p.y - portal.y;
      if (dx * dx + dy * dy <= PORTAL_RADIUS * PORTAL_RADIUS) return { kind: "portal", id: portal.target };
    }
    return null;
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(pointOf(e));
    if (!hit) return;
    if (hit.kind === "portal") gotoId(hit.id);
    else enterNode(hit.id);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(pointOf(e));
    select(hit ? hit.id : null);
  };

  return (
    <section className="panel panel-canvas" aria-label="Canvas">
      <div className="panel-title">
        <Breadcrumb />
        <span className="badge">nível {level}</span>
      </div>
      <div className="panel-body canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="canvas"
          aria-label="Grafo"
          onDoubleClick={onDoubleClick}
          onClick={onClick}
        />
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

function drawLensGroups(
  ctx: CanvasRenderingContext2D,
  groups: ReturnType<typeof groupsFor>,
  positions: LayoutMap,
  visible: Set<NodeId>,
) {
  ctx.save();
  ctx.font = "10px var(--font-ui)";
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
    const pad = 10;
    const box = { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
    const color = lensColor(group.id);
    roundRect(ctx, box.x, box.y, box.width, box.height, 14);
    ctx.fillStyle = withAlpha(color, 0.06);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.35);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(group.label, box.x + 6, box.y + 12);
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
) {
  ctx.save();
  ctx.lineCap = "round";
  if (level === 1) {
    for (const edge of graph.moduleEdges) {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to || !visible.has(edge.from) || !visible.has(edge.to)) continue;
      ctx.strokeStyle = withAlpha(css("--accent-dim"), 0.55);
      ctx.lineWidth = widthFor(edge, lens, graph);
      ctx.beginPath();
      ctx.moveTo(from.x + from.width / 2, from.y + from.height / 2);
      ctx.lineTo(to.x + to.width / 2, to.y + to.height / 2);
      ctx.stroke();
    }
  } else if (level === 2) {
    ctx.strokeStyle = withAlpha(css("--text-muted"), 0.45);
    ctx.lineWidth = 1;
    for (const edge of graph.edges) {
      if (edge.type !== "import") continue;
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to || !visible.has(edge.from) || !visible.has(edge.to)) continue;
      ctx.beginPath();
      ctx.moveTo(from.x + from.width / 2, from.y + from.height / 2);
      ctx.lineTo(to.x + to.width / 2, to.y + to.height / 2);
      ctx.stroke();
    }
  } else if (level === 3) {
    ctx.strokeStyle = withAlpha(css("--text-muted"), 0.5);
    ctx.lineWidth = 1.2;
    for (const edge of graph.edges) {
      if (edge.type !== "call") continue;
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to || !visible.has(edge.from) || !visible.has(edge.to)) continue;
      const fx = from.x + from.width / 2;
      const fy = from.y + from.height / 2;
      const tx = to.x + to.width / 2;
      const ty = to.y + to.height / 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo((fx + tx) / 2, Math.min(fy, ty) - 30, tx, ty);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPortals(ctx: CanvasRenderingContext2D, portals: Portal[], visible: Set<NodeId>) {
  ctx.save();
  ctx.font = "11px var(--font-mono)";
  for (const p of portals) {
    if (visible.has(p.target)) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PORTAL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(css("--accent"), 0.08);
    ctx.fill();
    ctx.strokeStyle = css("--accent");
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css("--text-muted");
    ctx.textAlign = p.side === "right" ? "right" : "left";
    const labelX = p.side === "right" ? p.x - PORTAL_RADIUS - 6 : p.x + PORTAL_RADIUS + 6;
    ctx.fillText(p.label, labelX, p.y + 4);
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
    visited: Set<NodeId>;
    lens: LensId;
    config: Parameters<typeof colorKey>[2];
  },
) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const [id, rect] of positions) {
    if (!visible.has(id)) continue;
    const node = nodeById.get(id);
    if (!node) continue;
    drawNode(ctx, node, rect, {
      isFocus: id === state.focus,
      isSelected: id === state.selected,
      isVisited: state.visited.has(id),
      color: lensColor(colorKey(node, state.lens, state.config, graph)),
    });
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: SerializedNode,
  rect: Rect,
  state: { isFocus: boolean; isSelected: boolean; isVisited: boolean; color: string },
) {
  const kind = node.kind;
  ctx.save();
  if (state.isVisited) {
    ctx.shadowColor = withAlpha(css("--accent"), 0.25);
    ctx.shadowBlur = 12;
  }
  roundRect(ctx, rect.x, rect.y, rect.width, rect.height, NODE_RADIUS);
  ctx.fillStyle = withAlpha(state.color, 0.14);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = state.isFocus ? css("--accent") : state.color;
  ctx.lineWidth = state.isFocus ? 2.5 : 1.4;
  ctx.stroke();

  if (state.isSelected && !state.isFocus) {
    ctx.strokeStyle = withAlpha(css("--accent"), 0.6);
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const size = Math.min(rect.width, rect.height);
  if (size < 24) {
    ctx.restore();
    return;
  }

  ctx.fillStyle = css("--text");
  ctx.font = "600 12px var(--font-ui)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fitText(ctx, node.name, rect.width - 16), rect.x + rect.width / 2, rect.y + rect.height / 2);

  if (kind === "class" && rect.height >= 56) {
    ctx.fillStyle = css("--text-faint");
    ctx.font = "10px var(--font-mono)";
    ctx.fillText(
      fitText(ctx, shortFile(node.file), rect.width - 16),
      rect.x + rect.width / 2,
      rect.y + rect.height - 14,
    );
  }
  ctx.restore();
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

function shortFile(file: string | undefined): string {
  if (!file) return "";
  return file.split("/").slice(-2).join("/");
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
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
  if (hex.startsWith("#") && (hex.length === 4 || hex.length === 7)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}
