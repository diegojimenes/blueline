# Spec 09 — Live Updates

> Observar é mais importante que adivinhar (princípio 7). Mudanças vêm do file watcher + re-parse incremental
> + diff estrutural, com **git diff como fonte de verdade** (D7).

## Fluxo

```
Rust (notify) ── files:changed (batch) ──▶ webview ──▶ core
                                                          ├─ re-parse só arquivos tocados (cache de símbolos)
                                                          ├─ confirmação: conteúdo igual → delta vazio
                                                          ├─ applyFiles → computeDelta → model:changed
                                                          └─ push ao store → canvas/inspector/árvore
```

## Implementado (M5)

- **Watcher (Rust)**: `src-tauri/src/watcher.rs` (crate `notify`), `watch_start`/`watch_stop`.
  Debounce de 150 ms agrega rajadas num único batch; filtra `.ts/.tsx/.js/.jsx` e ignora
  `node_modules`, `.git`, `.next`, `dist`, `build`, `target`, `coverage`.
- **Git (Rust)**: `src-tauri/src/git.rs` — `GitProvider` (mockável) + `SystemGit`; `git_status`
  usa `git status --porcelain --untracked-files=all` (M/A/D/R/??). Fora de repo, retorna vazio.
- **Conteúdo**: comandos `file_read(projectPath, relPath)` e `read_project(projectPath)`.
- **Incremental (core)**: `src/core/delta.ts` (`computeDelta` + `hasChanges`) e
  `src/core/incremental.ts` (`SymbolCache`, `applyFiles`, `applyFileRemovals`, `cacheFrom`).
  Re-parse apenas dos arquivos tocados; IDs estáveis garantem que o resto não muda (D6).
- **Store/UI**: `openProject` (walk + parse inicial via `open <dir>` no terminal) e
  `applyExternalChanges` reagem ao batch; nós afetados pulsiam no canvas (~1,2 s);
  status bar mostra `watcher: ativo` / `atualizado HH:MM:SS`.

> **Decisão de implementação**: a confirmação de "mudança real" usa o **próprio re-parse** como
> fonte — conteúdo igual produz símbolos iguais → `computeDelta` vazio → sem render (garantia 3).
> Lemos o conteúdo do **disco** (não `git diff`): um `git checkout`/`revert` dispara o ciclo e
> restaura o grafo naturalmente (critério 5). `git_status` alimenta a filtragem/status bar;
> o re-parse roda no webview (worker fica como otimização futura).


### 1. Watcher (backend)
- crate `notify`, observa todo o diretório do projeto.
- Ignora `node_modules`, `.git`, `.next`, `dist`, `build`.
- **Debounce:** eventos em rajada (agentes escrevem em bursts) são agregados numa janela (ex.: 150 ms) e enviados
  como um único batch `files:changed`.
- Envia `path` relativo + `mtime`; o conteúdo é lido por command `file_read(path)` quando o frontend decidir.

### 2. Confirmação de mudança real (git como verdade)
- Se o diretório é repo git:
  - `git_status()` filtra apenas arquivos com mudança real (`M`, `A`, `D`).
  - Para cada arquivo, `git_diff(path)` fornece o conteúdo atual vs HEAD (aceitável: conteúdo do disco
    confirmado como diferente).
- Não-git: fallback compara hash do conteúdo lido pelo watcher contra o cache do worker (evita falso positivo
  de touch sem mudança).

### 3. Re-parse incremental
- Apenas os arquivos confirmados entram no `parse`/`applyDelta` (`04-analysis-pipeline.md`).
- Um batch inteiro vira **um** snapshot e **um** delta (menos churn na UI).

### 4. Diff e push
- `ModelDelta` (com `cause: 'parseIncremental'`) é emitido para o store.
- UI reage:
  - canvas: re-layout só se a lente exigir; marca visual nos nós afetados (pulsar breve) e nós novos.
  - Explorer: atualiza árvore.
  - Inspector: recarrega métricas do nó selecionado.
  - status bar: `watcher: atualizado`.

### 5. Restauração via git
- Se o usuário (ou o agente) fizer `git checkout`/`revert`, o watcher vê os arquivos e o ciclo repete —
  o diff contra HEAD do `git_diff` sempre reflete o estado real.

## Eventos emitidos

| Evento | Payload | Origem |
|---|---|---|
| `files:changed` | `{ paths: string[], mtime: number }` | backend |
| `model:changed` | `{ delta: ModelDelta, snapshotRev: number }` | worker |
| `git:status` | `{ dirty: string[] }` (ex.: status bar) | backend |

## Garantias

1. UI nunca é bloqueada pelo parse (worker).
2. Mudança em N arquivos em rajada = 1 snapshot, 1 delta, 1 render (não N).
3. Falso positivo (touch sem mudança) não produz delta.
4. Nós não afetados mantêm IDs e posições (estabilidade D6).

## Testes

- **core**: simula batch de mudanças sobre fixture; assert do delta (nós novos/removidos/changed corretos).
- **backend**: `watcher.rs` emite batch com debounce (teste com escrita real em dir temp); `git.rs` mockável
  (interface `GitProvider`).
- **componentes**: store reage a `model:changed` e atualiza árvore/status bar (mock de delta).
