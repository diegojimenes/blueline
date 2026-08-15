import type { CodeGraph, Edge, EdgeId, ModelDelta, Node, NodeId } from "./model/types";

/**
 * Diff estrutural entre dois snapshots do CodeGraph (specs/09-live-updates.md).
 *
 * A comparação é por ID estável (path + símbolo): nós/arestas não afetados
 * mantêm IDs e não aparecem no delta (garantia D6). Um batch de arquivos
 * vira um único delta — a UI faz 1 render.
 */
export function computeDelta(
  before: CodeGraph,
  after: CodeGraph,
  cause: ModelDelta["cause"] = "parseIncremental",
): ModelDelta {
  const added: Node[] = [];
  const changed: Node[] = [];
  const removed: NodeId[] = [];
  const edgesAdded: Edge[] = [];
  const edgesRemoved: EdgeId[] = [];
  const files = new Set<string>();

  for (const node of after.nodes.values()) {
    const prev = before.nodes.get(node.id);
    if (!prev) {
      added.push(node);
      touchFile(node, files);
    } else if (stableStringify(prev) !== stableStringify(node)) {
      changed.push(node);
      touchFile(node, files);
    }
  }
  for (const id of before.nodes.keys()) {
    const gone = after.nodes.get(id);
    if (!gone) {
      removed.push(id);
      const prev = before.nodes.get(id);
      if (prev) touchFile(prev, files);
    }
  }

  for (const edge of after.edges.values()) {
    const prev = before.edges.get(edge.id);
    if (!prev) {
      edgesAdded.push(edge);
    } else if (stableStringify(prev) !== stableStringify(edge)) {
      // Aresta mudou (ex.: linha de chamada): substituição honesta.
      edgesAdded.push(edge);
      edgesRemoved.push(edge.id);
    }
  }
  for (const id of before.edges.keys()) {
    if (!after.edges.has(id)) edgesRemoved.push(id);
  }

  const byId = <T extends { id: string }>(items: T[]): T[] => items.slice().sort((a, b) => (a.id < b.id ? -1 : 1));

  return {
    revision: after.revision,
    added: byId(added),
    removed: removed.slice().sort(),
    changed: byId(changed),
    edgesAdded: byId(edgesAdded),
    edgesRemoved: edgesRemoved.slice().sort(),
    filesTouched: [...files].sort(),
    cause,
  };
}

/** Um delta com qualquer conteúdo? (UI usa para evitar render em no-op.) */
export function hasChanges(delta: ModelDelta): boolean {
  return (
    delta.added.length > 0 ||
    delta.removed.length > 0 ||
    delta.changed.length > 0 ||
    delta.edgesAdded.length > 0 ||
    delta.edgesRemoved.length > 0
  );
}

function touchFile(node: Node, files: Set<string>): void {
  if (node.kind === "class" || node.kind === "method") files.add(node.file);
}

/**
 * Comparação estrutural insensível à ordem das chaves: `fromJSON` e `buildGraph`
 * constroem objetos com ordens de chave diferentes — `JSON.stringify` sozinho
 * marcaria tudo como `changed`.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
