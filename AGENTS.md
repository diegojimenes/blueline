# CodeAtlas — Guia de Contexto para Agentes

Ferramenta desktop para **visualizar e revisar código** durante trabalho com agentes de IA.
Não é um agente, não é um chat, não é um linter. É uma **plataforma de entendimento e revisão**:
o usuário roda seu agente de IA favorito num terminal real (bash) e a plataforma mostra, em tempo real,
como a estrutura do código está evoluindo (módulos, classes, métodos e as ligações entre eles).

Nome de trabalho: **CodeAtlas**.

## Stack

- **Tauri 2** (backend em Rust): janela nativa, file watcher (`notify`), terminal real via PTY (`portable-pty`), comandos git.
- **TypeScript**: todo o núcleo de análise/domínio (`src/core`) + renderer React/Vite.
- **tree-sitter** (WASM) para parsing incremental de TypeScript/JavaScript.
- **xterm.js** para o terminal no frontend.
- Testes: **vitest** (core + componentes), **cargo test** (Rust).

## Como ler este repositório

- **`docs/`** — contexto e visão (o "porquê"). Comece por `docs/01-vision.md`.
- **`specs/`** — especificação técnica (o "como"). Comece por `specs/00-overview.md` (índice + decisões) e `specs/01-mvp-scope.md` (escopo do MVP).
- **`src/`** — código (quando existir): `src/core` (lógica pura, sem framework), `src/renderer` (UI), `src-tauri` (Rust).

## Regras de ouro (validar antes de codar)

1. **Modelo primeiro, UI depois.** O grafo de código é um modelo normalizado com IDs estáveis (`specs/03-data-model.md`). A UI apenas se inscreve em eventos do modelo.
2. **Núcleo testável e sem framework.** Toda lógica de análise mora em `src/core` (TypeScript puro), testável com vitest sem depender de Tauri/React.
3. **Zoom semântico, não zoom de câmera.** Cada nível de zoom troca a representação (sistema → módulos → classes → métodos). Transição é ação explícita (duplo clique / comando), nunca scroll infinito (`specs/05-rendering.md`).
4. **Terminal é barramento de eventos.** Todo comando de navegação (`goto`, `ls`, `lens`, `up`) é determinístico, logado no terminal, e cada linha do histórico é clicável para voltar (`specs/08-terminal.md`).
5. **Observar é mais importante que adivinhar.** Mudanças vêm de file watcher + re-parse incremental + diff. Git diff é a fonte de verdade do que mudou (`specs/09-live-updates.md`).
6. **MVP restrito a TypeScript/JavaScript.** Qualquer suporte a outra linguagem fica fora do escopo até o pipeline TS/JS estar sólido.

## Comandos

| Ação | Comando |
|---|---|
| Dev (Tauri + renderer) | `pnpm tauri dev` |
| Dev (só renderer) | `pnpm dev` |
| Testes core/UI | `pnpm test` (vitest) |
| Testes Rust | `cd src-tauri && cargo test` |
| Lint/typecheck | `pnpm lint` / `pnpm typecheck` |
| Build de produção | `pnpm build` |

> **M0 a M13 concluídos (Pipeline Completo CodeAtlas)**:
> - **M0 a M6 (MVP + Refinamentos + Sessão)**: layout IDE de 4 painéis, parse incremental TS/JS, grafo normalizado, zoom semântico (níveis 1 a 5), portais, lentes (Camadas/Acoplamento/Domínio), terminal real xterm.js + PTY Rust, live updates via `notify` + debounce, git status, e persistência de sessão.
> - **M7 (Busca Fuzzy Global)**: modal QuickSearch com atalhos `Ctrl+P`/`Cmd+P`/`/` e filtro O(1).
> - **M8 & M9 (Diff & Snapshots)**: diff visual unificado no Inspector e `computeGraphDiff` para comparação estrutural de revisões.
> - **M10 (Protocolo de Agente)**: contexto de símbolos/chamadas pronto para LLMs e notificação de atenção de IA na StatusBar.
> - **M11 (Extensibilidade Multi-Linguagem)**: `CompositeParser` + `PythonParser` para análise de repositórios Python (`.py`/`.pyi`).
> - **M12 (Performance & Cache)**: Spatial Grid Hash para culling a 60 FPS de grandes grafos e `GraphCacheStorage` para repositórios gigantes.
> - **M13 (Query Graph & Multi-Projeto)**: motor declarativo de queries estruturadas (`query kind:class layer:domain`), comando `query`/`q` no terminal e workspaces multi-projeto (`mergeWorkspaceGraphs`).
> 
> Estado atual: **8 testes cargo + 172 testes vitest + typecheck/lint 100% verdes**.

## Checklist ao trabalhar aqui

- [ ] Li `docs/01-vision.md` e `specs/00-overview.md`?
- [ ] A mudança respeita as regras de ouro acima?
- [ ] A lógica alterada tem teste de unidade? (núcleo sempre; UI quando houver lógica)
- [ ] Atualizei specs/docs se o comportamento contratado mudou?
