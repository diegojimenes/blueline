import type { CodeGraph, Node, NodeId } from "./model/types";
import type { SerializedGraph } from "./serialize";

export interface SearchResult {
  id: NodeId;
  name: string;
  kind: Node["kind"];
  canonicalPath: string;
  file?: string;
  startLine?: number;
  score: number;
}

export interface SearchOptions {
  limit?: number;
}

/**
 * Monta o caminho canônico legível do nó para busca e exibição.
 */
export function getCanonicalPath(node: Node, allNodes?: Map<NodeId, Node> | Node[]): string {
  switch (node.kind) {
    case "project":
      return node.name || "projeto";
    case "module":
      return node.path || node.name;
    case "class":
      return `${node.file}:${node.name}`;
    case "method": {
      if (allNodes) {
        const ownerNode = Array.isArray(allNodes)
          ? allNodes.find((n) => n.id === node.owner)
          : allNodes.get(node.owner);
        if (ownerNode && ownerNode.kind === "class") {
          return `${node.file}:${ownerNode.name}.${node.name}`;
        }
      }
      return `${node.file}:${node.name}`;
    }
    case "local":
      return `${node.file}:${node.name}`;
  }
}

/**
 * Calcula a pontuação fuzzy de um texto em relação a uma consulta.
 * Retorna número positivo se houver match, ou 0 se não der match.
 */
export function scoreFuzzy(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Match exato
  if (t === q) return 1000;

  // Prefixo exato
  if (t.startsWith(q)) return 800 + (q.length / t.length) * 100;

  // Substring contígua
  const subIdx = t.indexOf(q);
  if (subIdx !== -1) {
    const positionPenalty = Math.min(50, subIdx * 5);
    return 600 - positionPenalty + (q.length / t.length) * 50;
  }

  // CamelCase / Acronym match (ex.: 'ac' dá match em 'AuthController')
  const acronym = target
    .split(/[^a-zA-Z0-9]+|(?=[A-Z])/)
    .filter(Boolean)
    .map((word) => word[0].toLowerCase())
    .join("");

  if (acronym && acronym.includes(q)) {
    return 450 + (q.length / acronym.length) * 50;
  }

  // Subsequence match
  let qIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;
  let contiguousBonus = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      if (lastMatchIdx === i - 1) {
        contiguousBonus += 20;
      } else {
        contiguousBonus = 0;
      }
      // Bônus para início de palavras ou maiúsculas no original
      const isWordStart = i === 0 || /[^a-zA-Z0-9]/.test(target[i - 1]) || (target[i] >= "A" && target[i] <= "Z");
      const wordBonus = isWordStart ? 30 : 0;

      score += 10 + contiguousBonus + wordBonus;
      lastMatchIdx = i;
      qIdx++;
    }
  }

  if (qIdx === q.length) {
    return Math.max(10, score - (t.length - q.length));
  }

  return 0;
}

/**
 * Busca fuzzy sobre todos os nós de um grafo ou lista de nós.
 */
export function fuzzySearch(
  source: SerializedGraph | CodeGraph | Node[],
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const limit = options.limit ?? 20;
  const nodes: Node[] = Array.isArray(source)
    ? source
    : "nodes" in source
      ? source.nodes instanceof Map
        ? Array.from(source.nodes.values())
        : (source.nodes as Node[])
      : [];

  const cleanQuery = query.trim();
  if (nodes.length === 0) return [];

  const results: SearchResult[] = [];

  for (const node of nodes) {
    // Não incluir a raiz 'project' nos resultados de busca de código
    if (node.kind === "project") continue;

    const canonicalPath = getCanonicalPath(node, nodes);
    const file = "file" in node ? node.file : undefined;
    const startLine = "startLine" in node ? node.startLine : undefined;

    if (!cleanQuery) {
      // Sem query, retorna lista padrão ordenada
      results.push({
        id: node.id,
        name: node.name,
        kind: node.kind,
        canonicalPath,
        file,
        startLine,
        score: 1,
      });
      continue;
    }

    const nameScore = scoreFuzzy(cleanQuery, node.name);
    const pathScore = scoreFuzzy(cleanQuery, canonicalPath) * 0.8;
    const fileScore = file ? scoreFuzzy(cleanQuery, file) * 0.5 : 0;

    const maxScore = Math.max(nameScore, pathScore, fileScore);

    if (maxScore > 0) {
      // Bônus leve por tipo para priorizar classes e métodos sobre locais muito aninhados
      let kindBonus = 0;
      if (node.kind === "class") kindBonus = 15;
      else if (node.kind === "method") kindBonus = 10;
      else if (node.kind === "module") kindBonus = 5;

      results.push({
        id: node.id,
        name: node.name,
        kind: node.kind,
        canonicalPath,
        file,
        startLine,
        score: maxScore + kindBonus,
      });
    }
  }

  // Ordena pelo maior score e desempata pelo menor tamanho de nome
  results.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name));

  return results.slice(0, limit);
}
