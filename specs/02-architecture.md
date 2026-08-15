# Spec 02 — Arquitetura

> Camadas, processos e estrutura de repositório. Decisões em `00-overview.md`.

## Visão de camadas

```
┌────────────────────────── Frontend (webview) ─────────────────────────┐
│ src/renderer (React + Vite)                                            │
│   Componentes UI · Canvas renderer · xterm.js · Store (subscribe-only) │
│   ▲                                                     ▲              │
│   │ inscreve-se em eventos / lê modelo                  │ PTY I/O      │
│   ▼                                                     ▼              │
│ ┌────────────────────────── src/core (TS puro) ──────────────────────┐ │
│ │ Parsing (tree-sitter WASM) · CodeGraph · Diff · Lenses · Comandos  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────  IPC (Tauri)  ───────────────────────────────┘
                             ▲            ▲
                     file events          shell I/O
                             │            │
┌────────────────────────── Backend (Rust) ─────────────────────────────┐
│ src-tauri                                                             │
│   Watcher (notify) · PTY (portable-pty) · Git · Project provider      │
└────────────────────────────────────────────────────────────────────────┘
```

- **`src/core`** é agnóstico de framework: roda em Node (testes, CLI) e no webview (worker). Nenhum import de
  Tauri/React/DOM.
- **`src/renderer`** é a única camada que conhece React e a webview. Não contém lógica de análise.
- **`src-tauri`** provê serviços via commands e emite eventos; não conhece o formato do grafo (só envia
  conteúdo cru + paths).

## Processos

1. **Processo principal (Tauri/Rust)**: janela, watcher, PTY, git. Comunica com o webview por IPC events/commands.
2. **Webview (frontend)**: UI + xterm.js. Host do worker de análise.
3. **Worker de análise (dentro da webview ou via `Worker` do TS)**: roda tree-sitter WASM e o pipeline do
   `src/core` sem travar a UI.

```
Rust (watcher) ──file:changed──▶ Core (re-parse + diff) ──model:changed──▶ Store ──▶ Canvas/UI
                                                                                └─▶ Terminal log
```

## Estrutura de repositório

```
├── AGENTS.md
├── docs/                  # contexto (visão, produto, glossário)
├── specs/                 # especificação técnica (este índice)
├── src/
│   ├── core/              # TS puro, testável (D1)
│   │   ├── model/         #   CodeGraph, tipos, IDs, snapshots
│   │   ├── parse/         #   tree-sitter, Parser interface
│   │   ├── analyze/       #   indexação de símbolos, arestas, módulos
│   │   ├── diff/          #   diff estrutural + eventos
│   │   ├── lenses/        #   Camadas, Domínio, Acoplamento
│   │   ├── commands/      #   goto/up/ls/lens (núcleo, sem terminal)
│   │   └── index.ts       #   API pública do núcleo
│   └── renderer/          # React + Vite
│       ├── components/    #   Explorer, Canvas, Inspector, Terminal, StatusBar
│       ├── store/         #   assinatura de eventos do modelo (D6)
│       └── workers/       #   análise em worker
├── src-tauri/             # Rust (D2, D4)
│   ├── src/watcher.rs
│   ├── src/ptys.rs
│   ├── src/git.rs
│   └── ...
├── fixtures/              # projetos TS fictícios para testes
└── package.json
```

## Fluxos principais

### Abrir projeto
1. Usuário escolhe diretório → command `project_open(dir)` no backend.
2. Backend inicia watcher e responde com lista de arquivos (relative paths).
3. Frontend dispara parse inicial no worker (`core`), constrói CodeGraph e notifica `model:changed`.
4. Store atualiza; canvas renderiza nível 1.

### Navegação (grafo, árvore ou terminal)
1. Qualquer origem chama o mesmo comando `navigate(target, level)` em `core/commands`.
2. O comando atualiza o foco/trilha no modelo e emite `navigation:changed` + `history:appended`.
3. Terminal loga; breadcrumb e status bar atualizam; canvas re-renderiza o nível.

### Edição externa (agente rodando no PTY)
1. Agente salva arquivo → watcher emite `files:changed` (paths + mtime).
2. Backend faz debounce (rajada de writes) e envia batch ao frontend.
3. Core re-parseia só os arquivos alterados, faz diff contra o snapshot e emite `model:changed` com o delta.
4. UI destaca nós afetados; Inspector/árvore atualizam.

### Git como fonte de verdade
1. Em repo git, backend responde `git_diff(path)` / `git_status()`.
2. Core usa o diff para confirmar mudança real e como entrada do re-parse quando aplicável.

## Dependências técnicas (recomendadas)

- Frontend: React 18+, Vite, TypeScript, xterm.js, Zustand (store fino) — só UI.
- Análise: `web-tree-sitter` (WASM) + gramática TypeScript.
- Backend: Tauri 2, `notify`, `portable-pty`, `git2` (ou shell `git` via `std::process` no MVP).
- Testes: vitest, @testing-library/react, cargo test.

> Ajustes finos de versão ficam no marco M0 (`12-milestones.md`), respeitando esta arquitetura.
