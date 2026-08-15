# Spec 06 — Lentes

> Lente = filtro que **recolore/regrupa o mesmo grafo** mantendo a posição espacial. Nunca abre tela nova
> nem troca o layout (`specs/05-rendering.md`).

## Contrato

```ts
interface Lens {
  id: 'layers' | 'coupling' | 'domain';
  colorFor(node: Node): string;
  widthFor(edge: Edge): number;         // espessura da aresta
  groupsFor(nodes: Node[]): LensGroup[]; // agrupamento visual opcional (ex.: caixas de camada)
}

interface LensGroup {
  id: string;
  label: string;
  nodeIds: NodeId[];
}
```

- A lente ativa vive no `NavigationState`; troca de lente dispara `lens:changed` (logado no histórico).
- Mapeamento de cor determinístico por `(lens, node)` — testável com fixtures.

## Lente Camadas (MVP obrigatória)

- Agrupa por convenção de caminho. Regras padrão (configurável em `codeatlas.json` via `layerPaths`):
  - `src/api`, `src/routes`, `src/controllers` → **api**
  - `src/domain`, `src/entities`, `src/models` → **domain**
  - `src/services`, `src/use-cases` → **application**
  - `src/infra*`, `src/db`, `src/clients` → **infra**
  - demais → **core/outros**
- `layerPaths` no config tem precedência sobre as regras padrão; a chave é a camada e o valor é a lista de prefixos:
  ```json
  { "layerPaths": { "api": ["gateway"], "domain": ["pedidos"] } }
  ```
- `groupsFor` retorna uma caixa agrupada por camada (contorno), **sem mover nós**.
- O projeto (`PROJECT_ID`) é sempre a camada `sistema`.

## Lente Acoplamento

- Cor/brilho do nó por grau: `in+out` de `call`/`import` diretos (o próprio nó).
- Nós com grau alto destacam (ex.: degradê quente). Arestas com muitos caminhos ficam mais grossas.
- Estatística exposta no Inspector: acoplamento interno (arestas no mesmo módulo) vs externo.

## Lente Domínio (bônus, configurável)

- Se `codeatlas.json` definir `domainPaths` (ex.: `pedidos: src/pedidos`), agrupa por prefixo de caminho.
- Sem config, esta lente fica desabilitada na UI.

## Mudanças de lente vs. mudanças de modelo

- Lente só altera cor/espessura/agrupamento — **nunca** nós/arestas do modelo nem posições (D7).
- Quando o modelo muda (live update), a lente atual é reaplicada ao novo snapshot automaticamente.

## Testes

- `colorFor`/`groupsFor` determinísticos: golden por fixture de caminhos.
- Regressão: trocar de lente não muda `layout` (assert de posições idênticas).
