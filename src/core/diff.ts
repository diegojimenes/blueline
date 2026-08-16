import type { CodeGraph, Edge, EdgeId, ModelDelta, Node, NodeId } from "./model/types";
import type { SerializedGraph } from "./serialize";

export interface DiffLine {
  type: "add" | "del" | "ctx" | "header";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  fromPath?: string;
  toPath?: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

/**
 * Faz o parse de uma string de unified diff (gerada por `git diff`).
 */
export function parseUnifiedDiff(diffText: string): FileDiff[] {
  if (!diffText.trim()) return [];

  const files: FileDiff[] = [];
  const lines = diffText.split(/\r?\n/);

  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineCounter = 0;
  let newLineCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("diff --git")) {
      if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
      if (currentFile) files.push(currentFile);

      currentFile = { hunks: [], additions: 0, deletions: 0 };
      currentHunk = null;
      continue;
    }

    if (line.startsWith("--- ")) {
      if (!currentFile) currentFile = { hunks: [], additions: 0, deletions: 0 };
      currentFile.fromPath = line.replace(/^---\s+[a-z]?\/?/, "");
      continue;
    }

    if (line.startsWith("+++ ")) {
      if (!currentFile) currentFile = { hunks: [], additions: 0, deletions: 0 };
      currentFile.toPath = line.replace(/^\+\+\+\s+[a-z]?\/?/, "");
      continue;
    }

    if (line.startsWith("@@ ")) {
      if (currentHunk && currentFile) {
        currentFile.hunks.push(currentHunk);
      }
      // Exemplo: @@ -10,5 +10,8 @@
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      oldLineCounter = match ? parseInt(match[1], 10) : 1;
      newLineCounter = match ? parseInt(match[2], 10) : 1;

      currentHunk = {
        header: line,
        lines: [{ type: "header", text: line }],
      };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "add",
        text: line.slice(1),
        newLine: newLineCounter++,
      });
      if (currentFile) currentFile.additions++;
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "del",
        text: line.slice(1),
        oldLine: oldLineCounter++,
      });
      if (currentFile) currentFile.deletions++;
    } else if (line.startsWith(" ") || line === "") {
      currentHunk.lines.push({
        type: "ctx",
        text: line.startsWith(" ") ? line.slice(1) : line,
        oldLine: oldLineCounter++,
        newLine: newLineCounter++,
      });
    }
  }

  if (currentHunk && currentFile) currentFile.hunks.push(currentHunk);
  if (currentFile) files.push(currentFile);

  return files;
}

/**
 * Compara dois snapshots do grafo e extrai o ModelDelta correspondente.
 */
export function computeGraphDiff(
  prev: SerializedGraph | CodeGraph,
  next: SerializedGraph | CodeGraph,
  cause: ModelDelta["cause"] = "gitApply",
): ModelDelta {
  const prevNodes = toNodeMap(prev);
  const nextNodes = toNodeMap(next);
  const prevEdges = toEdgeMap(prev);
  const nextEdges = toEdgeMap(next);

  const added: Node[] = [];
  const removed: NodeId[] = [];
  const changed: Node[] = [];
  const filesTouched = new Set<string>();

  for (const [id, node] of nextNodes.entries()) {
    const prevNode = prevNodes.get(id);
    if (!prevNode) {
      added.push(node);
      if ("file" in node && node.file) filesTouched.add(node.file);
    } else if (isNodeChanged(prevNode, node)) {
      changed.push(node);
      if ("file" in node && node.file) filesTouched.add(node.file);
    }
  }

  for (const [id, node] of prevNodes.entries()) {
    if (!nextNodes.has(id)) {
      removed.push(id);
      if ("file" in node && node.file) filesTouched.add(node.file);
    }
  }

  const edgesAdded: Edge[] = [];
  const edgesRemoved: EdgeId[] = [];

  for (const [id, edge] of nextEdges.entries()) {
    if (!prevEdges.has(id)) {
      edgesAdded.push(edge);
    }
  }

  for (const id of prevEdges.keys()) {
    if (!nextEdges.has(id)) {
      edgesRemoved.push(id);
    }
  }

  return {
    revision: next.revision,
    added,
    removed,
    changed,
    edgesAdded,
    edgesRemoved,
    filesTouched: Array.from(filesTouched).sort(),
    cause,
  };
}

function toNodeMap(source: SerializedGraph | CodeGraph): Map<NodeId, Node> {
  if ("nodes" in source && source.nodes instanceof Map) {
    return source.nodes;
  }
  const map = new Map<NodeId, Node>();
  const list = "nodes" in source ? (source.nodes as Node[]) : [];
  for (const n of list) map.set(n.id, n);
  return map;
}

function toEdgeMap(source: SerializedGraph | CodeGraph): Map<EdgeId, Edge> {
  if ("edges" in source && source.edges instanceof Map) {
    return source.edges;
  }
  const map = new Map<EdgeId, Edge>();
  const list = "edges" in source ? (source.edges as Edge[]) : [];
  for (const e of list) map.set(e.id, e);
  return map;
}

