# Forma do Produto (Layout de IDE)

> Descrição concreta do layout e da interação, com VS Code e Zed como referência visual.
> A implementação está em `specs/07-ui-layout.md`; aqui está o contrato de experiência.

## Estrutura da janela

```
┌──────────────────────────────────────────────────────────────────────┐
│ Title bar (nativo)                    [Abas: Grafo · Terminal]        │
├───────────────┬──────────────────────────────┬───────────────────────┤
│ Explorer      │         Canvas               │ Inspector             │
│ (árvore do    │   grafo de zoom semântico    │ (contextual por       │
│  grafo)       │   breadcrumb + trilha        │  seleção: métricas,   │
│               │   portais de salto lateral   │  código-fonte)        │
│               │                              │                       │
├───────────────┴──────────────────────────────┴───────────────────────┤
│ Terminal (bash real via PTY — onde o usuário roda seu agente)        │
├──────────────────────────────────────────────────────────────────────┤
│ Status bar: caminho atual · nível de zoom · lente ativa              │
└──────────────────────────────────────────────────────────────────────┘
```

## Painéis

### Explorer (esquerda, colapsável)
- Árvore navegável espelhando o mesmo modelo: sistema → módulos → classes → métodos.
- Alternativa à navegação por grafo para quem prefere lista. Mesma navegação, mesmo histórico.
- Ícones/cores coerentes com a lente ativa no canvas.

### Canvas (centro)
- Grafo de zoom semântico (níveis 1–4). Ver `specs/05-rendering.md`.
- Ações: duplo clique para entrar, comando `up`/botão breadcrumb para sair, clique em aresta/portal para salto lateral.
- Trilha de exploração desenhada sobre o grafo (caminho iluminado desde a entrada).

### Inspector (direita, contextual)
- Nível módulo/classe: camada, domínio, acoplamento interno/externo, métricas simples.
- Nível método: código-fonte real (syntax highlight) + listas "Chamado por" / "Chama", clicáveis para saltar.

### Terminal (baixo)
- **Terminal real** (PTY + xterm.js), não decoração. Spawn `$SHELL` (bash, zsh, etc.).
- Comandos determinísticos: `goto <caminho>`, `up`, `ls`, `lens <nome>`, `clear`, `help`.
- Histórico de navegação (do grafo, da árvore ou do teclado) é logado como linhas clicáveis.
- O usuário roda seu agente favorito aqui e acompanha as mudanças ao vivo no canvas.

### Status bar
- Caminho atual (ex.: `pedidos > PedidoService > criarPedido`), nível de zoom, lente ativa.
- Indicador de estado do watcher (parseando/atualizado).

## Referências visuais
- **VS Code**: densidade de painéis, activity bar, status bar, temas escuros.
- **Zed**: minimalismo, tipografia, fluidez de animações e foco no conteúdo.
- Keymaps: navegação 100% por teclado além do mouse (`/` busca, `Alt+←/→` voltar/avançar no histórico, etc.).

## Princípios de UI
1. O layout informa o estado: nunca esconder em qual nível/lente o usuário está.
2. Nenhuma tela nova para trocar de lente — recolorir/regrupar o mesmo grafo.
3. Toda navegação produz entrada no histórico do terminal (barramento de eventos).
4. Performance percebida: parse e diff não travam a UI (workers, debounce).
