import type { SerializedGraph, SerializedNode } from "./serialize";

export interface WorkspaceProject {
  name: string;
  root: string;
  graph: SerializedGraph;
}

/**
 * Mescla múltiplos grafos de projetos num único Grafo de Workspace (M13).
 * Prefixa IDs com o nome do projeto para garantir estabilidade e isolamento.
 */
export function mergeWorkspaceGraphs(
  projects: WorkspaceProject[],
  workspaceName: string = "workspace",
): SerializedGraph {
  const rootNode: SerializedNode = {
    kind: "project",
    id: `workspace:${workspaceName}`,
    name: workspaceName,
  };

  const allNodes: SerializedNode[] = [rootNode];
  const allEdges: SerializedGraph["edges"] = [];

  let highestRevision = 1;

  for (const proj of projects) {
    highestRevision = Math.max(highestRevision, proj.graph.revision);

    // Conecta o projeto ao root do workspace
    const projectRootNode: SerializedNode = {
      kind: "module",
      id: `project:${proj.name}`,
      name: proj.name,
      path: proj.name,
    };
    allNodes.push(projectRootNode);

    allEdges.push({
      id: `workspace-member:${proj.name}`,
      type: "member",
      from: rootNode.id,
      to: projectRootNode.id,
    });

    for (const node of proj.graph.nodes) {
      if (node.kind === "project") continue;
      // Re-escopa nós pertencentes ao projeto
      allNodes.push({
        ...node,
        id: qualifyId(proj.name, node.id),
      } as SerializedNode);
    }

    for (const edge of proj.graph.edges) {
      if (edge.from === "project" || edge.to === "project") {
        allEdges.push({
          ...edge,
          id: qualifyId(proj.name, edge.id),
          from: edge.from === "project" ? projectRootNode.id : qualifyId(proj.name, edge.from),
          to: edge.to === "project" ? projectRootNode.id : qualifyId(proj.name, edge.to),
        });
      } else {
        allEdges.push({
          ...edge,
          id: qualifyId(proj.name, edge.id),
          from: qualifyId(proj.name, edge.from),
          to: qualifyId(proj.name, edge.to),
        });
      }
    }
  }

  return {
    projectRoot: workspaceName,
    revision: highestRevision,
    nodes: allNodes,
    edges: allEdges,
    moduleEdges: [],
  };
}

function qualifyId(projectName: string, id: string): string {
  if (id.startsWith(`project:${projectName}`)) return id;
  return `${projectName}::${id}`;
}
