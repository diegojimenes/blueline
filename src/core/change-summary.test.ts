import { describe, expect, it } from "vitest";
import { computeImpactSummary } from "./change-summary";
import type { SerializedGraph } from "./serialize";

const graph: SerializedGraph = {
  projectRoot: "/test",
  revision: 1,
  nodes: [
    { kind: "project", id: "project", name: "app" },
    { kind: "module", id: "module:auth", name: "auth", path: "src/auth" },
    { kind: "module", id: "module:session", name: "session", path: "src/session" },
    {
      kind: "class",
      id: "class:src/auth/AuthService.ts:AuthService",
      name: "AuthService",
      file: "src/auth/AuthService.ts",
      startLine: 1,
      endLine: 80,
    },
    {
      kind: "method",
      id: "method:src/auth/AuthService.ts:AuthService:login",
      name: "login",
      file: "src/auth/AuthService.ts",
      startLine: 10,
      owner: "class:src/auth/AuthService.ts:AuthService",
    },
    {
      kind: "class",
      id: "class:src/auth/AuthController.ts:AuthController",
      name: "AuthController",
      file: "src/auth/AuthController.ts",
      startLine: 1,
    },
    {
      kind: "method",
      id: "method:src/auth/AuthController.ts:AuthController:handleLogin",
      name: "handleLogin",
      file: "src/auth/AuthController.ts",
      startLine: 5,
      owner: "class:src/auth/AuthController.ts:AuthController",
    },
    {
      kind: "class",
      id: "class:src/session/SessionService.ts:SessionService",
      name: "SessionService",
      file: "src/session/SessionService.ts",
      startLine: 1,
    },
    {
      kind: "method",
      id: "method:src/session/SessionService.ts:SessionService:create",
      name: "create",
      file: "src/session/SessionService.ts",
      startLine: 5,
      owner: "class:src/session/SessionService.ts:SessionService",
    },
  ],
  edges: [
    // AuthController.handleLogin → calls → AuthService.login
    {
      id: "e1",
      type: "call",
      from: "method:src/auth/AuthController.ts:AuthController:handleLogin",
      to: "method:src/auth/AuthService.ts:AuthService:login",
    },
    // SessionService.create → calls → AuthService.login
    {
      id: "e2",
      type: "call",
      from: "method:src/session/SessionService.ts:SessionService:create",
      to: "method:src/auth/AuthService.ts:AuthService:login",
    },
    // AuthService.login → calls → SessionService.create (outgoing dep)
    {
      id: "e3",
      type: "call",
      from: "method:src/auth/AuthService.ts:AuthService:login",
      to: "method:src/session/SessionService.ts:SessionService:create",
    },
  ],
  moduleEdges: [],
};

describe("computeImpactSummary", () => {
  it("retorna null para nodeId inexistente", () => {
    const result = computeImpactSummary(graph, "non-existent");
    expect(result).toBeNull();
  });

  it("computa dependentes diretos (callers) corretamente", () => {
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
    );
    expect(result).not.toBeNull();
    expect(result!.directDependents).toHaveLength(2);
    const depPaths = result!.directDependents.map((d) => d.path);
    expect(depPaths).toContain("auth.AuthController.handleLogin");
    expect(depPaths).toContain("session.SessionService.create");
  });

  it("computa dependências diretas (callees) corretamente", () => {
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
    );
    expect(result).not.toBeNull();
    expect(result!.directDependencies).toHaveLength(1);
    expect(result!.directDependencies[0].path).toContain("session.SessionService.create");
  });

  it("identifica módulos afetados pelos dependentes", () => {
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
    );
    expect(result).not.toBeNull();
    // AuthController está em auth, SessionService em session
    expect(result!.affectedModules.length).toBeGreaterThanOrEqual(1);
  });

  it("nó sem dependentes tem impacto LOW", () => {
    // SessionService.create tem só 1 dependente (AuthService.login)
    // mas login já tem 2, então vamos pegar handleLogin que não é chamado por ninguém
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthController.ts:AuthController:handleLogin",
    );
    expect(result).not.toBeNull();
    // handleLogin não é chamado por ninguém, e só chama login
    expect(result!.directDependents).toHaveLength(0);
    expect(result!.impactLevel).toBe("LOW");
  });

  it("nó com 2 dependentes tem impacto MEDIUM ou HIGH", () => {
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
    );
    expect(result).not.toBeNull();
    expect(["MEDIUM", "HIGH"]).toContain(result!.impactLevel);
  });

  it("calcula profundidade transitiva", () => {
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
    );
    expect(result).not.toBeNull();
    expect(result!.transitiveDepth).toBeGreaterThanOrEqual(1);
  });

  it("impactScore está entre 0 e 100", () => {
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
    );
    expect(result).not.toBeNull();
    expect(result!.impactScore).toBeGreaterThanOrEqual(0);
    expect(result!.impactScore).toBeLessThanOrEqual(100);
  });

  it("enriquece com diffInfo quando disponível", () => {
    const diffSummary = {
      dirtyFiles: ["src/auth/AuthService.ts"],
      symbols: new Map([
        [
          "method:src/auth/AuthService.ts:AuthService:login",
          {
            nodeId: "method:src/auth/AuthService.ts:AuthService:login",
            kind: "method" as const,
            name: "login",
            file: "src/auth/AuthService.ts",
            additions: 25,
            deletions: 5,
            totalLinesChanged: 30,
            magnitude: "heavy" as const,
          },
        ],
      ]),
      fileSummaries: new Map(),
    };
    const result = computeImpactSummary(
      graph,
      "method:src/auth/AuthService.ts:AuthService:login",
      diffSummary,
    );
    expect(result).not.toBeNull();
    expect(result!.diffInfo).toBeDefined();
    expect(result!.diffInfo!.magnitude).toBe("heavy");
    expect(result!.impactLevel).toBe("HIGH");
  });
});
