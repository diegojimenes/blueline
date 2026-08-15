import { describe, expect, it } from "vitest";
import type { NavigationState } from "./model/types";
import { edgePorts, layoutVisible } from "./layout";
import { loadSerialized } from "./test-helpers";

const EMPTY_NAV: NavigationState = { focus: null, level: 1, lens: "layers", trail: [], selected: null, visited: new Set() };

describe("layoutVisible (specs/05-rendering.md)", () => {
  it("nível 1: grid determinístico dos módulos", async () => {
    const graph = await loadSerialized("basic");
    const positions = layoutVisible(graph, EMPTY_NAV, 1000, 800, {});
    const ids = [...positions.keys()];
    expect(ids).toEqual([...ids].sort());
    expect(ids.length).toBe(3); // auth, gateway, pedidos
    const rect = positions.get(ids[0])!;
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.x).toBeGreaterThanOrEqual(0);
  });

  it("nível 2: grid das classes do módulo em foco", async () => {
    const graph = await loadSerialized("basic");
    const positions = layoutVisible(graph, { ...EMPTY_NAV, level: 2, focus: "module:pedidos" }, 600, 600, {});
    expect([...positions.keys()].sort()).toEqual(
      ["class:src/pedidos/Pedido.ts:Pedido", "class:src/pedidos/PedidoService.ts:PedidoService"].sort(),
    );
  });

  it("nível 3: coluna por startLine", async () => {
    const graph = await loadSerialized("messy");
    const classId = "class:src/utils.ts:utils";
    const positions = layoutVisible(graph, { ...EMPTY_NAV, level: 3, focus: classId }, 600, 600, {});
    const nodes = graph.nodes.filter(
      (n): n is Extract<typeof n, { kind: "method" }> => n.kind === "method" && n.owner === classId,
    );
    expect(nodes.length).toBe(2); // lower, upper
    const byLine = [...nodes].sort((a, b) => a.startLine - b.startLine);
    expect([...positions.keys()]).toEqual(byLine.map((n) => n.id));
    const [first, second] = byLine;
    expect(positions.get(first.id)!.y).toBeLessThan(positions.get(second.id)!.y);
  });

  it("determinístico: mesma entrada, mesmas coordenadas", async () => {
    const graph = await loadSerialized("basic");
    const a = layoutVisible(graph, EMPTY_NAV, 900, 700, {});
    const b = layoutVisible(graph, EMPTY_NAV, 900, 700, {});
    expect(a).toEqual(b);
  });

  it("retorna vazio com geometria zero", async () => {
    const graph = await loadSerialized("basic");
    expect(layoutVisible(graph, EMPTY_NAV, 0, 0, {}).size).toBe(0);
  });
});

describe("edgePorts — arestas não cortam o interior do nó", () => {
  const from = { x: 0, y: 0, width: 100, height: 50 };
  const to = { x: 200, y: 100, width: 100, height: 50 };

  it("origem termina no perímetro (borda direita) e destino na borda esquerda", () => {
    const { fx, fy, tx } = edgePorts(from, to);
    expect(fx).toBeCloseTo(100); // borda direita do `from`
    expect(tx).toBeCloseTo(200); // borda esquerda do `to`
    expect(fy).toBeGreaterThanOrEqual(from.y);
    expect(fy).toBeLessThanOrEqual(from.y + from.height);
  });

  it("vertical: origem na borda de baixo, destino na borda de cima", () => {
    const above = { x: 0, y: 0, width: 50, height: 50 };
    const below = { x: 0, y: 200, width: 50, height: 50 };
    const { fy, ty } = edgePorts(above, below);
    expect(fy).toBeCloseTo(50);
    expect(ty).toBeCloseTo(200);
  });

  it("sobreposição de centros não explode (fallback para centro)", () => {
    const { fx, fy } = edgePorts(from, from);
    expect(fx).toBe(50);
    expect(fy).toBe(25);
  });
});
