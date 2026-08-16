import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const TS_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|pyi)$/;

export const DEFAULT_IGNORE = ["node_modules", ".git", ".next", "dist", "build", "coverage", "target"];

/**
 * Lista arquivos TS/JS de um diretório, retornando caminhos relativos
 * normalizados (forward slashes) e ordenados. Usado em testes/CLI; no app,
 * o backend (Rust) faz a listagem e entrega os paths via IPC.
 */
export function walkProject(root: string, ignore: string[] = DEFAULT_IGNORE): string[] {
  const result: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || ignore.includes(entry)) continue;
      const abs = join(dir, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        visit(abs);
      } else if (TS_EXT.test(entry)) {
        result.push(relative(root, abs).split(sep).join("/"));
      }
    }
  };
  visit(root);
  return result.sort();
}
