import { describe, expect, it } from "vitest";
import type { NodeId } from "./model/types";
import { cull, intersects } from "./viewport";
import { portalsOf, type Portal } from "./portals";
import type { Rect } from "./layout";
import { loadSerialized } from "./test-helpers";

describe("cull (specs/05-rendering.md)", () => {
  const rect = (id: string, x: number, y: number, width = 50, height = 50): [NodeId, Rect] => [
    id,
    { x, y, width, height },
  ];

  it("devolve apenas nós que intersectam o viewport", () => {
    const positions = new Map([rect("a", 0, 0), rect("b", 1000, 1000), rect("c", 400, 280), rect("d", 100, 60)]);
    const viewport: Rect = { x: 0, y: 0, width: 500, height: 300 };
    expect(cull(positions, viewport).sort()).toEqual(["a", "c", "d"].sort());
  });

  it("respeita margem extra", () => {
    const positions = new Map([rect("near", 490, 0), rect("far", 2000, 0)]);
    expect(cull(positions, { x: 0, y: 0, width: 500, height: 100 }, 0)).toEqual(["near"]);
    expect(cull(positions, { x: 0, y: 0, width: 500, height: 100 }, 40)).toEqual(["near"]);
    expect(cull(positions, { x: 0, y: 0, width: 500, height: 100 }, 2000)).toEqual(["near", "far"]);
  });

  it("intersects é simétrico", () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
    const c: Rect = { x: 100, y: 100, width: 10, height: 10 };
    expect(intersects(a, b)).toBe(true);
    expect(intersects(b, a)).toBe(true);
    expect(intersects(a, c)).toBe(false);
  });
});

describe("portalsOf", () => {
  it("nível 3: arestas para fora do foco viram portais; alvos deduplicados", async () => {
    const graph = await loadSerialized("basic");
    const start = graph.nodes.find((n) => n.kind === "method" && n.name === "start");
    expect(start).toBeDefined();
    const positions = new Map();
    positions.set(start!.id, { x: 100, y: 100, width: 200, height: 200 });
    const portals: Portal[] = portalsOf(
      graph,
      { level: 3, focus: "class:src/gateway/Gateway.ts:Gateway" },
      positions,
      { x: 0, y: 0, width: 800, height: 600 },
      {},
    );
    expect(portals.length).toBeGreaterThan(0);
    const targets = new Set(portals.map((p) => p.target));
    expect(targets.size).toBe(portals.length); // sem duplicados
    for (const p of portals) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.label).toBeTruthy();
    }
  });

  it("nível 4: método com chamadas externas gera portais para os métodos alvo", async () => {
    const graph = await loadSerialized("basic");
    const start = graph.nodes.find((n) => n.kind === "method" && n.name === "start");
    expect(start).toBeDefined();
    const positions = new Map();
    positions.set(start!.id, { x: 100, y: 100, width: 200, height: 200 });
    const portals: Portal[] = portalsOf(
      graph,
      { level: 4, focus: start!.id },
      positions,
      { x: 0, y: 0, width: 800, height: 600 },
      {},
    );
    // login (AuthService) e criarPedido (PedidoService) são alvos fora do foco.
    expect(portals.length).toBeGreaterThanOrEqual(2);
    expect(portals.some((p) => p.label.includes("login"))).toBe(true);
    expect(portals.some((p) => p.label.includes("criarPedido"))).toBe(true);
    for (const p of portals) {
      const t = graph.nodes.find((n) => n.id === p.target);
      expect(t?.kind).toBe("method"); // nível 4 pula direto para o método externo
    }
  });

  it("nível 1 não gera portais", async () => {
    const graph = await loadSerialized("basic");
    expect(portalsOf(graph, { level: 1, focus: null }, new Map(), { x: 0, y: 0, width: 100, height: 100 }, {}).length).toBe(0);
  });
});
