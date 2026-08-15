import { create } from "zustand";
import type { HistoryEntry, LensId, Level, NavigationState, NodeId } from "../../core";

export type Theme = "dark" | "light";

interface AppState extends NavigationState {
  theme: Theme;
  projectOpen: boolean;
  projectPath: string | null;
  history: HistoryEntry[];
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLevel: (level: Level) => void;
  setLens: (lens: LensId) => void;
  setFocus: (focus: NodeId | null) => void;
  setSelected: (selected: NodeId | null) => void;
  appendHistory: (entry: HistoryEntry) => void;
  resetNavigation: () => void;
}

const initialNavigation: NavigationState = {
  focus: null,
  level: 1,
  lens: "layers",
  trail: [],
  selected: null,
  visited: new Set(),
};

/**
 * Store da UI (specs/07-ui-layout.md).
 *
 * Regra de ouro: a UI apenas se inscreve no modelo e em eventos do núcleo.
 * Navegação/lógica de análise vivem em `src/core/commands` (M2 em diante);
 * este store guarda estado de apresentação e o histórico do terminal.
 */
export const useStore = create<AppState>()((set) => ({
  ...initialNavigation,
  theme: "dark",
  projectOpen: false,
  projectPath: null,
  history: [],

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  setLevel: (level) => set({ level }),
  setLens: (lens) => set({ lens }),
  setFocus: (focus) => set({ focus }),
  setSelected: (selected) => set({ selected }),
  appendHistory: (entry) => set((s) => ({ history: [...s.history, entry] })),
  resetNavigation: () => set(initialNavigation),
}));
