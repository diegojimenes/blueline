# Spec 12 — Marcos (M0–M5)

> Sequência de entrega com critérios de "done" por marco. Cada marco termina com testes verdes.

## M0 — Fundação do projeto
- Scaffold: Tauri 2 + React/Vite + TS estrito; `package.json` com scripts (`dev`, `test`, `lint`, `typecheck`,
  `golden:update`); eslint + prettier; vitest + @testing-library; CI básico (GitHub Actions).
- `src/core` vazio com `events.ts` e `index.ts`; primeiras fixtures (`empty/`).
- **Done:** `pnpm test`, `pnpm lint`, `pnpm typecheck` verdes; janela Tauri abre com layout de 4 painéis vazios.

## M1 — Parse & modelo ✅
- `Parser` (tree-sitter WASM) p/ TS/JS; walk; `CodeGraph`; resolução de imports/calls (heurística);
  `toJSON` canônico; golden para `basic/` e `messy/`.
- Implementado:
  - `walk.ts`, `path.ts` (posix), `parse/` (`ts-parser` sobre web-tree-sitter + gramática TS/TSX),
    `analyze/build.ts` (`buildGraph` + `moduleOfPath` + `resolveImportTarget`),
    `serialize.ts` (`toJSON` canônico + `aggregateModuleEdges` com peso).
  - Fixtures `basic/` e `messy/`; goldens em snapshot; teste de determinismo/ordenação.
- **Done:** 35 testes verdes; núcleo cobre ~92% (stmts/lines), branches ~79%, meta era >= 60%;
  `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint`, `cargo test` verdes.

### Decisões refinadas no M1
- `new X(...)`, chamadas a built-ins (`slice`, `toUpperCase`, …) e `constructor` não geram arestas no MVP
  (registram-se como `unresolved`/são ignorados) — ver `04-analysis-pipeline.md`.
- `.js`/`.jsx` são parseados com as gramáticas TS/TSX (superset); gramática JS separada fica para backlog.
- Módulo = diretório relativo após remover prefixos de raiz (`src`/`lib`/`app`).

## M2 — Grafo & zoom semântico ✅
- `layout.ts` por nível; renderer canvas com culling; duplo clique entra; `up` sai; portais; trail/visited.
- `core/commands` (goto/up/ls) com testes de tabela.
- Implementado:
  - `core/navigation.ts` (`visibleNodes`, `navigationToNode`, `upNavigation`, `ancestorChain`, `canonicalPathOf`),
    `core/commands.ts` (`goto` com `modulo.Classe.metodo` + nome único + id, `up`, `ls`, `lens`, `help`, `clear`),
    `core/layout.ts` (grid módulos/classes, coluna métodos), `core/viewport.ts` (culling puro),
    `core/portals.ts` (nível 3 → classe dona do método externo, navegação lateral).
  - Renderer: canvas 2D com culling, duplo clique entra (mesmo histórico do `goto`), `Esc`/`↑` sobe,
    breadcrumb (trail) clicável, brilho de `visited`, portais tracejados na borda, terminal com input
    determinístico e histórico clicável.
  - Demo embutida (`pnpm demo:graph` gera `src/renderer/demo/demoGraph.ts` a partir da fixture `basic`) —
    renderer continua browser-safe.
- **Done:** navegação 1→4 via canvas e via comando idêntica (mesmo histórico, testado em
  `commands.test.ts` + `store/index.test.ts`); 70 testes verdes; `pnpm typecheck`/`lint`/`test:coverage`/`build` verdes.

> Nota: `goto <caminho>` segue o formato de `specs/08-terminal.md`; `lens` só troca o estado da lente no M2
> (recolorir é do M3).

