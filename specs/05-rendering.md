# Spec 05 — Renderização & Zoom Semântico

> Como o grafo é desenhado e como a troca de representação por nível funciona. Renderer custom
> em canvas 2D (D3). Layout separado do modelo (D6).

## Níveis de representação

| Nível | Nós desenhados | Arestas | Interação principal |
|---|---|---|---|
| 1 — Sistema | `ModuleNode`s do projeto | `moduleEdge` (espessura ∝ acoplamento) | duplo clique em módulo → nível 2 |
| 2 — Módulo | `ClassNode`s do módulo em foco | `import` (e call agregado) | duplo clique em classe → nível 3 |
| 3 — Classe | `MethodNode`s da classe | `call` interno; setas de fora | duplo clique em método → abre código (nível 4) |
| 4 — Método | Inspector com código-fonte + chamadas | listas "Chamado por"/"Chama" | clique em item → salto lateral |

- Transições são **ações explícitas** (duplo clique, comando, breadcrumb). Não há scroll de mouse que mude de
  nível; scroll/pan apenas desloca dentro do nível atual.
- `focus` + `level` no `NavigationState` definem o que é desenhado. Tudo derivado do modelo, nada duplicado.

## Layout

- **Por nível**, um layoutador puro em `src/core/layout.ts` (testável, determinístico):
  - Nível 1: posicionamento de agrupamento (ex.: force-directed simples ou grid por camada).
  - Nível 2: layout em grid por subpasta + imports como curvas.
  - Nível 3: métodos em coluna (ordem de `startLine`), chamadas internas como arcos.
- Layout **não muda quando a lente muda** (D7 de produto): lente só altera cor/espessura/agrupamento visual.
- Posições são cacheadas por `(level, lens)` no store, não no modelo.

## Culling & performance

- Canvas 2D com **culling** por viewport; nós fora do retângulo visível não são desenhados.
- Labels/portais/trilha em **overlay DOM** posicionados a partir das coordenadas do canvas (dithering aceitável).
- Meta-bancos (acima de ~300 nós visíveis) degradam: esconder labels por densidade, agregar em "cluster" clicável.

## Portais (salto lateral)

- Arestas que saem do foco atual desenham um **nó tracejado na borda** do canvas (portal) com o nome do alvo.
- Clique no portal → `navigate(target)` mantendo o nível (muda o `focus`, não o `level`).
- Lista completa de portais visíveis também no Inspector.

## Trilha de exploração (trail)

- Caminho `trail` desenhado como aresta destacada entre o nó raiz e o foco atual (breadcrumb no próprio grafo).
- `visited` pinta um "brilho" nos nós já abertos, permitindo ver cobertura de revisão.
- Clique num nó do trail → volta direto (gera nova entrada no histórico, sem desfazer).

## Visual (tema)

- Paleta por tema (dark padrão, estilo VS Code; light estilo Zed). Cores de nó/aresta por tipo + lente.
- Estado visual: foco (borda forte), selecionado (brilho), visitado (brilho suave), afetado-por-última-mudança
  (marcador temporário, ver `09-live-updates.md`).

## Código-fonte (nível 4)

- O método em foco abre no Inspector com syntax highlight (lib leve ou highlight próprio simples no MVP).
- Listas de chamadas clicáveis executam `goto <target>`.

## Contratos de teste

- `layout.ts`: dado um grafo de fixture, produz coordenadas determinísticas (teste de golden).
- `viewport.ts`: culling retorna o subconjunto exato de nós visíveis para um viewport dado.
- Sem dependência de canvas no teste: a função de culling/layout recebe geometria pura.
