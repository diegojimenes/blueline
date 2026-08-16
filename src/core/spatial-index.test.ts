import { describe, expect, it } from "vitest";
import { SpatialIndex, type PositionedNode } from "./spatial-index";

describe("core · spatial index (M12)", () => {
  it("filtra nós visíveis fora da viewport com precisão e performance", () => {
    const index = new SpatialIndex(100);

    const nodes: PositionedNode[] = [
      { node: { kind: "class", id: "n1", name: "N1", file: "a.ts", startLine: 1 }, x: 10, y: 10, width: 50, height: 50 },
      { node: { kind: "class", id: "n2", name: "N2", file: "b.ts", startLine: 1 }, x: 500, y: 500, width: 50, height: 50 },
      { node: { kind: "class", id: "n3", name: "N3", file: "c.ts", startLine: 1 }, x: 1000, y: 1000, width: 50, height: 50 },
    ];

    index.insertAll(nodes);

    // Viewport cobrindo apenas n1
    const visible1 = index.query({ x: 0, y: 0, width: 100, height: 100 });
    expect(visible1.map((p) => p.node.id)).toEqual(["n1"]);

    // Viewport cobrindo n2
    const visible2 = index.query({ x: 450, y: 450, width: 200, height: 200 });
    expect(visible2.map((p) => p.node.id)).toEqual(["n2"]);

    // Viewport cobrindo tudo
    const visibleAll = index.query({ x: 0, y: 0, width: 2000, height: 2000 });
    expect(visibleAll.length).toBe(3);
  });
});
