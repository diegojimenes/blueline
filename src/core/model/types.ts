/**
 * Tipos do modelo normalizado (specs/03-data-model.md).
 *
 * O CodeGraph é a única fonte de verdade estrutural. IDs são estáveis:
 * derivados de caminho + símbolo, nunca de posição de linha.
 */

export type NodeId = string;
export type EdgeId = string;

export type Level = 1 | 2 | 3 | 4;
export type LensId = "layers" | "coupling" | "domain";

export type Node =
  | { kind: "project"; id: NodeId; name: string }
  | { kind: "module"; id: NodeId; name: string; path: string }
  | { kind: "class"; id: NodeId; name: string; file: string; startLine: number }
  | {
      kind: "method";
      id: NodeId;
      name: string;
      file: string;
      startLine: number;
      owner: NodeId;
    };

export type EdgeType = "import" | "call" | "member" | "moduleEdge";

export interface Edge {
  id: EdgeId;
  type: EdgeType;
  from: NodeId;
  to: NodeId;
  meta?: { line?: number; symbol?: string; weight?: number };
}

export interface CodeGraph {
  projectRoot: string;
  /** Monotônico; incrementa a cada snapshot. */
  revision: number;
  nodes: Map<NodeId, Node>;
  edges: Map<EdgeId, Edge>;
  /** Índices auxiliares para navegação (specs/03-data-model.md). */
  indexes: {
    byFile: Map<string, NodeId[]>;
    byModule: Map<NodeId, NodeId[]>;
    callsIn: Map<NodeId, NodeId[]>;
    callsOut: Map<NodeId, NodeId[]>;
  };
}

export interface ModelDelta {
  revision: number;
  added: Node[];
  removed: NodeId[];
  changed: Node[];
  edgesAdded: Edge[];
  edgesRemoved: EdgeId[];
  filesTouched: string[];
  cause: "parse" | "parseIncremental" | "gitApply" | "reset";
}

/** Estado de navegação derivado de comandos; a UI nunca edita direto. */
export interface NavigationState {
  focus: NodeId | null;
  level: Level;
  lens: LensId;
  trail: NodeId[];
  selected: NodeId | null;
  /** Tudo já aberto na sessão (para cobertura de revisão). */
  visited: Set<NodeId>;
}

/** Entrada do histórico clicável do terminal (specs/08-terminal.md). */
export interface HistoryEntry {
  timestamp: number;
  command: string;
  humanPath: string;
  target: NodeId | null;
}

/** `codeatlas.json` na raiz do projeto. */
export interface ProjectConfig {
  domainPaths?: Record<string, string>;
  ignore?: string[];
  moduleDepth?: number;
  /** Prefixos de diretório raiz ignorados ao agrupar módulos (padrão: `["src", "lib", "app"]`). */
  rootPrefixes?: string[];
}
