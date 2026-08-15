# Spec 11 — Estratégia de Testes

> Testes de unidade em todas as camadas ("núcleo sempre; UI quando houver lógica"). Ferramentas: vitest
> (core + componentes), cargo test (Rust).

## Camadas e ferramentas

| Camada | Ferramenta | O que testa |
|---|---|---|
| `src/core` | vitest | parse, grafo, diff, layout, lentes, comandos, eventos |
| `src/renderer` | vitest + @testing-library/react | componentes com lógica (Explorer, Inspector, status bar, log) |
| `src-tauri` | cargo test | watcher (batch/debounce), ptys (spawn/io), git provider |
| Fronteira IPC | vitest | shape/contrato de eventos (tipos vs payloads) |

## Fixtures

- `fixtures/` = mini-projetos TS reais (pequenos, versionados):
  - `basic/` — 2–3 módulos, imports, classes, chamadas simples (caso feliz).
  - `messy/` — arquivos sem classe (funções top-level), exports, imports relativos, chamadas não resolvidas.
  - `empty/` — projeto sem arquivos TS (comportamento de borda).
  - `git-touched/` — repo git com mudanças staged/working para testar live updates.
- Cada fixture tem um **golden** gerado por `toJSON(graph)` (`04-analysis-pipeline.md`). Golden atualizado
  intencionalmente com script `pnpm golden:update` e revisado em PR.

## Estratégias por área

### Núcleo (obrigatório, cobertura ≥ 80% linhas)
- **Parse:** para cada fixture, parse → FileSymbols esperado (golden parcial); casos de sintaxe específica
  (generics, `export default`, arrow `export const`).
- **Grafo:** IDs estáveis, arestas corretas, agregação de `moduleEdge`.
- **Diff:** aplicar mudança incremental num fixture → delta exato (added/removed/changed/edges).
- **Layout:** determinístico por nível (golden de coordenadas).
- **Lentes:** `colorFor`/`groupsFor` determinísticos; troca de lente não move nós (assert de layout).
- **Comandos:** tabela de casos `goto`/`up`/`ls`/`lens` (válidos, inválidos, ambíguos, caminhos com pontos).
- **Events:** shape dos eventos (todos serializáveis).

### UI
- Explorer: hierarquia correta a partir de CodeGraph fixture; seleção sincroniza.
- Inspector: métricas corretas por tipo de nó; listas "Chamado por/Chama" clicáveis emitem `navigate`.
- Terminal log: navegação gera linha clicável; clique re-executa.
- Status bar: mostra nível/lente/caminho.
- Mock de eventos do modelo (sem Tauri).

### Backend (Rust)
- `watcher.rs`: escrever/alterar arquivos em dir temp → batch único com debounce (teste com tempo real aceito
  no limite de ~500 ms).
- `ptys.rs`: spawn `$SHELL`, escrever `echo ping`, ler `ping` no output; exit code no `SIGTERM`.
- `git.rs`: `GitProvider` é trait mockável; teste de integração com fixture `git-touched` (se git disponível).

## Execução e CI

| Comando | Escopo |
|---|---|
| `pnpm test` | vitest (core + renderer) |
| `pnpm test:watch` | dev |
| `cd src-tauri && cargo test` | Rust |
| `pnpm lint` / `pnpm typecheck` | verificação estática |
| `pnpm golden:update` | regrava goldens (uso consciente) |

- CI (GitHub Actions): lint + typecheck + vitest + cargo test num job Linux; coverage report para `src/core`.
- **Porta de CI:** qualquer mudança que altere contrato (tipos de evento, formato de ID, golden) deve atualizar
  o doc correspondente em `specs/` na mesma PR.

## Regras de ouro dos testes

1. Teste do núcleo **nunca** toca DOM, Tauri ou filesystem real (usar fixtures in-memory/fixture files
   versionados; leitura de fixture ok).
2. Toda regressão de bug começa como teste vermelho (`git`-friendly: descrever a regressão no commit).
3. UI testa comportamento (o que renderiza/clica), não implementação.
4. Goldens são para estabilidade e diffs legíveis, não para mascarar erros — revisar sempre.
