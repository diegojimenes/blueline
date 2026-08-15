import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, contents } = vi.hoisted(() => {
  const contents = new Map<string, string>();
  const invokeMock = vi.fn(async (cmd: string, args?: { projectPath?: string; relPath?: string }) => {
    switch (cmd) {
      case "read_project": {
        return [...contents.entries()].map(([path, content]) => ({ path, content }));
      }
      case "file_read": {
        const content = contents.get(args?.relPath ?? "");
        if (content === undefined) throw new Error("arquivo não encontrado");
        return content;
      }
      case "watch_start":
      case "watch_stop":
        return undefined;
      default:
        throw new Error(`comando inesperado: ${cmd}`);
    }
  });
  return { invokeMock, contents };
});

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: invokeMock,
}));

const { fakeParser } = vi.hoisted(() => {
  const fakeParser = {
    supports: (file: string) => /\.[jt]sx?$/.test(file),
    parseFile: (file: string, content: string) => {
      if (content.trim().startsWith("// empty")) {
        return { file, classes: [], methods: [], imports: [], calls: [] };
      }
      const classMatch = content.match(/class (\w+)/);
      const fallback = file.split("/").pop()!.replace(/\.[jt]sx?$/, "").replace(/[^a-zA-Z0-9_]/g, "_") || "File";
      const className = classMatch ? classMatch[1] : fallback;
      const methods = [...content.matchAll(/(\w+)\s*\(\s*\)\s*\{/g)].map((m, i) => ({
        name: m[1],
        startLine: i + 2,
        endLine: i + 4,
      }));
      return {
        file,
        classes: [{ name: className, startLine: 1, methods }],
        methods: [],
        imports: [],
        calls: [],
      };
    },
  };
  return { fakeParser };
});

vi.mock("../parser", () => ({ getParser: () => Promise.resolve(fakeParser) }));

import { useStore } from "./index";

describe("store · live updates (M5)", () => {
  beforeEach(() => {
    invokeMock.mockClear();
    contents.clear();
    contents.set("src/a.ts", "export class A { run() {} }");
    contents.set("src/b.ts", "// empty");
    useStore.setState({
      graph: null,
      projectOpen: false,
      projectPath: null,
      symbols: new Map(),
      watcherState: "off",
      watcherTime: null,
      flash: null,
      history: [],
      historyIndex: 0,
      log: [],
    });
  });

  it("openProject: walk+parse inicial, watcher ativa e cache populado", async () => {
    await useStore.getState().openProject("/proj");
    const s = useStore.getState();
    expect(s.projectPath).toBe("/proj");
    expect(s.graph?.revision).toBe(0);
    expect(s.graph?.nodes.some((n) => n.kind === "class" && n.name === "A")).toBe(true);
    expect(s.graph?.nodes.some((n) => n.name === "B")).toBe(false); // conteúdo vazio não gera nó
    expect(s.symbols.size).toBe(2);
    expect(s.watcherState).toBe("active");
    expect(invokeMock).toHaveBeenCalledWith("read_project", { projectPath: "/proj" });
    expect(invokeMock).toHaveBeenCalledWith("watch_start", { projectPath: "/proj" });
  });

  it("applyExternalChanges: mudança real → delta aplicado, revisão sobe, flash dispara", async () => {
    await useStore.getState().openProject("/proj");
    contents.set("src/a.ts", "export class A { run() {} novo() {} }");

    await useStore.getState().applyExternalChanges(["src/a.ts"]);
    const s = useStore.getState();
    expect(s.graph?.revision).toBe(1);
    expect(s.graph?.nodes.some((n) => n.name === "novo")).toBe(true);
    expect(s.flash).not.toBeNull();
    expect(s.flash?.ids.some((id) => id.includes("novo"))).toBe(true);
    expect(s.watcherState).toBe("updated");
    expect(s.watcherTime).toBeTruthy();
  });

  it("applyExternalChanges: touch sem mudança → no-op (revisão fica igual, sem flash)", async () => {
    await useStore.getState().openProject("/proj");
    await useStore.getState().applyExternalChanges(["src/a.ts"]); // mesmo conteúdo

    const s = useStore.getState();
    expect(s.graph?.revision).toBe(0);
    expect(s.flash).toBeNull();
    expect(s.watcherState).toBe("active");
  });

  it("applyExternalChanges: deleção → nó removido do grafo", async () => {
    contents.set("src/b.ts", "export class B { run() {} }");
    await useStore.getState().openProject("/proj");
    expect(useStore.getState().graph?.nodes.some((n) => n.name === "B")).toBe(true);

    contents.delete("src/b.ts");
    await useStore.getState().applyExternalChanges(["src/b.ts"]);
    const s = useStore.getState();
    expect(s.graph?.revision).toBe(1);
    expect(s.graph?.nodes.some((n) => n.name === "B")).toBe(false);
    expect(s.symbols.has("src/b.ts")).toBe(false);
  });

  it("execCommand 'open' dispara openProject assíncrono", async () => {
    useStore.getState().execCommand("open /proj");
    await vi.waitFor(() => expect(useStore.getState().projectPath).toBe("/proj"));
    expect(useStore.getState().log.some((l) => l.text.includes("abrindo /proj"))).toBe(true);
  });
});
