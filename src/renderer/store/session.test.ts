import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, contents } = vi.hoisted(() => {
  const contents = new Map<string, string>();
  const invokeMock = vi.fn(async (cmd: string, args?: { projectPath?: string; relPath?: string }) => {
    switch (cmd) {
      case "read_project": {
        if (args?.projectPath === "/invalid-path") {
          throw new Error("Diretório não encontrado");
        }
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
      case "git_status":
        return { repo: false, dirty: [] };
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
        return { file, classes: [], methods: [], locals: [], imports: [], calls: [] };
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
        locals: [],
        imports: [],
        calls: [],
      };
    },
  };
  return { fakeParser };
});

vi.mock("../parser", () => ({ getParser: () => Promise.resolve(fakeParser) }));

import { flushSession, useStore } from "./index";
import { loadSession, saveSession } from "../session";

describe("store · persistência de sessão (M6)", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockClear();
    contents.clear();
    contents.set("src/service/Auth.ts", "export class Auth { login() {} logout() {} }");

    useStore.setState({
      theme: "dark",
      lens: "layers",
      projectOpen: false,
      projectPath: null,
      graph: null,
      focus: null,
      level: 1,
      trail: [],
      selected: null,
      visited: new Set(),
      history: [],
      historyIndex: 0,
      log: [],
    });
  });

  it("restoreSession não altera o estado quando não há sessão salva", async () => {
    await useStore.getState().restoreSession();
    const s = useStore.getState();
    expect(s.theme).toBe("dark");
    expect(s.lens).toBe("layers");
    expect(s.projectPath).toBeNull();
  });

  it("restoreSession restaura tema e lente mesmo sem projeto", async () => {
    saveSession({
      theme: "light",
      lens: "domain",
      projectPath: null,
      focus: null,
      level: 1,
      trail: [],
      visited: new Set(),
    });

    await useStore.getState().restoreSession();
    const s = useStore.getState();
    expect(s.theme).toBe("light");
    expect(s.lens).toBe("domain");
    expect(s.projectPath).toBeNull();
  });

  it("restoreSession reabre o projeto e navega até o foco salvo", async () => {
    saveSession({
      theme: "light",
      lens: "coupling",
      projectPath: "/my-app",
      focus: "class:src/service/Auth.ts:Auth",
      level: 3,
      trail: ["project", "module:service", "class:src/service/Auth.ts:Auth"],
      visited: new Set(["module:service", "class:src/service/Auth.ts:Auth"]),
      selected: "class:src/service/Auth.ts:Auth",
    });

    await useStore.getState().restoreSession();
    const s = useStore.getState();
    expect(s.theme).toBe("light");
    expect(s.lens).toBe("coupling");
    expect(s.projectPath).toBe("/my-app");
    expect(s.graph).not.toBeNull();
    expect(s.focus).toBe("class:src/service/Auth.ts:Auth");
    expect(s.level).toBe(3);
    expect(s.selected).toBe("class:src/service/Auth.ts:Auth");
    expect(s.trail).toContain("class:src/service/Auth.ts:Auth");
    expect(s.visited.has("class:src/service/Auth.ts:Auth")).toBe(true);
  });

  it("restoreSession cai no nível 1 com segurança se o nó salvo foi removido do projeto", async () => {
    saveSession({
      theme: "dark",
      lens: "layers",
      projectPath: "/my-app",
      focus: "class:src/service/Deleted.ts:Deleted",
      level: 3,
      trail: ["project", "module:service", "class:src/service/Deleted.ts:Deleted"],
      visited: new Set(["module:service"]),
    });

    await useStore.getState().restoreSession();
    const s = useStore.getState();
    expect(s.projectPath).toBe("/my-app");
    expect(s.focus).toBeNull();
    expect(s.level).toBe(1);
    expect(s.visited.has("module:service")).toBe(true);
  });

  it("restoreSession trata falha ao abrir pasta sem quebrar a aplicação", async () => {
    saveSession({
      theme: "light",
      lens: "domain",
      projectPath: "/invalid-path",
      focus: "node:1",
      level: 2,
      trail: [],
      visited: new Set(),
    });

    await useStore.getState().restoreSession();
    const s = useStore.getState();
    expect(s.theme).toBe("light");
    expect(s.lens).toBe("domain");
    expect(s.projectPath).toBeNull();
    expect(s.graph).toBeNull();
  });

  it("flushSession grava o estado atual imediatamente no storage", () => {
    useStore.setState({
      theme: "light",
      lens: "domain",
      projectPath: "/saved-flush",
      focus: "module:core",
      level: 2,
      trail: ["project", "module:core"],
      visited: new Set(["module:core"]),
    });

    flushSession();
    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.theme).toBe("light");
    expect(loaded?.lens).toBe("domain");
    expect(loaded?.projectPath).toBe("/saved-flush");
    expect(loaded?.focus).toBe("module:core");
  });

  it("mudanças no store disparam persistência debounced no localStorage", async () => {
    useStore.getState().setTheme("light");
    useStore.getState().setLens("coupling");

    await vi.waitFor(
      () => {
        const loaded = loadSession();
        expect(loaded).not.toBeNull();
        expect(loaded?.theme).toBe("light");
        expect(loaded?.lens).toBe("coupling");
      },
      { timeout: 1000 },
    );
  });
});
