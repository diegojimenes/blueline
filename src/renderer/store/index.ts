import { create } from "zustand";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  applyFileRemovals,
  applyFiles,
  buildGraph,
  cacheFrom,
  cmdLens,
  cmdUp,
  fromJSON,
  gotoNode,
  navigationToNode,
  runCommand,
  toJSON,
  upNavigation,
  type BuildFileInput,
  type CommandResult,
  type HistoryEntry,
  type LensId,
  type LayoutMap,
  type ModelDelta,
  type NavigationState,
  type NodeId,
  type ProjectConfig,
  type SerializedGraph,
  type SymbolCache,
} from "../../core";
import { demoGraph } from "../demo/demoGraph";
import { demoConfig } from "../demo/demoConfig";
import { getParser } from "../parser";

export type Theme = "dark" | "light";

export interface LogLine {
  id: number;
  text: string;
  /** Quando definido, a linha é clicável e volta ao nó. */
  target: NodeId | null;
}

export type WatcherState = "off" | "active" | "updated";

interface ProjectFile {
  path: string;
  content: string;
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
  /** Símbolos parseados por arquivo — base do re-parse incremental (M5). */
  symbols: SymbolCache;
  /** Estado do file watcher para a status bar (M5). */
  watcherState: WatcherState;
  watcherTime: string | null;
  /** Nós a pulsar após a última mudança externa (M5). */
  flash: { ids: NodeId[]; at: number } | null;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLens: (lens: LensId) => void;
  cycleLens: () => void;
  setSelected: (selected: NodeId | null) => void;
  setLayout: (layout: LayoutMap | null) => void;
  loadDemo: () => void;
  /** Abre um diretório real: walk + parse inicial + watcher (M5). */
  openProject: (path: string) => Promise<void>;
  /** Re-parse incremental de um batch de arquivos tocados pelo watcher (M5). */
  applyExternalChanges: (paths: string[]) => Promise<void>;
  startWatcher: () => Promise<void>;
  stopWatcher: () => void;
  /** Executa um comando determinístico e devolve o resultado (terminal real). */
  execCommand: (command: string) => CommandResult;
  /** Executa um comando do terminal (`goto`, `up`, `ls`, `lens`, `help`, `clear`, `open`). */
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
    symbols: new Map(),
    watcherState: "off",
    watcherTime: null,
    flash: null,

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
      symbols: new Map(),
      watcherState: "off",
      watcherTime: null,
      flash: null,
    }),

  openProject: async (path) => {
    const parser = await getParser();
    const files = await invoke<ProjectFile[]>("read_project", { projectPath: path });
    const inputs: BuildFileInput[] = [];
    for (const f of files) {
      if (!parser.supports(f.path)) continue;
      inputs.push({ path: f.path, symbols: parser.parseFile(f.path, f.content) });
    }
    const graph = buildGraph(inputs, path, {}).graph;
    set({
      graph: toJSON(graph, {}),
      symbols: cacheFrom(inputs),
      config: {},
      projectOpen: true,
      projectPath: path,
      ...initialNavigation,
      history: [],
      historyIndex: 0,
      flash: null,
      watcherTime: null,
      log: [...get().log, { id: nextLogId++, text: `projeto aberto: ${path} (${inputs.length} arquivos)`, target: null }],
    });
    void get().startWatcher();
  },

  applyExternalChanges: async (paths) => {
    const s = get();
    if (!s.projectPath || !s.graph || !isTauri()) return;
    const parser = await getParser();
    const root = s.projectPath;
    const changed: BuildFileInput[] = [];
    const removed: string[] = [];
    for (const rel of paths) {
      try {
        const content = await invoke<string>("file_read", { projectPath: root, relPath: rel });
        if (parser.supports(rel)) changed.push({ path: rel, symbols: parser.parseFile(rel, content) });
      } catch {
        removed.push(rel);
      }
    }
    const cur = get();
    if (!cur.graph) return;
    const before = fromJSON(cur.graph);
    const result =
      removed.length > 0 && changed.length === 0
        ? applyFileRemovals(before, cur.symbols, removed, root, cur.config, "parseIncremental")
        : applyFiles(before, cur.symbols, changed, root, cur.config, "parseIncremental");
    if (result.graph === before) return; // no-op: touch sem mudança real
    applyDelta(set, cur, result.delta, result.graph);
  },

  startWatcher: async () => {
    const s = get();
    if (!isTauri() || !s.projectPath) return;
    try {
      await invoke("watch_start", { projectPath: s.projectPath });
      set({ watcherState: "active" });
    } catch {
      // Já ativo ou backend indisponível — demo segue sem live update.
    }
  },

  stopWatcher: () => {
    if (!isTauri()) return;
    void invoke("watch_stop").catch(() => {});
    set({ watcherState: "off" });
  },

  /** Executa um comando determinístico e devolve o resultado completo (terminal real usa isto). */
  execCommand: (command) => {
    const s = get();
    const trimmed = command.trim();
    if (trimmed === "clear") {
      const result: CommandResult = { nav: s, entries: [], lines: [], target: null };
      set({ log: [] });
      return result;
    }
    if (trimmed.startsWith("open ")) {
      const path = trimmed.slice(5).trim();
      if (!path) {
        const result: CommandResult = { nav: s, entries: [], lines: ["uso: open <diretório>"], target: null };
        apply(result, trimmed);
        return result;
      }
      if (!isTauri()) {
        const result: CommandResult = {
          nav: s,
          entries: [],
          lines: ["abrir projeto requer o app Tauri (pnpm tauri dev) — demo carregada"],
          target: null,
        };
        apply(result, trimmed);
        return result;
      }
      const result: CommandResult = { nav: s, entries: [], lines: [`abrindo ${path}…`], target: null };
      apply(result, trimmed);
      void get().openProject(path).catch((err) => {
        set({ log: [...get().log, { id: nextLogId++, text: `falha ao abrir: ${String(err)}`, target: null }] });
      });
      return result;
    }
    if (!s.graph) {
      const result: CommandResult = {
        nav: s,
        entries: [],
        lines: ["nenhum projeto carregado (demo via duplo clique; abra um com `open <dir>`)"],
        target: null,
      };
      apply(result, trimmed);
      return result;
    }
    const result = runCommand(s.graph, s, trimmed, { config: s.config });
    apply(result, trimmed);
    return result;
  },

  dispatch: (command) => {
    get().execCommand(command);
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

function applyDelta(
  set: (partial: Partial<AppState>) => void,
  cur: AppState,
  delta: ModelDelta,
  next: ReturnType<typeof fromJSON>,
): void {
  const affected = new Set<NodeId>([...delta.added.map((n) => n.id), ...delta.changed.map((n) => n.id)]);
  set({
    graph: toJSON(next, cur.config),
    flash: affected.size > 0 ? { ids: [...affected], at: Date.now() } : null,
    watcherState: "updated",
    watcherTime: new Date().toLocaleTimeString(),
  });
}

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
