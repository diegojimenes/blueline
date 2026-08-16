import { create } from "zustand";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  applyFileRemovals,
  applyFiles,
  ancestorChain,
  buildGraph,
  cacheFrom,
  cmdLens,
  cmdUp,
  fromJSON,
  gotoNode,
  levelOfKind,
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
  type AgentAttentionEvent,
  type ProjectDiffSummary,
  mapDiffToSymbols,
  parseUnifiedDiff,
} from "../../core";
import { demoGraph } from "../demo/demoGraph";
import { demoConfig } from "../demo/demoConfig";
import { getParser } from "../parser";
import { hasSessionChanged, loadSession, saveSession, addRecentProject, type SessionInput } from "../session";

export type Theme = "dark" | "light";

export interface LogLine {
  id: number;
  text: string;
  /** Quando definido, a linha é clicável e volta ao nó. */
  target: NodeId | null;
}

export type WatcherState = "off" | "active" | "updated";

export interface GitStatus {
  repo: boolean;
  dirty: string[];
}

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
  /** Snapshot de baseline do grafo (início da sessão ou commit limpo) */
  baselineGraph: SerializedGraph | null;
  /** Resumo granular de diff por nó da AST com cálculo de magnitude */
  diffSummary: ProjectDiffSummary | null;
  /** Nós marcados como revisados pelo desenvolvedor durante a sessão */
  reviewedNodes: Set<NodeId>;
  /** Escopo de revisão (local no nó/módulo vs global no projeto) */
  reviewScope: "local" | "project";
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
  /** Estado git do projeto aberto (status bar + marcadores no Explorer). */
  gitRepo: boolean;
  gitDirty: string[];
  /** Notificação de foco / atividade de agentes de IA (M10). */
  agentAttention: AgentAttentionEvent | null;
  /** Visualizador expandido / modal de código & diff. */
  codeModalOpen: boolean;
  codeModalInitialTab: "code" | "diff" | "split";

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLens: (lens: LensId) => void;
  cycleLens: () => void;
  setSelected: (selected: NodeId | null) => void;
  setAgentAttention: (event: AgentAttentionEvent | null) => void;
  setReviewScope: (scope: "local" | "project") => void;
  toggleReviewed: (nodeId: NodeId) => void;
  markAsReviewed: (nodeId: NodeId) => void;
  openCodeModal: (tab?: "code" | "diff" | "split") => void;
  closeCodeModal: () => void;
  setLayout: (layout: LayoutMap | null) => void;
  loadDemo: () => void;
  /** Restaura a sessão salva (M6): tema/lente + reabre o projeto e valida a navegação. */
  restoreSession: () => Promise<void>;
  /** Abre um diretório real: walk + parse inicial + watcher (M5). */
  openProject: (path: string) => Promise<void>;
  /** Seletor de pasta (botão "Abrir" no header) → `openProject`. */
  openProjectDialog: () => Promise<void>;
  /** Re-parse incremental de um batch de arquivos tocados pelo watcher (M5). */
  applyExternalChanges: (paths: string[]) => Promise<void>;
  startWatcher: () => Promise<void>;
  stopWatcher: () => void;
  /** Consulta `git status --porcelain` e atualiza gitRepo/gitDirty (M5+). */
  refreshGitStatus: () => Promise<void>;
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
    baselineGraph: null,
    diffSummary: null,
    reviewedNodes: new Set<NodeId>(),
    reviewScope: "local",
    config: demoConfig,
    layout: null,
    history: [],
    historyIndex: 0,
    log: [],
    symbols: new Map(),
    watcherState: "off",
    watcherTime: null,
    flash: null,
    gitRepo: false,
    gitDirty: [],
    agentAttention: null,
    codeModalOpen: false,
    codeModalInitialTab: "diff",

    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
    setLens: (lens) => set({ lens }),
    cycleLens: () => {
      const s = get();
      const next = LENS_ORDER[(LENS_ORDER.indexOf(s.lens) + 1) % LENS_ORDER.length];
      apply(cmdLens(s, next, {}), `lens ${next}`);
    },
    setSelected: (selected) => set({ selected }),
    setAgentAttention: (agentAttention) => set({ agentAttention }),
    setReviewScope: (reviewScope) => set({ reviewScope }),
    toggleReviewed: (nodeId) =>
      set((s) => {
        const next = new Set(s.reviewedNodes);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return { reviewedNodes: next };
      }),
    markAsReviewed: (nodeId) =>
      set((s) => {
        const next = new Set(s.reviewedNodes);
        next.add(nodeId);
        return { reviewedNodes: next };
      }),
    openCodeModal: (tab = "diff") => set({ codeModalOpen: true, codeModalInitialTab: tab }),
    closeCodeModal: () => set({ codeModalOpen: false }),
    setLayout: (layout) => set({ layout }),

    loadDemo: () => {
      const demoDiffSummary: ProjectDiffSummary = {
        dirtyFiles: ["src/ecs/BehaviorSystem.ts"],
        symbols: new Map([
          [
            "class:src/ecs/BehaviorSystem.ts:BehaviorSystem",
            {
              nodeId: "class:src/ecs/BehaviorSystem.ts:BehaviorSystem",
              kind: "class",
              name: "BehaviorSystem",
              file: "src/ecs/BehaviorSystem.ts",
              additions: 12,
              deletions: 2,
              totalLinesChanged: 14,
              magnitude: "medium",
            },
          ],
          [
            "method:src/ecs/BehaviorSystem.ts:BehaviorSystem:update",
            {
              nodeId: "method:src/ecs/BehaviorSystem.ts:BehaviorSystem:update",
              kind: "method",
              name: "update",
              file: "src/ecs/BehaviorSystem.ts",
              additions: 8,
              deletions: 1,
              totalLinesChanged: 9,
              magnitude: "medium",
            },
          ],
        ]),
        fileSummaries: new Map([
          [
            "src/ecs/BehaviorSystem.ts",
            {
              file: "src/ecs/BehaviorSystem.ts",
              additions: 12,
              deletions: 2,
              totalLinesChanged: 14,
              magnitude: "medium",
            },
          ],
        ]),
      };

      set({
        graph: demoGraph,
        baselineGraph: demoGraph,
        diffSummary: demoDiffSummary,
        reviewedNodes: new Set<NodeId>(),
        reviewScope: "local",
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
        gitRepo: true,
        gitDirty: ["src/ecs/BehaviorSystem.ts"],
      });
    },

  restoreSession: async () => {
    const session = loadSession();
    if (!session) return;
    set({ theme: session.theme, lens: session.lens });
    if (!session.projectPath) return;
    try {
      await get().openProject(session.projectPath);
    } catch {
      // Projeto não existe mais ou falhou ao abrir — app segue limpo (tema/lente já aplicados).
      return;
    }
    const s = get();
    if (!s.graph) return;

    const visited = new Set(s.visited);
    for (const v of session.visited) {
      if (s.graph.nodes.some((n) => n.id === v) || v.startsWith("module:") || v === "project") {
        visited.add(v);
      }
    }

    if (!session.focus) {
      const selected =
        session.selected && s.graph.nodes.some((n) => n.id === session.selected)
          ? session.selected
          : null;
      set({ lens: session.lens, visited, selected });
      return;
    }

    const node = s.graph.nodes.find((n) => n.id === session.focus);
    if (!node) {
      // Nó removido/renomeado do projeto — fica no nível 1 (sistema) com visitados restaurados.
      set({ lens: session.lens, visited });
      return;
    }

    const trail = ancestorChain(s.graph, session.focus, s.config);
    const selected =
      session.selected && s.graph.nodes.some((n) => n.id === session.selected)
        ? session.selected
        : session.focus;

    set({
      lens: session.lens,
      focus: session.focus,
      level: levelOfKind(node.kind),
      trail,
      visited,
      selected,
    });
  },

  openProject: async (path) => {
    const parser = await getParser();
    get().stopWatcher();
    const files = await invoke<ProjectFile[]>("read_project", { projectPath: path });
    const inputs: BuildFileInput[] = [];
    for (const f of files) {
      if (!parser.supports(f.path)) continue;
      inputs.push({ path: f.path, symbols: parser.parseFile(f.path, f.content) });
    }
    const graph = buildGraph(inputs, path, {}).graph;
    const graphJson = toJSON(graph, {});
    const currentLens = get().lens;
    set({
      graph: graphJson,
      baselineGraph: graphJson,
      diffSummary: null,
      reviewedNodes: new Set<NodeId>(),
      reviewScope: "local",
      symbols: cacheFrom(inputs),
      config: {},
      projectOpen: true,
      projectPath: path,
      ...initialNavigation,
      lens: currentLens,
      history: [],
      historyIndex: 0,
      flash: null,
      watcherTime: null,
      log: [...get().log, { id: nextLogId++, text: `projeto aberto: ${path} (${inputs.length} arquivos)`, target: null }],
    });
    void get().startWatcher();
    void get().refreshGitStatus();
    addRecentProject(path);
  },

  openProjectDialog: async () => {
    if (!isTauri()) {
      get().focusTerminal();
      get().execCommand("open");
      return;
    }
    try {
      const selected = await openDialog({ directory: true, multiple: false, title: "Abrir projeto" });
      if (typeof selected === "string") {
        await get().openProject(selected);
      }
    } catch (err) {
      const s = get();
      set({ log: [...s.log, { id: nextLogId++, text: `falha ao abrir: ${String(err)}`, target: null }] });
    }
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
    void get().refreshGitStatus();
  },

  startWatcher: async () => {
    const s = get();
    if (!isTauri() || !s.projectPath) return;
    try {
      await invoke("watch_start", { projectPath: s.projectPath });
      set({ watcherState: "active" });
    } catch {
      // Já ativo ou backend indisponível — segue sem live update.
    }
  },

  stopWatcher: () => {
    if (!isTauri()) return;
    void invoke("watch_stop").catch(() => {});
    set({ watcherState: "off" });
  },

  refreshGitStatus: async () => {
    const s = get();
    if (!isTauri() || !s.projectPath) {
      set({ gitRepo: false, gitDirty: [], diffSummary: null });
      return;
    }
    try {
      const status = await invoke<GitStatus>("git_status", { projectPath: s.projectPath });
      let diffSummary: ProjectDiffSummary | null = null;
      if (status.repo && status.dirty.length > 0 && s.graph) {
        try {
          const fileDiffs = [];
          for (const rel of status.dirty) {
            const diffStr = await invoke<string>("git_diff", { projectPath: s.projectPath, relPath: rel });
            if (diffStr) {
              fileDiffs.push(...parseUnifiedDiff(diffStr));
            }
          }
          if (fileDiffs.length > 0) {
            diffSummary = mapDiffToSymbols(fileDiffs, s.graph);
          }
        } catch {
          // Mantém status básico caso haja erro em diff
        }
      }
      set({ gitRepo: status.repo, gitDirty: status.dirty, diffSummary });
    } catch {
      set({ gitRepo: false, gitDirty: [], diffSummary: null });
    }
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
          lines: ["abrir projeto requer o app Tauri (pnpm tauri dev)"],
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
        lines: ["nenhum projeto carregado — abra um com `open <diretório>` ou o botão “Abrir”"],
        target: null,
      };
      apply(result, trimmed);
      return result;
    }
    const result = runCommand(s.graph, s, trimmed, { config: s.config, gitDirty: s.gitDirty });
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

// Debounced persistência da sessão (M6).
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedInput: SessionInput | null = null;

export function flushSession(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const s = useStore.getState();
  const currentInput: SessionInput = {
    theme: s.theme,
    lens: s.lens,
    projectPath: s.projectPath,
    focus: s.focus,
    level: s.level,
    trail: s.trail,
    visited: s.visited,
    selected: s.selected,
  };
  saveSession(currentInput);
  lastSavedInput = currentInput;
}

useStore.subscribe((state) => {
  const currentInput: SessionInput = {
    theme: state.theme,
    lens: state.lens,
    projectPath: state.projectPath,
    focus: state.focus,
    level: state.level,
    trail: state.trail,
    visited: state.visited,
    selected: state.selected,
  };
  if (!hasSessionChanged(lastSavedInput, currentInput)) return;

  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveSession(currentInput);
    lastSavedInput = currentInput;
    persistTimer = null;
  }, 300);
});

