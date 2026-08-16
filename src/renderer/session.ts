/**
 * Persistência de sessão (M6, specs/12-milestones.md).
 *
 * Guarda no `localStorage` do webview o estado que faz sentido restaurar ao
 * reabrir o app: tema, lente, último projeto e a navegação (foco/nível/trilha/
 * visitados/selecionado). A restauração re-parseia o projeto e valida se o nó
 * ainda existe no grafo atual.
 */

import type { LensId, Level, NodeId } from "../core";
import type { Theme } from "./store";

export interface SavedSession {
  version: 1;
  theme: Theme;
  lens: LensId;
  projectPath: string | null;
  focus: NodeId | null;
  level: Level;
  trail: NodeId[];
  visited: NodeId[];
  selected: NodeId | null;
  savedAt: number;
}

export interface SessionInput {
  theme: Theme;
  lens: LensId;
  projectPath: string | null;
  focus: NodeId | null;
  level: Level;
  trail: NodeId[];
  visited: Set<NodeId> | NodeId[];
  selected?: NodeId | null;
}

export const SESSION_STORAGE_KEY = "codeatlas:session";
const MAX_VISITED_NODES = 1000;

const VALID_THEMES = new Set<Theme>(["dark", "light"]);
const VALID_LENSES = new Set<LensId>(["layers", "coupling", "domain"]);

export function isValidSession(data: unknown): data is SavedSession {
  if (!data || typeof data !== "object") return false;
  const s = data as Partial<SavedSession>;
  if (s.version !== 1) return false;
  if (!s.theme || !VALID_THEMES.has(s.theme)) return false;
  if (!s.lens || !VALID_LENSES.has(s.lens)) return false;
  if (typeof s.level !== "number" || s.level < 1 || s.level > 5) return false;
  if (s.projectPath !== null && typeof s.projectPath !== "string") return false;
  if (s.focus !== null && typeof s.focus !== "string") return false;
  if (s.selected !== undefined && s.selected !== null && typeof s.selected !== "string") return false;
  if (!Array.isArray(s.trail) || !s.trail.every((id) => typeof id === "string")) return false;
  if (!Array.isArray(s.visited) || !s.visited.every((id) => typeof id === "string")) return false;
  if (typeof s.savedAt !== "number" || isNaN(s.savedAt)) return false;
  return true;
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!isValidSession(data)) return null;
    return {
      ...data,
      selected: data.selected ?? data.focus ?? null,
    };
  } catch {
    return null;
  }
}

export function createSessionSnapshot(current: SessionInput): SavedSession {
  const visitedArray = Array.isArray(current.visited)
    ? current.visited
    : Array.from(current.visited);
  const cappedVisited =
    visitedArray.length > MAX_VISITED_NODES
      ? visitedArray.slice(-MAX_VISITED_NODES)
      : visitedArray;

  return {
    version: 1,
    theme: current.theme,
    lens: current.lens,
    projectPath: current.projectPath,
    focus: current.focus,
    level: current.level,
    trail: [...current.trail],
    visited: cappedVisited,
    selected: current.selected ?? current.focus ?? null,
    savedAt: Date.now(),
  };
}

export function saveSession(current: SessionInput): boolean {
  try {
    const session = createSessionSnapshot(current);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    // Armazenamento indisponível (browser com privacidade restrita, quota etc.) — segue sem persistir.
    return false;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // noop
  }
}

/**
 * Compara se duas instâncias de sessão contêm os mesmos valores funcionais
 * (ignorando savedAt), evitando escritas desnecessárias no localStorage.
 */
export function hasSessionChanged(
  prev: SessionInput | null,
  next: SessionInput,
): boolean {
  if (!prev) return true;
  if (prev.theme !== next.theme) return true;
  if (prev.lens !== next.lens) return true;
  if (prev.projectPath !== next.projectPath) return true;
  if (prev.focus !== next.focus) return true;
  if (prev.level !== next.level) return true;
  if (prev.selected !== next.selected) return true;
  if (prev.trail.length !== next.trail.length) return true;
  for (let i = 0; i < prev.trail.length; i++) {
    if (prev.trail[i] !== next.trail[i]) return true;
  }
  const prevVisitedSize = prev.visited instanceof Set ? prev.visited.size : prev.visited.length;
  const nextVisitedSize = next.visited instanceof Set ? next.visited.size : next.visited.length;
  if (prevVisitedSize !== nextVisitedSize) return true;

  return false;
}
