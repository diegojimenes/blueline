# Spec 01 — Escopo do MVP

> O que entra e o que fica de fora do MVP. O objetivo é uma base sólida: pipeline TS/JS completo,
> grafo vivo, navegação por zoom semântico e terminal real — tudo com testes.

## Objetivo do MVP

Um usuário consegue:

1. Abrir um diretório local (projeto TS/JS).
2. Ver o mapa de alto nível (módulos/camadas) e navegar por zoom semântico até o código-fonte.
3. Seguir chamadas lateralmente (mesmo entre módulos) e revisar a trilha de exploração.
4. Trocar de lente (Camadas, Acoplamento; Domínio configurável) sem trocar de tela.
5. Rodar qualquer agente/ferramenta num terminal real e ver as mudanças estruturais aparecerem ao vivo.

## Dentro do escopo (MVP)

**Análise (`src/core`)**
- Parse de `.ts`/`.tsx`/`.js`/`.jsx` via tree-sitter (WASM).
- Indexação: arquivos, classes, métodos/funções, imports e chamadas (arestas).
- Agrupamento em módulos por convenção de diretório.
- Diff estrutural entre snapshots + eventos de mudança tipados.

**Grafo & navegação**
- Níveis 1–4 de zoom semântico com transições explícitas (duplo clique / comando).
- Salto lateral por arestas de chamada e portais.
- Trilha de exploração (trail) sobre o grafo + histórico clicável no terminal.
- Breadcrumb do caminho atual na UI e na status bar.

**Lentes**
- Camadas (convenção de caminho), Acoplamento (grau in/out). Domínio (prefixo configurável) como bônus se simples.
- Lente recolore/regrupa o mesmo grafo, sem mover nós.

**Layout IDE**
- Explorer (árvore do modelo), Canvas, Inspector contextual, Terminal, Status bar.
- Temas escuro/claro no estilo VS Code/Zed.

**Terminal real**
- PTY via `portable-pty`, shell do usuário; o usuário roda o agente que quiser.
- Comandos: `goto`, `up`, `ls`, `lens`, `clear`, `help`. Histórico clicável.

**Live updates**
- File watcher com debounce → re-parse incremental → diff → push ao canvas.
- Destaque visual dos nós afetados pela última mudança.
- Integração `git diff` quando o diretório for um repositório git.

**Testes**
- Vitest para `src/core` (fixtures + golden graphs), testes de componentes para UI com lógica.
- `cargo test` para backend (watcher, comando de shell).
- `pnpm lint` / `pnpm typecheck` verdes em CI.

## Fora do escopo (MVP)

- Outras linguagens (D5). Interface `Parser` existe, mas só há implementação TS/JS.
- Hooks por agente (Claude Code `PreToolUse`/`PostToolUse`) — pós-MVP, ver `12-milestones.md`.
- Análise de domínio semântico avançada (DDD automatizado), inferência de tipos completa do TS.
- Performance para monorepos gigantes (acima de ~2k nós no nível 1): aceitável no MVP, otimizações depois.
- Edição de código, chat, colaboração, persistência de sessão entre aberturas.
- Grafo orientado a dependências "puxe" (query-graph) além do básico `goto`.
- Busca fuzzy global de símbolos (post-MVP).

## Critérios de aceite (MVP)

1. Abrir um projeto TS real (a fixture ou um projeto pequeno) produz um grafo correto no nível 1 em < 2 s (projetos até ~500 arquivos).
2. Navegação completa nível 1 → 4 e volta, mais salto lateral entre módulos, funciona via grafo, árvore e terminal (comportamento idêntico, mesmo log).
3. A lente Camadas recolore corretamente; Acoplamento ordena/expõe os nós mais conectados.
4. Editar um arquivo (salvar) reflete no grafo em < 1 s sem re-parse de arquivos não afetados.
5. Em repo git, reverter uma alteração restaura o grafo ao estado anterior via `git diff`.
6. Rodar `claude` (ou qualquer agente) no terminal e fazer uma pequena mudança produz live update no canvas.
7. `pnpm test`, `cargo test`, `pnpm lint`, `pnpm typecheck` passam em CI.

## Métricas de qualidade

- Cobertura de `src/core` ≥ 80% (linhas).
- Parsing: nenhum teste de golden graph falha por instabilidade de ordem (grafos normalizados).
- Latência de parse incremental por arquivo < 50 ms (média, worker).
