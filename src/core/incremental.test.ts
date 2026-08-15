import { describe, expect, it } from "vitest";
import { buildGraph } from "./analyze/build";
import { applyFileRemovals, applyFiles, cacheFrom } from "./incremental";
import { hasChanges } from "./delta";
import { loadFixture, fixturePath } from "./test-helpers";
import type { MethodSymbol } from "./parse/types";

describe("applyFiles (specs/09 — re-parse incremental)", () => {
  it("batch com arquivo alterado: 1 snapshot, delta só do tocado, revisão sobe", async () => {
    const { files } = await loadFixture("basic");
    const root = fixturePath("basic");
    const first = buildGraph(files, root).graph;
    const cache = cacheFrom(files);

    const touched = files.find((f) => f.path.endsWith("PedidoService.ts"))!;
    const withMethod: MethodSymbol = { name: "listar", startLine: 20, endLine: 24 };
    const changed = {
      path: touched.path,
      symbols: { ...touched.symbols, methods: [...touched.symbols.methods, withMethod] },
    };

    const { graph, delta } = applyFiles(first, cache, [changed], root);
    expect(delta.revision).toBe(first.revision + 1);
    expect(delta.added.map((n) => n.id)).toEqual([`method:${touched.path}:class:${touched.path}:PedidoService:listar`]);
    expect(delta.removed).toEqual([]);
    // Nós não afetados mantêm IDs (D6).
    for (const node of first.nodes.values()) {
      if (node.id === delta.added[0]?.id) continue;
      expect(graph.nodes.get(node.id)).toBeDefined();
    }
  });

  it("re-parse com o mesmo conteúdo → no-op (mesmo snapshot, revisão não sobe)", async () => {
    const { files } = await loadFixture("basic");
    const root = fixturePath("basic");
    const first = buildGraph(files, root).graph;
    const cache = cacheFrom(files);

    const { graph, delta } = applyFiles(first, cache, [files[0]], root);
    expect(graph).toBe(first);
    expect(hasChanges(delta)).toBe(false);
    expect(graph.revision).toBe(first.revision);
  });

  it("deleção de arquivo → removed e arestas de membro", async () => {
    const { files } = await loadFixture("basic");
    const root = fixturePath("basic");
    const first = buildGraph(files, root).graph;
    const cache = cacheFrom(files);
    const gone = files.find((f) => f.path.endsWith("Pedido.ts"))!;

    const { graph, delta } = applyFileRemovals(first, cache, [gone.path], root);
    expect(delta.removed.some((id) => id.includes("Pedido"))).toBe(true);
    expect(delta.edgesRemoved.some((id) => id.startsWith("member:"))).toBe(true);
    expect(graph.nodes.get("project")).toBeDefined();
    // O módulo pedidos ainda existe (PedidoService continua lá).
    expect(graph.nodes.get("module:pedidos")).toBeDefined();
  });
});
