import { beforeAll, describe, expect, it } from "vitest";
import { createNodeTypeScriptParser } from "./node";
import type { Parser } from "./types";

let parser: Parser;

beforeAll(async () => {
  parser = await createNodeTypeScriptParser();
});

const CODE = `
import { B as Bee } from "./b";
export class A {
  go(): void {
    this.run();
    other();
  }
  run(): void {}
}
export function top(): void {
  helper();
}
export const arrow = (): void => nothing();
`;

describe("TypeScriptParser", () => {
  it("suporta apenas arquivos TS/JS", () => {
    expect(parser.supports("src/a.ts")).toBe(true);
    expect(parser.supports("src/a.tsx")).toBe(true);
    expect(parser.supports("a.js")).toBe(true);
    expect(parser.supports("a.md")).toBe(false);
    expect(parser.supports("a.css")).toBe(false);
  });

  it("extrai classes e métodos (sem construtor)", () => {
    const symbols = parser.parseFile("src/a.ts", CODE);
    expect(symbols.classes).toEqual([
      {
        name: "A",
        startLine: 3,
        endLine: 9,
        methods: [
          { name: "go", startLine: 4, endLine: 7 },
          { name: "run", startLine: 8, endLine: 8 },
        ],
      },
    ]);
  });

  it("extrai funções de topo (declaração e arrow const)", () => {
    const symbols = parser.parseFile("src/a.ts", CODE);
    expect(symbols.methods.map((m) => m.name)).toEqual(["top", "arrow"]);
  });

  it("extrai funções aninhadas como locals do método que as contém (nível 5)", () => {
    const symbols = parser.parseFile(
      "src/a.ts",
      `
      export class A {
        go(): void {
          const helper = () => { run(); };
          function inner(): void {}
          helper();
        }
      }
      `,
    );
    expect(symbols.methods.map((m) => m.name)).toEqual([]);
    const byName = Object.fromEntries(symbols.locals.map((l) => [l.name, l]));
    expect(byName["helper"].owner).toBe("go");
    expect(byName["inner"].owner).toBe("go");
    // Chamada dentro de uma local pertence à local (range mais interno).
    expect(symbols.calls.find((c) => c.target === "run")?.owner).toBe("helper");
  });

  it("extrai imports com símbolos (incluindo alias)", () => {
    const symbols = parser.parseFile("src/a.ts", CODE);
    expect(symbols.imports).toEqual([{ from: "./b", symbols: ["B"], items: [{ name: "B", alias: "Bee" }] }]);
  });

  it("extrai calls e atribui ao método dono (range mais interno)", () => {
    const symbols = parser.parseFile("src/a.ts", CODE);
    const byTarget = Object.fromEntries(symbols.calls.map((c) => [c.target, c]));
    expect(Object.keys(byTarget).sort()).toEqual(["helper", "nothing", "other", "run"]);
    expect(byTarget["run"].owner).toBe("go");
    expect(byTarget["other"].owner).toBe("go");
    expect(byTarget["helper"].owner).toBe("top");
    expect(byTarget["nothing"].owner).toBe("arrow");
  });

  it("ignora `new` (não é call_expression) no MVP", () => {
    const symbols = parser.parseFile("src/a.ts", `export class A {\n  go(): void {\n    new B().x();\n  }\n}`);
    expect(symbols.calls.map((c) => c.target)).toEqual(["x"]);
  });

  it("não quebra com JSX (TSX)", () => {
    const symbols = parser.parseFile(
      "src/View.tsx",
      `export function View({ label }: { label: string }) {\n  return <div>{label}</div>;\n}`,
    );
    expect(symbols.methods.map((m) => m.name)).toEqual(["View"]);
  });
});
