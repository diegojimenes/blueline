/**
 * Gera o grafo de demonstração embutido no renderer (src/renderer/demo/demoGraph.ts)
 * a partir das fixtures. Uso: pnpm demo:graph
 *
 * Mantém o renderer browser-safe: o walk/parse (Node) roda apenas aqui, e a UI
 * consome o formato canônico (SerializedGraph) já serializado.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadFixture } from "../src/core/test-helpers";
import { buildGraph } from "../src/core/analyze/build";
import { toJSON } from "../src/core/serialize";

async function main() {
  const { files } = await loadFixture("basic");
  const { graph } = buildGraph(files, "demo/basic");
  const json = toJSON(graph);
  const source = [
    "// Gerado por scripts/generate-demo.ts (pnpm demo:graph). Não edite à mão.",
    'import type { SerializedGraph } from "../../core";',
    "",
    "export const demoGraph: SerializedGraph = " + JSON.stringify(json, null, 2) + ";",
    "",
  ].join("\n");
  mkdirSync("src/renderer/demo", { recursive: true });
  writeFileSync("src/renderer/demo/demoGraph.ts", source);
  console.log(`demoGraph gerado: ${json.nodes.length} nós, ${json.edges.length} arestas, ${json.moduleEdges.length} moduleEdges`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