## M3 — Layout IDE completo ✅
- Explorer, Inspector (métricas + código-fonte), Status bar, temas; sincronização com `selected`.
- Lentes: Camadas (obrigatória) + Acoplamento; `codeatlas.json` (domainPaths, ignore, regras de módulo).
- Implementado:
  - `core/lenses.ts`: `layerOf`/`domainOf`/`couplingOf`/`colorKey`/`widthFor`/`groupsFor` — puro e determinístico;
    `ProjectConfig.layerPaths` (precedência sobre as regras padrão); `demoConfig` na demo.
  - Explorer em árvore (sistema→módulos→classes→métodos) com mesmo `gotoId` do grafo, expandir/recolher
    local e expansão automática da trilha do nó selecionado.
  - Canvas recolore pela lente ativa (fill/borda `colorKey`), caixas de camada (`groupsFor`, nível 1) e
    espessura de arestas (`widthFor`) **sem mover nós** (D7).
  - Inspector mostra camada/domínio/acoplamento; atalhos `l` (cicla lente), `/` (foca terminal),
    `Alt+←/→` (voltar/avançar no histórico de foco); status bar já exibia `nível`/`lente`.
  - Store: `config`, `historyIndex`, `back`/`forward` (pula entradas com alvo repetido; volta ao sistema no
    início; navegar após voltar trunca o caminho à frente), `cycleLens`.
- **Done:** navegar por Explorer/grafo/terminal produz o mesmo estado; lente Camadas recolore sem mover nós;
  87 testes verdes; núcleo cobre ~94% (stmts/lines); `pnpm typecheck`/`lint`/`test:coverage` verdes.

## M4 — Terminal real ✅
- `portable-pty` (Rust) + xterm.js; `ptty_spawn/write/resize`; modos shell vs comando; histórico clicável;
  `clear`/`help`; abas do terminal (mínimo uma).
- Implementado:
  - Backend: `src-tauri/src/ptys.rs` com `portable-pty` (spawn de `$SHELL` com cwd do projeto, decodificação
    UTF-8 incremental na thread de leitura, eventos `codeatlas:pty-output`/`codeatlas:pty-exit`), registry
    de TTYs e comandos `ptty_spawn`/`ptty_write`/`ptty_resize`/`ptty_kill`; testes de unidade em Rust
    (echo, UTF-8 multibyte, encerramento).
  - Frontend: xterm.js (v6) + `@xterm/addon-fit` no painel Terminal; `core/tty.ts` puro decide tecla a tecla
    se o input é comando CodeAtlas (verbos reservados `goto|up|ls|lens|clear|help`) ou vai ao PTY — sem eco
    duplicado (o buffer é liberado ao shell quando deixa de ser prefixo de verbo); modo browser cai num
    shell demo (sem Tauri); histórico de navegação clicável via link provider nas linhas `› <comando>`.
  - Store: `execCommand` devolve o `CommandResult` completo (terminal real reusa o pipeline do dispatch).
- **Done:** shell real roda `git`/`claude`/`aider`; `goto`/`ls`/`up`/`lens` determinísticos na mesma
  superfície; log de navegação clicável; `cargo test` + 107 testes vitest + typecheck/lint verdes.

> Nota: `clear` limpa a tela do xterm (não apaga histórico de navegação); abas do terminal ficam no backlog
> (uma superfície por janela no MVP).

## M5 — Live updates (MVP completo)
- Watcher (notify) + debounce; batch `files:changed`; re-parse incremental; `git` provider (D7); delta push;
  destaque de nós afetados; status bar do watcher.
- **Done:** edição externa reflete no grafo em < 1 s; revert via git restaura; critérios de aceite de
  `01-mvp-scope.md` atendidos; `pnpm test`+`cargo test`+CI verdes.

## Backlog pós-MVP (fora do escopo, prioridade relativa)

1. **Camada 2 — hooks por agente** (`PreToolUse`/`PostToolUse`): evento `agent:tool`, diff antes/depois sem esperar save.
2. Busca fuzzy global de símbolos (Ctrl+P / `/`).
3. Persistência de sessão (trilha, visited, lente, foco) entre aberturas.
4. Outras linguagens: nova implementação de `Parser` (a interface já existe) — ex.: Python, Go.
5. Análise de tipos do TS para resolução precisa de chamadas (reduzir `unresolved`).
6. Performance: WebGL, virtualização em monorepos grandes, layout incremental.
7. Grafo "puxe" (query graph) e filtros de subárvore por domínio.
8. Múltiplos projetos/snapshots comparáveis (diff entre versões do grafo na mesma janela).
