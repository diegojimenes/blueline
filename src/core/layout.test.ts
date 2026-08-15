import { describe, expect, it } from "vitest";
import type { NavigationState } from "./model/types";
import { layoutVisible } from "./layout";
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
