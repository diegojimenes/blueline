/**
 * Navegação pura por nível (specs/05-rendering.md).
 *
 * A UI nunca edita NavigationState direto: toda transição (grafo, terminal,
 * teclado) passa por estas funções, garantindo que foco/trilha/visitados
 * evoluem deterministicamente a partir do modelo.
 */

import type { Level, NavigationState, NodeId, ProjectConfig } from "./model/types";
import type { SerializedGraph, SerializedNode } from "./serialize";
import { moduleOfPath } from "./analyze/build";

export const PROJECT_ID = "project";

const isModule = (n: SerializedNode): n is Extract<SerializedNode, { kind: "module" }> => n.kind === "module";

export function nodeById(graph: SerializedGraph, id: NodeId): SerializedNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function levelOfKind(kind: SerializedNode["kind"]): Level {
  switch (kind) {
    case "project":
      return 1;
    case "module":
      return 2;
    case "class":
      return 3;
    case "method":
      return 4;
    case "local":
      return 5;
  }
}

/** Nós desenhados no nível atual (specs/05-rendering.md, tabela de níveis). */
export function visibleNodes(
  graph: SerializedGraph,
  nav: Pick<NavigationState, "level" | "focus">,
  config: ProjectConfig = {},
): SerializedNode[] {
  switch (nav.level) {
    case 1:
      return graph.nodes
        .filter(isModule)
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    case 2: {
      const focus = nav.focus ? nodeById(graph, nav.focus) : undefined;
      if (!focus || focus.kind !== "module") return [];
      return graph.nodes
        .filter((n): n is Extract<SerializedNode, { kind: "class" }> => n.kind === "class" && moduleOfPath(n.file, config) === focus.path)
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }
    case 3: {
      const focus = nav.focus ? nodeById(graph, nav.focus) : undefined;
      if (!focus || focus.kind !== "class") return [];
      return graph.nodes
        .filter((n): n is Extract<SerializedNode, { kind: "method" }> => n.kind === "method" && n.owner === focus.id)
        .sort((a, b) => a.startLine - b.startLine);
    }
    case 4: {
      const focus = nav.focus ? nodeById(graph, nav.focus) : undefined;
      return focus && focus.kind === "method" ? [focus] : [];
    }
    case 5: {
      const focus = nav.focus ? nodeById(graph, nav.focus) : undefined;
      if (!focus) return [];
      // Local já em foco (folha): mostra ela centrada, como o nível 4.
      if (focus.kind === "local") return [focus];
      if (focus.kind !== "method") return [];
      return graph.nodes
        .filter((n): n is Extract<SerializedNode, { kind: "local" }> => n.kind === "local" && n.owner === focus.id)
        .sort((a, b) => a.startLine - b.startLine);
    }
  }
}

/** Cadeia raiz→nó (specs/05-rendering.md, trilha/trail). */
export function ancestorChain(graph: SerializedGraph, id: NodeId, config: ProjectConfig = {}): NodeId[] {
  const node = nodeById(graph, id);
  if (!node) return [];
  if (node.kind === "project") return [id];
  const moduleId = `module:${node.kind === "module" ? node.path : moduleOfPath(node.file, config)}`;
  if (node.kind === "module") return [PROJECT_ID, id];
  if (node.kind === "class") return [PROJECT_ID, moduleId, id];
  if (node.kind === "local") return [PROJECT_ID, moduleId, node.owner, id];
  return [PROJECT_ID, moduleId, node.owner, id];
}

/** Caminho humano canônico `modulo.Classe.metodo` (formato do `goto`). */
export function canonicalPathOf(graph: SerializedGraph, id: NodeId, config: ProjectConfig = {}): string {
  const node = nodeById(graph, id);
  if (!node) return "?";
  switch (node.kind) {
    case "project":
      return "sistema";
    case "module":
      return node.name;
    case "class":
      return `${moduleName(node.file, config)}.${node.name}`;
    case "method": {
      const owner = node.owner ? nodeById(graph, node.owner) : undefined;
      return `${moduleName(node.file, config)}.${owner?.name ?? "?"}.${node.name}`;
    }
    case "local": {
      const owner = node.owner ? nodeById(graph, node.owner) : undefined;
      if (owner) {
        const ownerPath = canonicalPathOf(graph, owner.id, config);
        return `${ownerPath}.${node.name}`;
      }
      return `${moduleName(node.file, config)}.?.${node.name}`;
    }
  }
}

function moduleName(file: string, config: ProjectConfig): string {
  const path = moduleOfPath(file, config);
  return path === "<root>" ? path : path.split("/").pop() ?? "<root>";
}

/**
 * Navega até um nó (entra). Ponto único por onde passam duplo clique e `goto`:
 * produz o MESMO estado e a MESMA trilha para ambos (specs/12-milestones.md, M2).
 */
export function navigationToNode(
  graph: SerializedGraph,
  nav: NavigationState,
  id: NodeId,
  config: ProjectConfig = {},
): NavigationState {
  const node = nodeById(graph, id);
  if (!node) return nav;
  const visited = new Set(nav.visited);
  visited.add(id);
  return {
    ...nav,
    focus: id,
    level: levelOfKind(node.kind),
    trail: ancestorChain(graph, id, config),
    visited,
    selected: id,
  };
}

/** Sobe um nível (comando `up`). Nível 1 não tem pai. */
export function upNavigation(
  graph: SerializedGraph,
  nav: NavigationState,
  config: ProjectConfig = {},
): NavigationState {
  if (!nav.focus || nav.level === 1) return nav;
  if (nav.level === 2) {
    return { ...nav, focus: null, level: 1, trail: [PROJECT_ID] };
  }
  const parentId = parentOf(graph, nav.focus, config);
  if (!parentId) return nav;
  return navigationToNode(graph, nav, parentId, config);
}

export function parentOf(graph: SerializedGraph, id: NodeId, config: ProjectConfig = {}): NodeId | undefined {
  const node = nodeById(graph, id);
  if (!node) return undefined;
  if (node.kind === "method" || node.kind === "local") return node.owner;
  if (node.kind === "class") return `module:${moduleOfPath(node.file, config)}`;
  if (node.kind === "module") return PROJECT_ID;
  return undefined;
}
