import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "./model/types";
import { layoutVisible } from "./layout";
import { loadSerialized } from "./test-helpers";
import { colorKey, couplingOf, domainOf, groupsFor, layerOf, widthFor } from "./lenses";
import { nodeById, visibleNodes } from "./navigation";

const CONFIG: ProjectConfig = {
  layerPaths: {
    api: ["gateway"],
    domain: ["pedidos"],
    infra: ["auth"],
  },
  domainPaths: {
    vendas: "pedidos",
    identidade: "auth",
    borda: "gateway",
  },
};

describe("layerOf (lente Camadas)", () => {
  it("usa layerPaths do config por módulo", async () => {
    const graph = await loadSerialized("basic");
    expect(layerOf(nodeById(graph, "module:gateway")!, CONFIG)).toBe("api");
    expect(layerOf(nodeById(graph, "module:pedidos")!, CONFIG)).toBe("domain");
    expect(layerOf(nodeById(graph, "module:auth")!, CONFIG)).toBe("infra");
  });

  it("classes/herdam a camada do módulo pelo arquivo", async () => {
    const graph = await loadSerialized("basic");
    const cls = graph.nodes.find((n) => n.kind === "class" && n.name === "PedidoService")!;
    expect(layerOf(cls, CONFIG)).toBe("domain");
  });

  it("regras padrão e fallback core", () => {
    const moduleNode = (path: string) => ({ id: "x", kind: "module" as const, name: path, path });
    expect(layerOf(moduleNode("domain/entities/User"))).toBe("domain");
    expect(layerOf(moduleNode("routes"))).toBe("api");
    expect(layerOf(moduleNode("random"))).toBe("core");
  });

  it("projeto é 'sistema'", () => {
    expect(layerOf({ id: "project", kind: "project", name: "x" })).toBe("sistema");
  });
});

describe("domainOf (lente Domínio)", () => {
  it("mapeia prefixo de caminho", async () => {
    const graph = await loadSerialized("basic");
    expect(domainOf(nodeById(graph, "module:pedidos")!, CONFIG)).toBe("vendas");
    expect(domainOf(nodeById(graph, "module:auth")!, CONFIG)).toBe("identidade");
  });

  it("sem config retorna 'outros'", async () => {
    const graph = await loadSerialized("basic");
    expect(domainOf(nodeById(graph, "module:gateway")!)).toBe("outros");
  });
});

describe("couplingOf (lente Acoplamento)", () => {
  it("módulo soma pesos das moduleEdges", async () => {
    const graph = await loadSerialized("basic");
    expect(couplingOf(graph, nodeById(graph, "module:gateway")!)).toBe(4); // 2 import + 2 call
    expect(couplingOf(graph, nodeById(graph, "module:auth")!)).toBe(2);
  });

  it("método conta calls in+out", async () => {
    const graph = await loadSerialized("basic");
    const start = graph.nodes.find((n) => n.kind === "method" && n.name === "start")!;
    expect(couplingOf(graph, start)).toBe(2);
  });
});

describe("colorKey — determinístico por (lens, node)", () => {
  it("golden por fixture", async () => {
    const graph = await loadSerialized("basic");
    const modules = graph.nodes.filter((n) => n.kind === "module");
    const keys = modules
      .map((n) => `${n.name}=${colorKey(n, "layers", CONFIG)}`)
      .sort();
    expect(keys).toEqual(["auth=layer:infra", "gateway=layer:api", "pedidos=layer:domain"]);
    expect(modules.map((n) => colorKey(n, "coupling", CONFIG, graph))).toEqual([
      "coup:1",
      "coup:2",
      "coup:1",
    ]);
  });
});

describe("groupsFor", () => {
  it("Camadas agrupa por camada, ordenado", async () => {
    const graph = await loadSerialized("basic");
    const groups = groupsFor(visibleNodes(graph, { level: 1, focus: null }, CONFIG), "layers", CONFIG);
    expect(groups.map((g) => g.label)).toEqual(["api", "domain", "infra"]);
    expect(groups.find((g) => g.label === "api")!.nodeIds).toEqual(["module:gateway"]);
  });

  it("outras lentes devolvem um único grupo", async () => {
    const graph = await loadSerialized("basic");
    expect(groupsFor(graph.nodes, "coupling", CONFIG).length).toBe(1);
  });
});

describe("widthFor", () => {
  it("acoplamento engrossa arestas para nós quentes", async () => {
    const graph = await loadSerialized("basic");
    const edge = graph.moduleEdges.find((e) => e.to === "module:auth")!;
    const width = widthFor(edge, "coupling", graph);
    expect(width).toBeGreaterThan(1);
  });
});

describe("regressão: lente NÃO muda layout (D7)", () => {
  it("posições idênticas para qualquer lens", async () => {
    const graph = await loadSerialized("basic");
    const a = layoutVisible(graph, { level: 1, focus: null }, 900, 700, CONFIG);
    const b = layoutVisible(graph, { level: 1, focus: null }, 900, 700, CONFIG);
    expect(a).toEqual(b);
  });
});
