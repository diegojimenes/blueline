import { describe, expect, it } from "vitest";
import { buildGraph } from "./analyze/build";
import { computeDelta, hasChanges } from "./delta";
import { loadFixture, fixturePath } from "./test-helpers";
import type { MethodSymbol } from "./parse/types";

describe("computeDelta (specs/09-live-updates.md, fase 4)", () => {
  it("snapshots iguais → delta vazio e filesTouched []", async () => {
    const { files } = await loadFixture("basic");
    const { graph } = buildGraph(files, fixturePath("basic"));
    const delta = computeDelta(graph, graph, "parseIncremental");
    expect(hasChanges(delta)).toBe(false);
    expect(delta.filesTouched).toEqual([]);
  });

  it("método novo → added (nó) com fileTouched do arquivo", async () => {
    const { files } = await loadFixture("basic");
    const before = buildGraph(files, fixturePath("basic")).graph;
    const touched = files.find((f) => f.path.endsWith("PedidoService.ts"))!;
    const withMethod: MethodSymbol = { name: "listar", startLine: 20, endLine: 24 };
    const afterFiles = files.map((f) =>
      f.path === touched.path ? { ...f, symbols: { ...f.symbols, methods: [...f.symbols.methods, withMethod] } } : f,
    );
    const after = buildGraph(afterFiles, fixturePath("basic")).graph;
    after.revision = 1;

    const delta = computeDelta(before, after, "parseIncremental");
    expect(delta.added.map((n) => n.id)).toEqual([
      `method:${touched.path}:class:${touched.path}:PedidoService:listar`,
    ]);
    expect(delta.filesTouched).toEqual([touched.path]);
    expect(delta.cause).toBe("parseIncremental");
  });

  it("classe removida → removed inclui classe, métodos e arestas dependentes", async () => {
    const { files } = await loadFixture("basic");
    const before = buildGraph(files, fixturePath("basic")).graph;
    const touched = files.find((f) => f.path.endsWith("AuthService.ts"))!;
    const afterFiles = files.map((f) =>
      f.path === touched.path ? { ...f, symbols: { ...f.symbols, classes: [], methods: [] } } : f,
    );
    const after = buildGraph(afterFiles, fixturePath("basic")).graph;
    after.revision = 1;

    const delta = computeDelta(before, after, "parseIncremental");
    expect(delta.removed.some((id) => id.includes("AuthService"))).toBe(true);
    expect(delta.removed.some((id) => id.startsWith("method:"))).toBe(true);
    expect(delta.edgesRemoved.some((id) => id.startsWith("member:"))).toBe(true);
    expect(delta.filesTouched).toEqual([touched.path]);
  });

  it("startLine alterado → changed (mesmo ID, conteúdo diferente)", async () => {
    const { files } = await loadFixture("basic");
    const before = buildGraph(files, fixturePath("basic")).graph;
    const touched = files.find((f) => f.path.endsWith("Pedido.ts"))!;
    const afterFiles = files.map((f) =>
      f.path === touched.path
        ? {
            ...f,
            symbols: {
              ...f.symbols,
              classes: f.symbols.classes.map((c) => ({ ...c, startLine: c.startLine + 5 })),
            },
          }
        : f,
    );
    const after = buildGraph(afterFiles, fixturePath("basic")).graph;
    after.revision = 1;

    const delta = computeDelta(before, after, "parseIncremental");
    expect(delta.changed.length).toBeGreaterThan(0);
    expect(delta.changed.every((n) => n.kind === "class")).toBe(true);
    expect(delta.removed).toEqual([]);
  });
});