function isNodeChanged(a: Node, b: Node): boolean {
  if (a.kind !== b.kind || a.name !== b.name) return true;
  if ("startLine" in a && "startLine" in b && a.startLine !== b.startLine) return true;
  if ("endLine" in a && "endLine" in b && a.endLine !== b.endLine) return true;
  if ("owner" in a && "owner" in b && a.owner !== b.owner) return true;
  if ("file" in a && "file" in b && a.file !== b.file) return true;
  return false;
}

export type DiffMagnitude = "light" | "medium" | "heavy";

export interface SymbolDiffInfo {
  nodeId: NodeId;
  kind: "class" | "method" | "local" | "module" | "project";
  name: string;
  file?: string;
  additions: number;
  deletions: number;
  totalLinesChanged: number;
  magnitude: DiffMagnitude;
}

export interface FileDiffSummary {
  file: string;
  additions: number;
  deletions: number;
  totalLinesChanged: number;
  magnitude: DiffMagnitude;
}

export interface ProjectDiffSummary {
  dirtyFiles: string[];
  symbols: Map<NodeId, SymbolDiffInfo>;
  fileSummaries: Map<string, FileDiffSummary>;
}

export function computeMagnitude(linesChanged: number): DiffMagnitude {
  if (linesChanged <= 5) return "light";
  if (linesChanged <= 20) return "medium";
  return "heavy";
}

/**
 * Mapeia as alterações de um diff unificado para nós específicos do CodeGraph usando AST line-range.
 * Apenas os nós com linhas tocadas (e seus contêineres pai por propagação) são identificados.
 */
export function mapDiffToSymbols(
  diffs: FileDiff[],
  graph: SerializedGraph | CodeGraph,
): ProjectDiffSummary {
  const nodeMap = toNodeMap(graph);
  const nodesList = Array.from(nodeMap.values());
  const symbols = new Map<NodeId, SymbolDiffInfo>();
  const fileSummaries = new Map<string, FileDiffSummary>();
  const dirtyFiles: string[] = [];

  for (const diff of diffs) {
    const file = diff.toPath || diff.fromPath;
    if (!file) continue;
    if (!dirtyFiles.includes(file)) dirtyFiles.push(file);

    const fileTotalChanged = diff.additions + diff.deletions;
    fileSummaries.set(file, {
      file,
      additions: diff.additions,
      deletions: diff.deletions,
      totalLinesChanged: fileTotalChanged,
      magnitude: computeMagnitude(fileTotalChanged),
    });

    // Nós pertencentes a este arquivo
    const fileNodes = nodesList.filter((n) => "file" in n && n.file === file);
    if (fileNodes.length === 0) continue;

    // Métodos e locais específicos têm prioridade para line-range exato
    const methodsAndLocals = fileNodes.filter((n) => n.kind === "method" || n.kind === "local");
    const classes = fileNodes.filter((n) => n.kind === "class");

    const lineStats = new Map<NodeId, { additions: number; deletions: number }>();

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== "add" && line.type !== "del") continue;
        const lineNum = line.newLine ?? line.oldLine;
        if (lineNum === undefined) continue;

        // 1. Procura método/local mais específico que engloba a linha
        let targetNode: (typeof methodsAndLocals)[number] | (typeof classes)[number] | undefined =
          methodsAndLocals.find((m) => {
            const s = m.startLine;
            const e = m.endLine ?? s + 10;
            return s <= lineNum && lineNum <= e;
          });

        // 2. Se não achou método, procura classe que engloba a linha
        if (!targetNode) {
          targetNode = classes.find((c) => {
            const s = c.startLine;
            const e = c.endLine ?? s + 30;
            return s <= lineNum && lineNum <= e;
          });
        }

        // 3. Fallback: primeira classe do arquivo
        if (!targetNode && classes.length > 0) {
          targetNode = classes[0];
        }

        if (targetNode) {
          const stats = lineStats.get(targetNode.id) ?? { additions: 0, deletions: 0 };
          if (line.type === "add") stats.additions++;
          if (line.type === "del") stats.deletions++;
          lineStats.set(targetNode.id, stats);
        }
      }
    }

    // Registra símbolos e propaga para pais (classe e módulo)
    for (const [nodeId, stats] of lineStats.entries()) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const total = stats.additions + stats.deletions;
      if (total === 0) continue;

      symbols.set(nodeId, {
        nodeId,
        kind: node.kind,
        name: node.name,
        file: "file" in node ? node.file : undefined,
        additions: stats.additions,
        deletions: stats.deletions,
        totalLinesChanged: total,
        magnitude: computeMagnitude(total),
      });

      // Propaga para o owner se for método/local
      if ("owner" in node && node.owner) {
        const ownerId = node.owner;
        const ownerStats = symbols.get(ownerId);
        const ownerNode = nodeMap.get(ownerId);
        if (ownerNode) {
          const newAdds = (ownerStats?.additions ?? 0) + stats.additions;
          const newDels = (ownerStats?.deletions ?? 0) + stats.deletions;
          const newTotal = newAdds + newDels;
          symbols.set(ownerId, {
            nodeId: ownerId,
            kind: ownerNode.kind,
            name: ownerNode.name,
            file: "file" in ownerNode ? ownerNode.file : undefined,
            additions: newAdds,
            deletions: newDels,
            totalLinesChanged: newTotal,
            magnitude: computeMagnitude(newTotal),
          });
        }
      }
    }
  }

  return {
    dirtyFiles,
    symbols,
    fileSummaries,
  };
}
