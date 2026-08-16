import { describe, expect, it } from "vitest";
import { computeWordDiff, highlightCodeLine, parseCleanDiff } from "./syntaxHighlighter";

describe("syntaxHighlighter", () => {
  it("realça palavras-chave, strings e identificadores", () => {
    const tokens = highlightCodeLine('const name: string = "CodeAtlas";');
    expect(tokens.some((t) => t.type === "keyword" && t.text === "const")).toBe(true);
    expect(tokens.some((t) => t.type === "type" && t.text === "string")).toBe(true);
    expect(tokens.some((t) => t.type === "string" && t.text === '"CodeAtlas"')).toBe(true);
  });

  it("reconhece comentários de linha e bloco", () => {
    const tokens = highlightCodeLine("// este é um comentário");
    expect(tokens[0].type).toBe("comment");
    expect(tokens[0].text).toBe("// este é um comentário");
  });

  it("computa word-level diff entre linhas modificadas", () => {
    const oldLine = "import { Trash2, Plus } from './icons';";
    const newLine = "import { Trash2, Plus, ChevronDown } from './icons';";
    const { oldChunks, newChunks } = computeWordDiff(oldLine, newLine);

    expect(newChunks.some((c) => c.type === "add" && c.text.includes("ChevronDown"))).toBe(true);
    expect(oldChunks.every((c) => c.type === "same")).toBe(true);
  });

  it("faz parse de diff limpo agrupado em hunks e remove cabeçalhos git", () => {
    const sampleDiff = `
diff --git a/editor/src/components/Inspector.tsx b/editor/src/components/Inspector.tsx
index d622996..d38bf15 100644
--- a/editor/src/components/Inspector.tsx
+++ b/editor/src/components/Inspector.tsx
@@ -4,4 +4,5 @@ import { world } from 'engine';
 import { ScrollArea } from './ui';
-import { Trash } from './icons';
+import { Trash2, Plus } from './icons';
 import { Separator } from './ui/separator';
`;
    const parsed = parseCleanDiff(sampleDiff);
    expect(parsed.hunks.length).toBe(1);
    expect(parsed.fileSummary.additions).toBe(1);
    expect(parsed.fileSummary.deletions).toBe(1);
    const hunk = parsed.hunks[0];
    expect(hunk.lines.some((l) => l.type === "del" && l.content.includes("Trash"))).toBe(true);
    expect(hunk.lines.some((l) => l.type === "add" && l.content.includes("Trash2"))).toBe(true);
  });
});
