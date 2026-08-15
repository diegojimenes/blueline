# Spec 07 — Layout de UI

> Estrutura da janela, componentes e contratos visuais. Referências: VS Code e Zed
> (`docs/02-product-shape.md`). Tudo é derivado do modelo via store (D6).

## Estrutura

```
┌──────────────────────────────────────────────────────────────┐
│ Header: abas [Grafo | Terminal] · título do projeto · tema   │
├──────────────┬───────────────────────────────┬───────────────┤
│ Explorer     │ Canvas                        │ Inspector     │
├──────────────┴───────────────────────────────┴───────────────┤
│ Terminal (xterm.js)                                          │
├──────────────────────────────────────────────────────────────┤
│ Status bar                                                   │
└──────────────────────────────────────────────────────────────┘
```

### Explorer (esquerda)
- Árvore derivada do modelo: sistema → módulos → classes → métodos. Mesmo `navigate` do grafo.
- Estados: expandido/colapsado local; seleção sincronizada com `selected` do modelo.
- **Não** mostra posições/layout — só hierarquia do CodeGraph.

### Canvas (centro)
- Container do renderer (`specs/05-rendering.md`). Eventos: duplo clique (entrar), clique (selecionar),
  clique em portal (saltar), pan/zoom (câmera do nível atual).

### Inspector (direita)
- Contextual por `selected`:
  - módulo/classe: camada, domínio, acoplamento in/out, contagem de filhos, arquivo.
  - método: código-fonte (syntax highlight) + "Chamado por" / "Chama" (clique → `goto`).
- Sem seleção: visão geral do projeto (estatísticas).

### Terminal (baixo)
- xterm.js ligado ao PTY (`specs/08-terminal.md`). Linhas de comando e histórico de navegação.
- Barra de abas do terminal (múltiplos terminais — opcional no MVP, pelo menos um).

### Status bar
- `caminho atual · nível · lente · watcher: parseando/atualizado`.

## Interação

| Ação | Comportamento |
|---|---|
| Duplo clique em módulo/classe | entra no nível abaixo (`navigate` + histórico) |
| Clique em portal / aresta | salto lateral (mesmo nível) |
| `Alt+←` / `Alt+→` | voltar / avançar no histórico de foco (redo da trilha) |
| `l` | cicla lentes (logado) |
| `/` | foca o terminal para digitar comando |
| `Esc` | limpa seleção |

- **Toda** ação acima passa pelo `core/commands` e gera entrada no histórico do terminal.

## Temas

- `dark` (padrão, VS Code) e `light` (Zed). Tokens centralizados (CSS vars + paleta do canvas).
- Fonte: monospace (UI e terminal); densidade VS Code, espaçamento Zed.

## Contratos de teste (componentes)

- Explorer renderiza a hierarquia correta a partir de um CodeGraph de fixture.
- Inspector mostra as métricas certas por tipo de nó.
- Nenhum componente consulta Tauri API diretamente; tudo via store (mocks de eventos nos testes).
