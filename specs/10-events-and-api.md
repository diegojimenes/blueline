# Spec 10 — Eventos & API (Barramento)

> Contrato tipado entre backend (Rust), núcleo (TS) e UI. Todos os eventos são estruturas de dados
> simples e serializáveis — é também o ponto de extensão para a camada 2 (hooks por agente).

## Barramento (frontend)

- Store central (`renderer/store`) é a única assinante dos eventos do modelo (D6).
- Eventos emitidos pelo núcleo são **deltas** (nunca estado completo), exceto `project:loaded`.

```ts
type CoreEvent =
  | { type: 'project:loaded'; graph: CodeGraph; snapshotRev: number }
  | { type: 'model:changed'; delta: ModelDelta; snapshotRev: number }
  | { type: 'navigation:changed'; state: NavigationState }
  | { type: 'history:appended'; entry: HistoryEntry }
  | { type: 'lens:changed'; lens: LensId }
  | { type: 'parse:progress'; parsed: number; total: number }; // UI: status bar

type BackendEvent =
  | { type: 'files:changed'; paths: string[]; mtime: number }
  | { type: 'ptty:data'; data: string }
  | { type: 'ptty:exit'; code: number | null }
  | { type: 'git:status'; dirty: string[] };
```

## Commands (Tauri)

| Command | Args | Retorno | Uso |
|---|---|---|---|
| `project_open` | `dir: string` | `{ files: string[]; isGit: boolean }` | abrir projeto |
| `project_config` | — | `ProjectConfig` | `codeatlas.json` (lens domain, ignore, regras de módulo) |
| `file_read` | `path: string` | `string` | conteúdo p/ re-parse |
| `git_status` | — | `{ dirty: string[] }` | confirmar mudanças reais |
| `git_diff` | `path?: string` | `string` (unified diff) | fonte de verdade (D7) |
| `ptty_spawn` | — | — | abre shell no cwd do projeto |
| `ptty_write` | `data: string` | — | input do usuário → PTY |
| `ptty_resize` | `{ cols, rows }` | — | resize do xterm.js |

- Commands do terminal CodeAtlas (`goto`/`ls`/…) **não** passam pelo Tauri: são puros em `src/core/commands`
  (rodam no webview). Só o shell vai ao PTY.

## Fluxo de eventos (sequência canônica)

### Navegação
```
UI (duplo clique / árvore / comando)
  → core.commands.navigate(state, graph, target)
  → newState + output
  → emit navigation:changed → store
  → emit history:appended → terminal log (linha clicável)
  → renderer desenha (canvas/breadcrumb/status bar)
```

### Mudança externa (agente no PTY)
```
Rust watcher → files:changed (batch, debounced)
  → worker: re-parse incremental + git confirm → model:changed (delta)
  → store → canvas/Explorer/Inspector/status bar
```

## Camada 2 (pós-MVP) — extensibilidade

- Para hooks de agente (ex.: Claude Code `PreToolUse`/`PostToolUse`), o barramento precisa de um novo backend
  event `agent:tool` (`{ tool, file, before/after }`). O design acima absorve com um novo caso em `CoreEvent`/
  `BackendEvent` + handler de live-update — sem mudar o contrato do modelo. Ver backlog em `12-milestones.md`.

## Contratos

1. Todo evento é serializável (`JSON.stringify`) e sem referências circulares.
2. `revision`/`snapshotRev` são monotônicos; a UI ignora eventos com rev menor ou igual à atual (stale).
3. Commands são síncronos em semântica (retornam resultado) e os eventos de mudança são fire-and-forget.
4. Tipos compartilhados: `src/core/events.ts` exporta os tipos usados pelo renderer; Rust replica a shape
   (sem gerador automático no MVP — manter teste de shape no limite).
