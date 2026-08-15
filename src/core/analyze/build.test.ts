import { beforeAll, describe, expect, it } from "vitest";
import { buildGraph, moduleOfPath, resolveImportTarget, type BuildStats } from "./build";
import type { CodeGraph, Node } from "../model/types";
import { fixturePath, loadFixture } from "../test-helpers";

let basicGraph: CodeGraph;
let messyGraph: CodeGraph;
let basicStats: BuildStats;
let messyStats: BuildStats;

beforeAll(async () => {
  const [b, m] = await Promise.all([loadFixture("basic"), loadFixture("messy")]);
  const basic = buildGraph(b.files, fixturePath("basic"));
  const messy = buildGraph(m.files, fixturePath("messy"));
  basicGraph = basic.graph;
  messyGraph = messy.graph;
  basicStats = basic.stats;
  messyStats = messy.stats;
});

const byName = (graph: CodeGraph, kind: Node["kind"], name: string) =>
  [...graph.nodes.values()].find((n) => n.kind === kind && n.name === name);

describe("buildGraph — basic", () => {
  it("cria nós de projeto, módulos, classes e métodos com IDs estáveis", () => {
    expect(basicGraph.nodes.get("project")).toMatchObject({ kind: "project" });
    expect(basicGraph.nodes.get("module:gateway")).toMatchObject({ kind: "module", path: "gateway" });
    expect(basicGraph.nodes.get("module:auth")).toMatchObject({ kind: "module", path: "auth" });
    expect(basicGraph.nodes.get("module:pedidos")).toMatchObject({ kind: "module", path: "pedidos" });
    expect(basicGraph.nodes.get("class:src/gateway/Gateway.ts:Gateway")).toMatchObject({
      kind: "class",
      file: "src/gateway/Gateway.ts",
      name: "Gateway",
    });
    expect(
      basicGraph.nodes.get(
        "method:src/pedidos/PedidoService.ts:class:src/pedidos/PedidoService.ts:PedidoService:criarPedido",
      ),
    ).toMatchObject({ kind: "method", name: "criarPedido" });
  });

  it("cria arestas member classe→método", () => {
    const cls = byName(basicGraph, "class", "PedidoService");
    const mtd = byName(basicGraph, "method", "criarPedido");
    expect(basicGraph.edges.has(`member:${cls!.id}:${mtd!.id}`)).toBe(true);
  });

  it("resolve imports entre classes (gateway → auth e pedidos)", () => {
    const gateway = byName(basicGraph, "class", "Gateway")!;
    const auth = byName(basicGraph, "class", "AuthService")!;
    const pedidoService = byName(basicGraph, "class", "PedidoService")!;
    expect(basicGraph.edges.has(`import:${gateway.id}:${auth.id}`)).toBe(true);
    expect(basicGraph.edges.has(`import:${gateway.id}:${pedidoService.id}`)).toBe(true);
  });

  it("resolve chamadas entre métodos (heurística por nome único)", () => {
    const start = byName(basicGraph, "method", "start")!;
    const login = byName(basicGraph, "method", "login")!;
    const criar = byName(basicGraph, "method", "criarPedido")!;
    const total = byName(basicGraph, "method", "calcularTotal")!;
    expect(basicGraph.edges.has(`call:${start.id}:${login.id}`)).toBe(true);
    expect(basicGraph.edges.has(`call:${start.id}:${criar.id}`)).toBe(true);
    expect(basicGraph.edges.has(`call:${criar.id}:${total.id}`)).toBe(true);
  });

  it("não deixa chamadas nem imports sem resolver (fixture limpa)", () => {
    expect(basicStats.callsUnresolved).toBe(0);
    expect(basicStats.importsUnresolved).toBe(0);
  });
});

describe("buildGraph — messy", () => {
  it("cria nó de arquivo (file-level class) para arquivos sem classe", () => {
    expect(messyGraph.nodes.get("class:src/utils.ts:utils")).toMatchObject({ kind: "class", file: "src/utils.ts" });
    expect(messyGraph.nodes.get("class:src/helpers/format.ts:format")).toMatchObject({ kind: "class" });
    expect(messyGraph.nodes.get("class:src/main.ts:main")).toMatchObject({ kind: "class" });
  });

  it("atribui funções de topo como métodos do nó de arquivo", () => {
    const utils = messyGraph.nodes.get("class:src/utils.ts:utils")!;
    expect(messyGraph.nodes.has(`method:src/utils.ts:${utils.id}:upper`)).toBe(true);
    expect(messyGraph.nodes.has(`method:src/utils.ts:${utils.id}:lower`)).toBe(true);
  });

  it("resolve chamadas e registra as não resolvidas", () => {
    expect(messyStats.callsResolved).toBe(3); // upper, title, upper
    // não resolvidas: slice/toUpperCase/toLowerCase (built-ins) e missingGlobal
    expect(messyStats.callsUnresolved).toBe(4);
    expect(messyStats.importsResolved).toBe(3);
    expect(messyStats.importsUnresolved).toBe(0);
  });
});

describe("buildGraph — helpers", () => {
  it("moduleOfPath agrupa por primeiro segmento relevante", () => {
    expect(moduleOfPath("src/gateway/Gateway.ts")).toBe("gateway");
    expect(moduleOfPath("src/helpers/format.ts")).toBe("helpers");
    expect(moduleOfPath("src/root.ts")).toBe("<root>");
    expect(moduleOfPath("utils.ts")).toBe("<root>");
    expect(moduleOfPath("lib/x/y.ts")).toBe("x");
  });

  it("resolveImportTarget tenta extensões e /index", () => {
    const files = new Set(["src/auth/AuthService.ts", "src/pedidos/index.ts"]);
    expect(resolveImportTarget("../auth/AuthService", "src/gateway/Gateway.ts", files)).toBe(
      "src/auth/AuthService.ts",
    );
    expect(resolveImportTarget("../pedidos", "src/gateway/Gateway.ts", files)).toBe("src/pedidos/index.ts");
    expect(resolveImportTarget("./nao-existe", "src/gateway/Gateway.ts", files)).toBeUndefined();
  });
});
