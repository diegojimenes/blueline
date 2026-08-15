# Spec 03 — Modelo de Dados (CodeGraph)

> O grafo é um **modelo normalizado com IDs estáveis** (D6). A UI nunca constrói estado a partir de
> posição/layout; ela apenas se inscreve no modelo e recebe deltas.

## Tipos de nó

| Tipo | Significado | ID estável | Nível |
|---|---|---|---|
| `ProjectNode` | raiz do grafo | `project` | 1 |
| `ModuleNode` | diretório/camada agregadora | `module:<relpath>` | 1–2 |
| `ClassNode` | classe ou arquivo-módulo | `class:<file>:<name>` | 2–3 |
| `MethodNode` | método/função | `method:<file>:<owner>:<name>` | 3–4 |

- `ClassNode` também cobre módulos de arquivo (`export function`, `export const`) quando o arquivo não tem classe.
- IDs não contêm posição no arquivo (linhas mudam); só caminho + símbolo. Isso torna o diff estável a
  refatorações de linha.

## Tipos de aresta

| Tipo | De | Para | Metadados |
|---|---|---|---|
| `import` | `ClassNode` | `ClassNode` | origem, símbolo |
| `call` | `MethodNode` | `MethodNode` | local da chamada (linha/col), nome |
| `member` | `ClassNode` | `MethodNode` | escopo de pertencimento |
| `moduleEdge` | `ModuleNode` | `ModuleNode` | agregada (soma de import/call entre filhos) |

- Arestas `call`/`import` são sempre entre entidades concretas; as `moduleEdge` são **derivadas** por agregação
  e recalculadas a cada snapshot (nunca persistidas como fonte primária).

## Forma do modelo

```ts
interface CodeGraph {
  projectRoot: string;          // caminho absoluto do projeto
  revision: number;             // monotônico; incrementa a cada snapshot
  nodes: Map<NodeId, Node>;
  edges: Map<EdgeId, Edge>;
  indexes: {                   // índices auxiliares p/ navegação (D6)
    byFile: Map<string, NodeId[]>;
    byModule: Map<NodeId, NodeId[]>;
    callsIn: Map<NodeId, NodeId[]>;
    callsOut: Map<NodeId, NodeId[]>;
  };
}

type Node =
  | { kind: 'project'; id: NodeId; name: string }
  | { kind: 'module';  id: NodeId; name: string; path: string }
  | { kind: 'class';   id: NodeId; name: string; file: string; startLine: number }
  | { kind: 'method';  id: NodeId; name: string; file: string; startLine: number; owner: NodeId };

interface Edge {
  id: EdgeId;             // `<type>:<from>:<to>`
  type: 'import' | 'call' | 'member' | 'moduleEdge';
  from: NodeId;
  to: NodeId;
  meta?: { line?: number; symbol?: string };
}
```

## Snapshots e diff

- `Snapshot` = CodeGraph imutável em um instante. `store` mantém o atual; `diff(a, b)` produz `ModelDelta`.
- **Regra de ouro:** re-parse de um arquivo nunca descarta nós de outros arquivos; o delta só contém o que mudou.

```ts
interface ModelDelta {
  revision: number;
  added: Node[];
  removed: NodeId[];
  changed: Node[];          // metadados alterados (ex.: startLine, owner)
  edgesAdded: Edge[];
  edgesRemoved: EdgeId[];
  filesTouched: string[];   // para a UI destacar
  cause: 'parse' | 'parseIncremental' | 'gitApply' | 'reset';
}
```

- `cause` permite à UI mostrar origem (watcher vs git vs carga inicial).

## Estado de navegação (fora do grafo, no store)

```ts
interface NavigationState {
  focus: NodeId;              // nó em foco
  level: 1 | 2 | 3 | 4;       // nível de zoom semântico
  lens: 'layers' | 'coupling' | 'domain';
  trail: NodeId[];            // trilha de exploração (histórico de foco)
  selected: NodeId | null;    // nó selecionado (Inspector)
  visited: Set<NodeId>;       // tudo já aberto (para cobertura de revisão)
}
```

- Este estado é **derivado de comandos** (`core/commands`) e nunca editado direto pela UI.

## Contratos de estabilidade

1. `addNode/removeNode` no pipeline são transacionais: aplicam-se num novo snapshot atômico.
2. Ordenação de nós/arestas em qualquer saída (JSON, testes) é canônica (por ID) — grafos golden estáveis.
3. `visited`/`trail` são por sessão (não persistidos no MVP, ver backlog).
4. O modelo é serializável para tests: `toJSON(graph)` produz formato canônico usado em golden graphs.
