import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, type BuildFileInput } from "./analyze/build";
import { toJSON, type SerializedGraph } from "./serialize";
import { createNodeTypeScriptParser } from "./parse/node";
import type { Parser } from "./parse/types";
import { walkProject } from "./walk";

const FIXTURES_ROOT = fileURLToPath(new URL("../../fixtures", import.meta.url));

export function fixturePath(name: string): string {
  return join(FIXTURES_ROOT, name);
}

/** Carrega uma fixture: lista arquivos TS/JS e parseia tudo (memória/disco de leitura, permitido por specs/11). */
export async function loadFixture(name: string): Promise<{ parser: Parser; files: BuildFileInput[] }> {
  const root = fixturePath(name);
  const paths = walkProject(root);
  const parser = await createNodeTypeScriptParser();
  const files: BuildFileInput[] = [];
  for (const rel of paths) {
    const content = readFileSync(join(root, rel), "utf8");
    files.push({ path: rel, symbols: parser.parseFile(rel, content) });
  }
  return { parser, files };
}

/** Grafo serializado de uma fixture (formato canônico usado pela UI). */
export async function loadSerialized(name: string): Promise<SerializedGraph> {
  const { files } = await loadFixture(name);
  return toJSON(buildGraph(files, fixturePath(name)).graph);
}
