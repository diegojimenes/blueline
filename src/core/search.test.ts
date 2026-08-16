import { describe, expect, it } from "vitest";
import { fuzzySearch, getCanonicalPath, scoreFuzzy } from "./search";
import type { Node } from "./model/types";

describe("core · fuzzy search (M7)", () => {
  const sampleNodes: Node[] = [
    { kind: "project", id: "project", name: "my-app" },
    { kind: "module", id: "module:auth", name: "auth", path: "src/auth" },
    { kind: "module", id: "module:billing", name: "billing", path: "src/billing" },
    { kind: "class", id: "class:src/auth/AuthService.ts:AuthService", name: "AuthService", file: "src/auth/AuthService.ts", startLine: 1 },
    {
      kind: "method",
      id: "method:src/auth/AuthService.ts:AuthService:login",
      name: "login",
      file: "src/auth/AuthService.ts",
      startLine: 10,
      owner: "class:src/auth/AuthService.ts:AuthService",
    },
    {
      kind: "method",
      id: "method:src/auth/AuthService.ts:AuthService:logout",
      name: "logout",
      file: "src/auth/AuthService.ts",
      startLine: 25,
      owner: "class:src/auth/AuthService.ts:AuthService",
    },
    {
      kind: "local",
      id: "local:src/auth/AuthService.ts:validateToken:15:2",
      name: "validateToken",
      file: "src/auth/AuthService.ts",
      startLine: 15,
      owner: "method:src/auth/AuthService.ts:AuthService:login",
    },
  ];

  it("getCanonicalPath formata caminhos canônicos legíveis", () => {
    expect(getCanonicalPath(sampleNodes[1])).toBe("src/auth");
    expect(getCanonicalPath(sampleNodes[3])).toBe("src/auth/AuthService.ts:AuthService");
    expect(getCanonicalPath(sampleNodes[4], sampleNodes)).toBe("src/auth/AuthService.ts:AuthService.login");
  });

  it("scoreFuzzy pontua matches exatos mais alto que parciais", () => {
    const exact = scoreFuzzy("login", "login");
    const prefix = scoreFuzzy("log", "login");
    const sub = scoreFuzzy("og", "login");
    const miss = scoreFuzzy("xyz", "login");

    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(sub);
    expect(sub).toBeGreaterThan(miss);
    expect(miss).toBe(0);
  });

  it("scoreFuzzy lida com camelCase / acronyms", () => {
    const score = scoreFuzzy("as", "AuthService");
    expect(score).toBeGreaterThan(0);
  });

  it("fuzzySearch retorna nós correspondentes ordenados por score", () => {
    const results = fuzzySearch(sampleNodes, "log");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].name).toBe("login");
    expect(results[1].name).toBe("logout");
  });

  it("fuzzySearch acha símbolos por caminho canônico ou arquivo", () => {
    const results = fuzzySearch(sampleNodes, "auth/AuthService");
    expect(results.some((r) => r.name === "AuthService")).toBe(true);
  });

  it("fuzzySearch respeita limite de resultados", () => {
    const results = fuzzySearch(sampleNodes, "", { limit: 2 });
    expect(results.length).toBe(2);
  });

  it("fuzzySearch ignora o nó raiz de projeto", () => {
    const results = fuzzySearch(sampleNodes, "my-app");
    expect(results.some((r) => r.kind === "project")).toBe(false);
  });
});
