import { create } from "zustand";
import {
  cmdUp,
  gotoNode,
  runCommand,
  type CommandResult,
  type HistoryEntry,
  type LensId,
  type LayoutMap,
  type NavigationState,
  type NodeId,
  type SerializedGraph,
} from "../../core";
import { demoGraph } from "../demo/demoGraph";

export type Theme = "dark" | "light";

export interface LogLine {
  id: number;
  text: string;
  /** Quando definido, a linha é clicável e volta ao nó. */
  target: NodeId | null;
}

interface AppState extends NavigationState {
  theme: Theme;
  projectOpen: boolean;
  projectPath: string | null;
  graph: SerializedGraph | null;
  /** Posições cacheadas por (level, focus) — a lente nunca move (D7). */
  layout: LayoutMap | null;
  history: HistoryEntry[];
  log: LogLine[];

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLens: (lens: LensId) => void;
  setSelected: (selected: NodeId | null) => void;
  setLayout: (layout: LayoutMap | null) => void;
  loadDemo: () => void;
  /** Executa um comando do terminal (`goto`, `up`, `ls`, `lens`, `help`, `clear`). */
  dispatch: (command: string) => void;
  /** Entra no nó (duplo clique no canvas) — mesmo caminho de histórico do `goto`. */
  enterNode: (id: NodeId) => void;
  /** Navega lateralmente para um nó (clique em portal / breadcrumb). */
  gotoId: (id: NodeId) => void;
  up: () => void;
}

const initialNavigation: NavigationState = {
  focus: null,
  level: 1,
  lens: "layers",
  trail: [],
  selected: null,
  visited: new Set(),
};

let nextLogId = 1;

/**
 * Store da UI (specs/07-ui-layout.md).
 *
 * A navegação NUNCA é editada direto: passa por `core/commands`, que devolve
 * o novo NavigationState + entradas de histórico clicável. A UI apenas
 * inscreve-se no resultado.
 */
export const useStore = create<AppState>()((set, get) => {
  const apply = (result: CommandResult, label: string) => {
    const s = get();
    const echo: LogLine = { id: nextLogId++, text: `$ ${label}`, target: null };
    const out: LogLine[] = result.lines.map((text, i) => ({
      id: nextLogId++,
      text,
      target: i === result.lines.length - 1 ? result.target : null,
    }));
    set({
      ...result.nav,
      history: [...s.history, ...result.entries],
      log: [...s.log, echo, ...out],
    });
  };

  return {
    ...initialNavigation,
    theme: "dark",
    projectOpen: false,
    projectPath: null,
    graph: null,
    layout: null,
    history: [],
    log: [],

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    setLens: (lens) => set({ lens }),
    setSelected: (selected) => set({ selected }),
    setLayout: (layout) => set({ layout }),

    loadDemo: () =>
      set({
        graph: demoGraph,
        projectOpen: true,
        projectPath: demoGraph.projectRoot,
        ...initialNavigation,
        history: [],
        log: [],
      }),

    dispatch: (command) => {
      const s = get();
      const trimmed = command.trim();
      if (trimmed === "clear") {
        set({ log: [] });
        return;
      }
      if (!s.graph) {
        apply({ nav: s, entries: [], lines: ["nenhum projeto carregado (demo via duplo clique)"], target: null }, trimmed);
        return;
      }
      apply(runCommand(s.graph, s, trimmed, {}), trimmed);
    },

    enterNode: (id) => {
      const s = get();
      if (!s.graph) return;
      apply(gotoNode(s.graph, s, id, {}), `goto (duplo clique)`);
    },

    gotoId: (id) => {
      const s = get();
      if (!s.graph) return;
      apply(gotoNode(s.graph, s, id, {}), "goto (portal)");
    },

    up: () => {
      const s = get();
      if (!s.graph) return;
      apply(cmdUp(s.graph, s, {}), "up");
    },
  };
});
