import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSession,
  createSessionSnapshot,
  hasSessionChanged,
  isValidSession,
  loadSession,
  saveSession,
  SESSION_STORAGE_KEY,
  type SavedSession,
  type SessionInput,
} from "./session";

describe("session · persistência (M6)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const validSession: SavedSession = {
    version: 1,
    theme: "dark",
    lens: "layers",
    projectPath: "/home/user/project",
    focus: "method:src/auth/Auth.ts:Auth:login",
    level: 4,
    trail: ["project", "module:auth", "class:src/auth/Auth.ts:Auth", "method:src/auth/Auth.ts:Auth:login"],
    visited: ["module:auth", "class:src/auth/Auth.ts:Auth", "method:src/auth/Auth.ts:Auth:login"],
    selected: "method:src/auth/Auth.ts:Auth:login",
    savedAt: 1700000000000,
  };

  it("loadSession retorna null quando o storage está vazio", () => {
    expect(loadSession()).toBeNull();
  });

  it("loadSession retorna null quando o JSON é inválido", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "invalid-json{");
    expect(loadSession()).toBeNull();
  });

  it("isValidSession valida os tipos de todos os campos", () => {
    expect(isValidSession(null)).toBe(false);
    expect(isValidSession({})).toBe(false);
    expect(isValidSession({ ...validSession, version: 2 })).toBe(false);
    expect(isValidSession({ ...validSession, theme: "blue" })).toBe(false);
    expect(isValidSession({ ...validSession, lens: "unknown" })).toBe(false);
    expect(isValidSession({ ...validSession, level: 0 })).toBe(false);
    expect(isValidSession({ ...validSession, level: 6 })).toBe(false);
    expect(isValidSession({ ...validSession, projectPath: 123 })).toBe(false);
    expect(isValidSession({ ...validSession, focus: 123 })).toBe(false);
    expect(isValidSession({ ...validSession, trail: "not-array" })).toBe(false);
    expect(isValidSession({ ...validSession, visited: [123] })).toBe(false);
    expect(isValidSession({ ...validSession, savedAt: "not-a-number" })).toBe(false);
    expect(isValidSession(validSession)).toBe(true);
  });

  it("saveSession salva e loadSession restaura a sessão corretamente", () => {
    const input: SessionInput = {
      theme: "light",
      lens: "coupling",
      projectPath: "/my/repo",
      focus: "class:src/A.ts:A",
      level: 3,
      trail: ["project", "module:src", "class:src/A.ts:A"],
      visited: new Set(["module:src", "class:src/A.ts:A"]),
      selected: "class:src/A.ts:A",
    };

    expect(saveSession(input)).toBe(true);
    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.theme).toBe("light");
    expect(loaded?.lens).toBe("coupling");
    expect(loaded?.projectPath).toBe("/my/repo");
    expect(loaded?.focus).toBe("class:src/A.ts:A");
    expect(loaded?.level).toBe(3);
    expect(loaded?.trail).toEqual(["project", "module:src", "class:src/A.ts:A"]);
    expect(loaded?.visited).toEqual(["module:src", "class:src/A.ts:A"]);
    expect(loaded?.selected).toBe("class:src/A.ts:A");
    expect(typeof loaded?.savedAt).toBe("number");
  });

  it("createSessionSnapshot limita a lista de visitados a 1000 nós", () => {
    const visited = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      visited.add(`node:${i}`);
    }
    const input: SessionInput = {
      theme: "dark",
      lens: "layers",
      projectPath: "/repo",
      focus: null,
      level: 1,
      trail: [],
      visited,
    };
    const snap = createSessionSnapshot(input);
    expect(snap.visited).toHaveLength(1000);
    expect(snap.visited[999]).toBe("node:1199");
  });

  it("clearSession limpa a chave do storage", () => {
    saveSession({
      theme: "dark",
      lens: "layers",
      projectPath: "/proj",
      focus: null,
      level: 1,
      trail: [],
      visited: new Set(),
    });
    expect(loadSession()).not.toBeNull();
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("hasSessionChanged detecta alterações relevantes", () => {
    const base: SessionInput = {
      theme: "dark",
      lens: "layers",
      projectPath: "/repo",
      focus: "module:core",
      level: 2,
      trail: ["project", "module:core"],
      visited: new Set(["module:core"]),
      selected: "module:core",
    };

    expect(hasSessionChanged(null, base)).toBe(true);
    expect(hasSessionChanged(base, { ...base })).toBe(false);
    expect(hasSessionChanged(base, { ...base, theme: "light" })).toBe(true);
    expect(hasSessionChanged(base, { ...base, lens: "domain" })).toBe(true);
    expect(hasSessionChanged(base, { ...base, projectPath: "/other" })).toBe(true);
    expect(hasSessionChanged(base, { ...base, focus: null })).toBe(true);
    expect(hasSessionChanged(base, { ...base, level: 1 })).toBe(true);
    expect(hasSessionChanged(base, { ...base, selected: null })).toBe(true);
    expect(hasSessionChanged(base, { ...base, trail: ["project"] })).toBe(true);
    expect(hasSessionChanged(base, { ...base, visited: new Set(["module:core", "module:api"]) })).toBe(true);
  });

  it("trata exceções no localStorage de forma segura", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Quota/Privacy error");
    });
    expect(loadSession()).toBeNull();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Disk full");
    });
    expect(
      saveSession({
        theme: "dark",
        lens: "layers",
        projectPath: null,
        focus: null,
        level: 1,
        trail: [],
        visited: new Set(),
      }),
    ).toBe(false);
  });
});
