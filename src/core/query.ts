import { couplingOf, domainOf, layerOf } from "./lenses";
import type { CodeGraph, ProjectConfig } from "./model/types";
import type { SerializedGraph, SerializedNode } from "./serialize";

export interface QueryFilter {
  field: "kind" | "name" | "layer" | "domain" | "coupling" | "file";
  op: "eq" | "contains" | "gt" | "lt";
  value: string;
}

/**
 * Motor de busca declarativa e query estruturada sobre o Grafo de Código (M13).
 * Suporta expressões como:
 * - `kind:class`
 * - `layer:domain`
 * - `coupling:>2`
 * - `name:Order`
 * - `file:auth.ts`
 */
export function parseQuery(queryStr: string): QueryFilter[] {
  const filters: QueryFilter[] = [];
  const parts = queryStr.trim().split(/\s+/);

  for (const part of parts) {
    if (!part) continue;
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) {
      // Texto simples busca por nome
      filters.push({ field: "name", op: "contains", value: part });
      continue;
    }

    const field = part.slice(0, colonIdx).toLowerCase();
    const rawVal = part.slice(colonIdx + 1);

    if (field === "coupling") {
      if (rawVal.startsWith(">")) {
        filters.push({ field: "coupling", op: "gt", value: rawVal.slice(1) });
      } else if (rawVal.startsWith("<")) {
        filters.push({ field: "coupling", op: "lt", value: rawVal.slice(1) });
      } else {
        filters.push({ field: "coupling", op: "eq", value: rawVal });
      }
    } else if (["kind", "layer", "domain", "file", "name"].includes(field)) {
      filters.push({
        field: field as QueryFilter["field"],
        op: field === "name" || field === "file" ? "contains" : "eq",
        value: rawVal,
      });
    }
  }

  return filters;
}

export function queryGraph(
  graphSource: CodeGraph | SerializedGraph,
  queryString: string,
  config: ProjectConfig = {},
): SerializedNode[] {
  const filters = parseQuery(queryString);
  if (filters.length === 0) return [];

  const serializedGraph: SerializedGraph =
    "revision" in graphSource && Array.isArray(graphSource.nodes)
      ? (graphSource as SerializedGraph)
      : {
          projectRoot: (graphSource as CodeGraph).projectRoot,
          revision: graphSource.revision,
          nodes: Array.from((graphSource as CodeGraph).nodes.values()).map((n) => n as unknown as SerializedNode),
          edges: Array.from((graphSource as CodeGraph).edges.values()),
          moduleEdges: [],
        };

  return serializedGraph.nodes.filter((node: SerializedNode) => {
    return filters.every((filter) => matchFilter(node, filter, serializedGraph, config));
  });
}

function matchFilter(
  node: SerializedNode,
  filter: QueryFilter,
  graph: SerializedGraph,
  config: ProjectConfig,
): boolean {
  switch (filter.field) {
    case "kind":
      return node.kind.toLowerCase() === filter.value.toLowerCase();
    case "name":
      return node.name.toLowerCase().includes(filter.value.toLowerCase());
    case "file":
      return "file" in node && typeof node.file === "string"
        ? node.file.toLowerCase().includes(filter.value.toLowerCase())
        : "path" in node && typeof node.path === "string"
          ? node.path.toLowerCase().includes(filter.value.toLowerCase())
          : false;
    case "layer":
      return layerOf(node, config).toLowerCase() === filter.value.toLowerCase();
    case "domain":
      return domainOf(node, config).toLowerCase() === filter.value.toLowerCase();
    case "coupling": {
      const couplingVal = couplingOf(graph, node);
      const targetVal = Number(filter.value);
      if (Number.isNaN(targetVal)) return false;
      if (filter.op === "gt") return couplingVal > targetVal;
      if (filter.op === "lt") return couplingVal < targetVal;
      return couplingVal === targetVal;
    }
    default:
      return true;
  }
}
