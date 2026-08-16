import { describe, expect, it } from "vitest";
import { parseQuery, queryGraph } from "./query";
import type { SerializedGraph } from "./serialize";

describe("core · graph query engine (M13)", () => {
  const sampleGraph: SerializedGraph = {
    projectRoot: "/test",
    revision: 1,
    nodes: [
      { kind: "project", id: "project", name: "app" },
      { kind: "module", id: "module:domain", name: "domain", path: "domain" },
      { kind: "class", id: "class:pedidos.ts:PedidoService", name: "PedidoService", file: "src/domain/pedidos.ts", startLine: 1 },
      { kind: "class", id: "class:auth.ts:AuthRepo", name: "AuthRepo", file: "src/auth/auth.ts", startLine: 1 },
      {
        kind: "method",
        id: "method:pedidos.ts:PedidoService:criar",
        name: "criar",
        file: "src/domain/pedidos.ts",
        startLine: 10,
        owner: "class:pedidos.ts:PedidoService",
      },
    ],
    edges: [
      { id: "m1", type: "member", from: "class:pedidos.ts:PedidoService", to: "method:pedidos.ts:PedidoService:criar" },
      { id: "c1", type: "call", from: "method:pedidos.ts:PedidoService:criar", to: "class:auth.ts:AuthRepo" },
    ],
    moduleEdges: [],
  };

  it("parseQuery decodifica filtros estruturados", () => {
    const filters = parseQuery("kind:class layer:domain coupling:>1 Pedido");
    expect(filters).toEqual([
      { field: "kind", op: "eq", value: "class" },
      { field: "layer", op: "eq", value: "domain" },
      { field: "coupling", op: "gt", value: "1" },
      { field: "name", op: "contains", value: "Pedido" },
    ]);
  });

  it("queryGraph filtra nós por kind e nome", () => {
    const res = queryGraph(sampleGraph, "kind:class Pedido");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("class:pedidos.ts:PedidoService");
  });

  it("queryGraph filtra nós por layer de domínio", () => {
    const res = queryGraph(sampleGraph, "layer:domain");
    expect(res.some((n) => n.id.includes("PedidoService"))).toBe(true);
  });
});
