import { beforeAll, describe, expect, it } from "vitest";
import { buildGraph } from "./analyze/build";
import { toJSON } from "./serialize";
import { fixturePath, loadFixture } from "./test-helpers";

let basicJson: ReturnType<typeof toJSON>;
let messyJson: ReturnType<typeof toJSON>;

beforeAll(async () => {
  const [b, m] = await Promise.all([loadFixture("basic"), loadFixture("messy")]);
  basicJson = toJSON(buildGraph(b.files, fixturePath("basic")).graph);
  messyJson = toJSON(buildGraph(m.files, fixturePath("messy")).graph);
});

describe("toJSON", () => {
  it("é determinístico e ordenado por ID", async () => {
    const first = JSON.stringify(basicJson);
    const second = JSON.stringify(await buildAgain("basic"));
    expect(first).toBe(second);
    const ids = basicJson.nodes.map((n) => n.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("agrega arestas de módulo (moduleEdges) com peso", () => {
    const gateways = basicJson.moduleEdges.filter((e) => e.type === "moduleEdge");
    const gatewayAuth = gateways.find((e) => e.from === "module:gateway" && e.to === "module:auth");
    const gatewayPedidos = gateways.find((e) => e.from === "module:gateway" && e.to === "module:pedidos");
    expect(gatewayAuth).toMatchObject({ type: "moduleEdge" });
    expect((gatewayAuth?.meta?.weight ?? 0)).toBeGreaterThanOrEqual(1);
    expect(gatewayPedidos).toBeDefined();
  });

  it("serializa corretamente os campos por tipo de nó", () => {
    const gateway = basicJson.nodes.find((n) => n.kind === "class" && n.name === "Gateway");
    expect(gateway).toMatchObject({ file: "src/gateway/Gateway.ts", startLine: 4 });
    const start = basicJson.nodes.find(
      (n): n is Extract<typeof n, { kind: "method" }> => n.kind === "method" && n.name === "start",
    );
    expect(start?.owner).toContain("Gateway");
  });

  it("produz grafo golden estável (fixture basic)", () => {
    expect(basicJson).toMatchSnapshot();
  });

  it("produz grafo golden estável (fixture messy)", () => {
    expect(messyJson).toMatchSnapshot();
  });
});

async function buildAgain(name: string) {
  const { files } = await loadFixture(name);
  return toJSON(buildGraph(files, fixturePath(name)).graph);
}
