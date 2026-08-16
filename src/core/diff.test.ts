import { describe, expect, it } from "vitest";
import { computeGraphDiff, mapDiffToSymbols, parseUnifiedDiff } from "./diff";
import type { SerializedGraph } from "./serialize";

describe("core · diff & snapshots (M9)", () => {
  const SAMPLE_DIFF = `
diff --git a/src/auth.ts b/src/auth.ts
index e69de29..d95f3ad 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,4 +1,5 @@
 export class Auth {
+  refreshToken(): void {}
   login(): void {
-    validate();
+    this.validate();
   }
 }
`;

  it("parseUnifiedDiff extrai arquivos, hunks, adições e deleções", () => {
    const diffs = parseUnifiedDiff(SAMPLE_DIFF);
    expect(diffs.length).toBe(1);
    expect(diffs[0].toPath).toBe("src/auth.ts");
    expect(diffs[0].additions).toBe(2);
    expect(diffs[0].deletions).toBe(1);

    const hunk = diffs[0].hunks[0];
    expect(hunk.lines.some((l) => l.type === "add" && l.text.includes("refreshToken"))).toBe(true);
    expect(hunk.lines.some((l) => l.type === "del" && l.text.includes("validate()"))).toBe(true);
  });

  it("computeGraphDiff calcula nós adicionados, removidos e modificados entre snapshots", () => {
    const v1: SerializedGraph = {
      projectRoot: "/test",
      revision: 1,
      nodes: [
        { kind: "project", id: "project", name: "app" },
        { kind: "class", id: "class:a.ts:A", name: "A", file: "a.ts", startLine: 1 },
        { kind: "method", id: "method:a.ts:A:oldMethod", name: "oldMethod", file: "a.ts", startLine: 5, owner: "class:a.ts:A" },
      ],
      edges: [{ id: "member:A:oldMethod", type: "member", from: "class:a.ts:A", to: "method:a.ts:A:oldMethod" }],
      moduleEdges: [],
    };

    const v2: SerializedGraph = {
      projectRoot: "/test",
      revision: 2,
      nodes: [
        { kind: "project", id: "project", name: "app" },
        { kind: "class", id: "class:a.ts:A", name: "A", file: "a.ts", startLine: 2 }, // Linha alterada
        { kind: "method", id: "method:a.ts:A:newMethod", name: "newMethod", file: "a.ts", startLine: 10, owner: "class:a.ts:A" }, // Novo
      ],
      edges: [{ id: "member:A:newMethod", type: "member", from: "class:a.ts:A", to: "method:a.ts:A:newMethod" }],
      moduleEdges: [],
    };

    const delta = computeGraphDiff(v1, v2);

    expect(delta.revision).toBe(2);
    expect(delta.added.map((n) => n.id)).toEqual(["method:a.ts:A:newMethod"]);
    expect(delta.removed).toEqual(["method:a.ts:A:oldMethod"]);
    expect(delta.changed.map((n) => n.id)).toEqual(["class:a.ts:A"]);
    expect(delta.edgesAdded.map((e) => e.id)).toEqual(["member:A:newMethod"]);
    expect(delta.edgesRemoved).toEqual(["member:A:oldMethod"]);
  });

  it("mapDiffToSymbols mapeia alterações de diff para símbolos exatos e calcula magnitude", () => {
    const diffs = parseUnifiedDiff(SAMPLE_DIFF);
    const graph: SerializedGraph = {
      projectRoot: "/test",
      revision: 1,
      nodes: [
        { kind: "project", id: "project", name: "app" },
        { kind: "class", id: "class:src/auth.ts:Auth", name: "Auth", file: "src/auth.ts", startLine: 1, endLine: 20 },
        {
          kind: "method",
          id: "method:src/auth.ts:Auth:login",
          name: "login",
          file: "src/auth.ts",
          startLine: 3,
          endLine: 6,
          owner: "class:src/auth.ts:Auth",
        },
      ],
      edges: [],
      moduleEdges: [],
    };

    const summary = mapDiffToSymbols(diffs, graph);
    expect(summary.dirtyFiles).toContain("src/auth.ts");
    expect(summary.fileSummaries.get("src/auth.ts")?.magnitude).toBe("light");

    // Símbolo do método login foi alterado
    const methodDiff = summary.symbols.get("method:src/auth.ts:Auth:login");
    expect(methodDiff).toBeDefined();
    expect(methodDiff?.additions).toBe(1);
    expect(methodDiff?.deletions).toBe(1);
    expect(methodDiff?.magnitude).toBe("light");

    // A classe Auth também recebe a propagação
    const classDiff = summary.symbols.get("class:src/auth.ts:Auth");
    expect(classDiff).toBeDefined();
    expect(classDiff?.totalLinesChanged).toBeGreaterThanOrEqual(2);
  });
});
