import { describe, expect, it } from "vitest";
import { buildAgentContext } from "./agent-protocol";
import type { SerializedGraph } from "./serialize";

describe("core · agent protocol (M10)", () => {
  const sampleGraph: SerializedGraph = {
    projectRoot: "/test",
    revision: 1,
    nodes: [
      { kind: "project", id: "project", name: "app" },
      { kind: "module", id: "module:auth", name: "auth", path: "auth" },
      { kind: "class", id: "class:auth.ts:AuthService", name: "AuthService", file: "auth.ts", startLine: 1 },
      {
        kind: "method",
        id: "method:auth.ts:AuthService:login",
        name: "login",
        file: "auth.ts",
        startLine: 5,
        owner: "class:auth.ts:AuthService",
      },
      {
        kind: "method",
        id: "method:auth.ts:AuthService:verify",
        name: "verify",
        file: "auth.ts",
        startLine: 12,
        owner: "class:auth.ts:AuthService",
      },
      { kind: "class", id: "class:gateway.ts:Gateway", name: "Gateway", file: "gateway.ts", startLine: 10 },
      {
        kind: "method",
        id: "method:gateway.ts:Gateway:handleRequest",
        name: "handleRequest",
        file: "gateway.ts",
        startLine: 20,
        owner: "class:gateway.ts:Gateway",
      },
    ],
    edges: [
      { id: "m0", type: "member", from: "class:gateway.ts:Gateway", to: "method:gateway.ts:Gateway:handleRequest" },
      { id: "m1", type: "member", from: "class:auth.ts:AuthService", to: "method:auth.ts:AuthService:login" },
      { id: "m2", type: "member", from: "class:auth.ts:AuthService", to: "method:auth.ts:AuthService:verify" },
      { id: "c1", type: "call", from: "method:gateway.ts:Gateway:handleRequest", to: "method:auth.ts:AuthService:login" },
      { id: "c2", type: "call", from: "method:auth.ts:AuthService:login", to: "method:auth.ts:AuthService:verify" },
    ],
    moduleEdges: [],
  };

  it("buildAgentContext gera sumário enriquecido de chamadores, chamados e membros", () => {
    const ctx = buildAgentContext(sampleGraph, "login");

    expect(ctx.targetNode?.name).toBe("login");
    expect(ctx.targetNode?.file).toBe("auth.ts");
    expect(ctx.callers.some((c) => c.includes("handleRequest"))).toBe(true);
    expect(ctx.callees.some((c) => c.includes("verify"))).toBe(true);
    expect(ctx.summary).toContain("handleRequest");
    expect(ctx.summary).toContain("verify");
  });

  it("retorna fallback amigável quando o símbolo não existe", () => {
    const ctx = buildAgentContext(sampleGraph, "inexistente");
    expect(ctx.targetNode).toBeUndefined();
    expect(ctx.summary).toContain("Nenhum símbolo ou arquivo correspondente a 'inexistente'");
  });
});
