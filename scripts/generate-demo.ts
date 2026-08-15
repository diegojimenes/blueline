/**
 * Gera o grafo de demonstração embutido no renderer (src/renderer/demo/demoGraph.ts)
 * a partir das fixtures. Uso: pnpm demo:graph
 *
 * Mantém o renderer browser-safe: o walk/parse (Node) roda apenas aqui, e a UI
 * consome o formato canônico (SerializedGraph) já serializado + um mapa de
 * fontes (demoSources) para o Inspector mostrar o código no nível 4.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadFixture } from "../src/core/test-helpers";
import { buildGraph } from "../src/core/analyze/build";
import { toJSON } from "../src/core/serialize";
import { walkProject } from "../src/core/walk";

async function main() {
  const root = "fixtures/basic";
  const { files } = await loadFixture("basic");
  const { graph } = buildGraph(files, "demo/basic");
  const json = toJSON(graph);

  const sources: Record<string, string> = {};
  for (const rel of walkProject(root)) {
    sources[rel] = readFileSync(join(root, rel), "utf8");
  }

  const source = [
    "// Gerado por scripts/generate-demo.ts (pnpm demo:graph). Não edite à mão.",
    'import type { SerializedGraph } from "../../core";',
    "",
    "export const demoGraph: SerializedGraph = " + JSON.stringify(json, null, 2) + ";",
    "",
    "export const demoSources: Record<string, string> = " + JSON.stringify(sources, null, 2) + ";",
    "",
  ].join("\n");
  mkdirSync("src/renderer/demo", { recursive: true });
  writeFileSync("src/renderer/demo/demoGraph.ts", source);
  console.log(
    `demoGraph gerado: ${json.nodes.length} nós, ${json.edges.length} arestas, ${Object.keys(sources).length} fontes`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
