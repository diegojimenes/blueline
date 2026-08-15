# Spec 00 — Overview & Decisões

> Índice das specs + registro de decisões de arquitetura (ADR). Leia em conjunto com `docs/01-vision.md`.

## Índice

| Spec | Assunto |
|---|---|
| `00-overview.md` | Este documento: decisões + visão geral da arquitetura |
| `01-mvp-scope.md` | Escopo do MVP: dentro/fora, critérios de aceite |
| `02-architecture.md` | Camadas, processos, estrutura de repositório |
| `03-data-model.md` | CodeGraph: nós, arestas, IDs, snapshots, diffs |
| `04-analysis-pipeline.md` | Parsing tree-sitter, indexação, re-parse incremental |
| `05-rendering.md` | Zoom semântico, layout, portais, trilha |
| `06-lenses.md` | Lentes: Camadas, Domínio, Acoplamento |
| `07-ui-layout.md` | Layout IDE: Explorer, Canvas, Inspector, Status bar |
| `08-terminal.md` | PTY real, xterm.js, comandos determinísticos |
| `09-live-updates.md` | Watcher, debounce, diff, integração git |
| `10-events-and-api.md` | Barramento tipado, comandos Tauri, IPC |
| `11-testing.md` | Estratégia de testes, fixtures, golden graphs |
| `12-milestones.md` | Marcos M0–M5 e backlog pós-MVP |

## Decisões (ADR)

### D1 — Análise em TypeScript, backend fino em Rust
Parsing (tree-sitter WASM), grafo, diff e lentes vivem em `src/core` (TS puro), testável com vitest.
O backend Tauri/Rust é fino: file watcher, PTY, git. Razão: a maior parte da lógica e dos testes fica onde é
mais rápida de iterar, e o núcleo roda também fora do Tauri (CLI de teste).

### D2 — Terminal via `portable-pty` (Rust) + xterm.js (frontend)
O backend hospeda o processo real do shell/agente; o frontend apenas renderiza e envia input.
Evita sidecar Node.js com `node-pty`.

### D3 — Renderer do grafo: canvas 2D custom com culling
Zoom semântico e troca de representação exigem controle fino; uma lib de grafo genérica (ex.: React Flow)
atende mal o contrato de "trocar representação por nível". Labels/portais em overlay DOM. WebGL fica como
otimização futura.

### D4 — Watcher no backend (`notify`), eventos via IPC
O backend observa o working dir, faz debounce e emite eventos de arquivos alterados. O frontend decide
re-parses e diffs (o pipeline vive em `src/core`).

### D5 — MVP só TypeScript/JavaScript
Linguagem única até o pipeline TS/JS estar sólido. A interface `Parser` (`specs/04-analysis-pipeline.md`)
é o ponto de extensão futuro.

### D6 — Modelo normalizado com IDs estáveis
Nós têm ID estável derivado do caminho + símbolo; a UI nunca guarda estado de grafo, apenas se inscreve.
Permite diff confiável entre snapshots.

### D7 — Git diff como fonte de verdade de "o que mudou"
Watcher sinaliza arquivo salvo; o `git diff` (quando repo for git) confirma mudança real e fornece o conteúdo.
Em repositórios não-git, fallback para comparação de conteúdo do watcher.

### D8 — Camada 1 (universal) primeiro; camada 2 (hooks por agente) depois
Integração universal via watcher é o MVP. Hooks `PreToolUse`/`PostToolUse` (Claude Code) ficam como
enriquecimento pós-MVP (`specs/12-milestones.md`), mas o barramento de eventos já é desenhado para absorvê-los.

## Princípios não-negociáveis

1. Núcleo (`src/core`) sem dependência de Tauri/React/DOM. Tudo testável em Node.
2. Toda navegação (grafo, árvore, teclado, terminal) passa pelo mesmo comando e gera histórico.
3. Zoom é troca de representação, nunca transformação de câmera.
4. Lente nunca muda a posição espacial que o usuário já aprendeu.
5. UI só lê o modelo; modelo nunca lê a UI.
