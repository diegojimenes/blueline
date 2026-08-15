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

## M2 — Grafo & zoom semântico
- `layout.ts` por nível; renderer canvas com culling; duplo clique entra; `up` sai; portais; trail/visited.
- `core/commands` (goto/up/ls) com testes de tabela.
- **Done:** navegação 1→4 via canvas e via comando idêntica (mesmo histórico); testado com `basic/`.

## M3 — Layout IDE completo
- Explorer, Inspector (métricas + código-fonte), Status bar, temas; sincronização com `selected`.
- Lentes: Camadas (obrigatória) + Acoplamento; `codeatlas.json` (domainPaths, ignore, regras de módulo).
- **Done:** navegar por Explorer/grafo/terminal produz o mesmo estado; lente Camadas recolore sem mover nós.

## M4 — Terminal real
- `portable-pty` (Rust) + xterm.js; `ptty_spawn/write/resize`; modos shell vs comando; histórico clicável;
  `clear`/`help`; abas do terminal (mínimo uma).
- **Done:** usuário roda `claude`/`aider`/`git` no terminal; `ls` e `goto` funcionam; log de navegação clicável.

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
