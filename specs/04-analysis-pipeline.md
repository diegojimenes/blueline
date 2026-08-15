# Spec 04 — Pipeline de Análise

> Parsing, indexação e atualização incremental. Vive em `src/core` (D1), roda em worker.

## Interface `Parser` (ponto de extensão de linguagem, D5)

```ts
interface Parser {
  supports(file: string): boolean;
  parseFile(file: string, content: string): FileSymbols;
}

interface FileSymbols {
  file: string;
  classes: { name: string; startLine: number; methods: MethodSymbol[] }[];
  methods: MethodSymbol[];        // funções top-level
  imports: { from: string; symbol?: string }[];
  calls: { owner?: string; target: string; line: number; col: number }[];
}
```

- MVP implementa **uma** `Parser` para TS/JS via `web-tree-sitter`.
- `calls` resolve alvo por nome de método/função resolvido na fase de resolução (abaixo). Chamadas não
  resolvidas no MVP (dinâmica, callbacks indiretos) ficam como `unresolved` registradas para telemetria.

## Fases

### 1. Walk (listagem)
- `src/core/walk.ts` percorre o diretório do projeto.
- Inclui: `.ts`, `.tsx`, `.js`, `.jsx`. Ignora: `node_modules`, `.git`, `.next`, `dist`, `build`, etc.
- Retorna caminhos relativos estáveis (usados como base de IDs).

### 2. Parse (tree-sitter WASM)
- `parseFile` produz `FileSymbols` por arquivo.
- Regras mínimas no MVP:
  - **classes**: `class` + membros `method_definition` dentro de `class_body` (métodos `public/protected/private` e `static`). Construtores são ignorados no MVP.
  - **funções**: `function`, arrow functions nomeadas (`export const foo = () => …`), `async`.
  - **imports**: `import ... from '...'`, `export ... from '...'` (re-exports), com símbolos listados.
  - **calls**: chamada de método identificada por `call_expression`; o alvo é resolvido por nome dentro do arquivo primeiro, depois no índice global (heurística por nome único — documentar limitações).
  - **`.js`/`.jsx`**: parseados com as gramáticas TS/TSX (superset) no MVP — sem gramática JS separada.
  - **`new X(...)` e chamadas a built-ins** (`slice`, `toUpperCase`, …) **não** geram aresta de chamada no MVP (registrados como `unresolved`/ignorados).

### 3. Resolução (linking)
- Constrói `CodeGraph` (D6):
  - `member` arestas classe→método.
  - `import` arestas file→file.
  - `call` arestas method→method (quando o alvo resolve; senão, registra como `unresolved`).
  - `MemberNode` é o `ClassNode` do arquivo; `ModuleNode` é derivado do **diretório relativo** do arquivo após
    remover prefixos de raiz (`src`, `lib`, `app` — configurável em `codeatlas.json`). Ex.: `src/helpers/format.ts`
    → módulo `helpers`; `src/root.ts` → `<root>`.
- Deriva arestas `moduleEdge` por agregação.

### 4. Atualização incremental
```
onFilesChanged(paths):
  content = read(paths)                      // backend fornece conteúdo
  symbols = parse(paths)                     // só arquivos tocados
  next = applyDelta(currentSnapshot, symbols)
  diff = computeDelta(currentSnapshot, next)
  emit('model:changed', { delta, snapshot: next })
```
- `applyDelta` substitui apenas os nós/arestas dos arquivos tocados, preservando o resto (regra de ouro).
- Ordem de aplicação em batch: se vários arquivos mudaram de uma vez, aplica-se o batch num único snapshot.

### 5. Normalização para testes
- `toJSON(graph)` retorna formato canônico ordenado por ID (contrato de estabilidade em `03-data-model.md`),
  usado em fixtures/golden.

## Limitações documentadas (MVP)

- Resolução de chamadas é **heurística por nome**; chamadas via `this` são resolvidas pelo owner do método.
  Sem análise de tipos do TS (fora de escopo).
- Chamadas para métodos de outro objeto não resolvidas ficam em `unresolved` (contadas como acoplamento externo
  do módulo, sem nó alvo).
- `NodeId` usa `file` relativo; renomear arquivo = remover+criar nós (diff honesto, sem heurística de move).

## Performance (critérios em `01-mvp-scope.md`)

- Parse inicial: worker processa em paralelo por arquivo (promise pool).
- Incremental: re-parse por arquivo alvo; batch de rajada (watcher) agrupa por tick.
- Cache de árvores sintáticas por arquivo (mtime+hash) para evitar re-parse de conteúdo inalterado.
