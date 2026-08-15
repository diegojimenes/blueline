import { create } from "zustand";
import {
  cmdLens,
  cmdUp,
  gotoNode,
  navigationToNode,
  runCommand,
  upNavigation,
  type CommandResult,
  type HistoryEntry,
  type LensId,
  type LayoutMap,
  type NavigationState,
  type NodeId,
  type ProjectConfig,
  type SerializedGraph,
} from "../../core";
import { demoGraph } from "../demo/demoGraph";
import { demoConfig } from "../demo/demoConfig";

export type Theme = "dark" | "light";

export interface LogLine {
  id: number;
  text: string;
  /** Quando definido, a linha é clicável e volta ao nó. */
  target: NodeId | null;
}

const LENS_ORDER: LensId[] = ["layers", "coupling", "domain"];

interface AppState extends NavigationState {
  theme: Theme;
  projectOpen: boolean;
  projectPath: string | null;
  graph: SerializedGraph | null;
  /** Config do projeto (demo simula um `codeatlas.json`). */
  config: ProjectConfig;
  /** Posições cacheadas por (level, focus) — a lente nunca move (D7). */
  layout: LayoutMap | null;
  history: HistoryEntry[];
  /** Índice do cursor no histórico de foco (Alt+← / Alt+→). */
  historyIndex: number;
  log: LogLine[];

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLens: (lens: LensId) => void;
  cycleLens: () => void;
  setSelected: (selected: NodeId | null) => void;
  setLayout: (layout: LayoutMap | null) => void;
  loadDemo: () => void;
  /** Executa um comando do terminal (`goto`, `up`, `ls`, `lens`, `help`, `clear`). */
  dispatch: (command: string) => void;
  /** Entra no nó (duplo clique no canvas) — mesmo caminho de histórico do `goto`. */
  enterNode: (id: NodeId) => void;
  /** Navega lateralmente para um nó (clique em portal / breadcrumb / Explorer). */
  gotoId: (id: NodeId) => void;
  up: () => void;
  back: () => void;
  forward: () => void;
  /** Foca o terminal (atalho `/`). */
  focusTerminal: () => void;
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
    // Navegar depois de voltar no histórico trunca o caminho à frente.
    const base = s.history.slice(0, s.historyIndex);
    const history = [...base, ...result.entries];
    const echo: LogLine = { id: nextLogId++, text: `$ ${label}`, target: null };
    const out: LogLine[] = result.lines.map((text, i) => ({
      id: nextLogId++,
      text,
      target: i === result.lines.length - 1 ? result.target : null,
    }));
    set({
      ...result.nav,
      history,
      historyIndex: history.length,
      log: [...s.log, echo, ...out],
    });
  };

  return {
    ...initialNavigation,
    theme: "dark",
    projectOpen: false,
    projectPath: null,
    graph: null,
    config: demoConfig,
    layout: null,
    history: [],
    historyIndex: 0,
    log: [],

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    setLens: (lens) => set({ lens }),
    cycleLens: () => {
      const s = get();
      const next = LENS_ORDER[(LENS_ORDER.indexOf(s.lens) + 1) % LENS_ORDER.length];
      apply(cmdLens(s, next, {}), `lens ${next}`);
    },
    setSelected: (selected) => set({ selected }),
    setLayout: (layout) => set({ layout }),

    loadDemo: () =>
      set({
        graph: demoGraph,
        config: demoConfig,
        projectOpen: true,
        projectPath: demoGraph.projectRoot,
        ...initialNavigation,
        history: [],
        historyIndex: 0,
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
      apply(runCommand(s.graph, s, trimmed, { config: s.config }), trimmed);
    },

    enterNode: (id) => {
      const s = get();
      if (!s.graph) return;
      apply(gotoNode(s.graph, s, id, { config: s.config }), "goto (duplo clique)");
    },

    gotoId: (id) => {
      const s = get();
      if (!s.graph) return;
      apply(gotoNode(s.graph, s, id, { config: s.config }), "goto (portal)");
    },

    up: () => {
      const s = get();
      if (!s.graph) return;
      apply(cmdUp(s.graph, s, { config: s.config }), "up");
    },

    back: () => {
      const s = get();
      let idx = s.historyIndex - 1;
      const current = s.focus;
      while (idx >= 0) {
        const t = s.history[idx]?.target;
        if (t && t !== current) break;
        idx--;
      }
      if (idx < 0) {
        // Sem entrada anterior distinta: volta ao sistema (nível 1).
        if (s.level > 1) set({ ...upNavigation(s.graph!, s, s.config), historyIndex: 0 });
        return;
      }
      moveToIndex(s, idx, set);
    },

    forward: () => {
      const s = get();
      let idx = s.historyIndex;
      const current = s.focus;
      while (idx < s.history.length) {
        const t = s.history[idx]?.target;
        if (t && t !== current) break;
        idx++;
      }
      if (idx >= s.history.length) return;
      moveToIndex(s, idx, set);
    },

    focusTerminal: () => {
      window.dispatchEvent(new CustomEvent("codeatlas:terminal-focus"));
    },
  };
});

function moveToIndex(
  s: AppState,
  idx: number,
  set: (partial: Partial<AppState>) => void,
): void {
  const target = s.history[idx]?.target;
  if (!s.graph) {
    set({ historyIndex: idx });
    return;
  }
  if (!target) {
    set({ ...upNavigation(s.graph, s, s.config), historyIndex: idx });
    return;
  }
  const nav = navigationToNode(s.graph, s, target, s.config);
  set({ ...nav, historyIndex: idx });
}
