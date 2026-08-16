import { describe, expect, it } from "vitest";
import { mergeWorkspaceGraphs } from "./workspace";
import type { SerializedGraph } from "./serialize";

describe("core · multi-project workspace (M13)", () => {
  const p1: SerializedGraph = {
    projectRoot: "/projects/backend",
    revision: 1,
    nodes: [
      { kind: "project", id: "project", name: "backend" },
      { kind: "class", id: "class:srv.ts:Service", name: "Service", file: "srv.ts", startLine: 1 },
    ],
    edges: [{ id: "e1", type: "member", from: "project", to: "class:srv.ts:Service" }],
    moduleEdges: [],
  };

  const p2: SerializedGraph = {
    projectRoot: "/projects/frontend",
    revision: 2,
    nodes: [
      { kind: "project", id: "project", name: "frontend" },
      { kind: "class", id: "class:app.ts:App", name: "App", file: "app.ts", startLine: 1 },
    ],
    edges: [{ id: "e2", type: "member", from: "project", to: "class:app.ts:App" }],
    moduleEdges: [],
  };

  it("mergeWorkspaceGraphs une múltiplos projetos sob nó raiz de workspace", () => {
    const ws = mergeWorkspaceGraphs([
      { name: "backend", root: "/projects/backend", graph: p1 },
      { name: "frontend", root: "/projects/frontend", graph: p2 },
    ]);

    expect(ws.revision).toBe(2);
    expect(ws.nodes.some((n) => n.id === "workspace:workspace")).toBe(true);
    expect(ws.nodes.some((n) => n.id === "project:backend")).toBe(true);
    expect(ws.nodes.some((n) => n.id === "project:frontend")).toBe(true);
    expect(ws.nodes.some((n) => n.id.includes("backend::class:srv.ts:Service"))).toBe(true);
  });
});
