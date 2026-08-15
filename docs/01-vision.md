# Visão do CodeAtlas

> Status: fundação do produto. Este documento consolida a conversa de design e o protótipo iterado com Claude
> (zoom semântico, lentes, terminal real). É o "porquê": leia antes de qualquer spec.

## Problema

Trabalhar com agentes de IA num terminal é produtivo mas **cego**. O agente edita arquivos em rajadas e o
desenvolvedor não consegue ver, em tempo real, como a estrutura do código está mudando: quais módulos foram
tocados, que métodos novos surgiram, qual o impacto no acoplamento. Revisar o trabalho do agente exige
reconstruir mentalmente o mapa do sistema a cada iteração.

CodeAtlas não é um agente e não compete com o terminal do usuário. Ele **fica ao lado**: abre o mesmo diretório,
observa as mudanças e apresenta um mapa vivo da arquitetura.

## O que o CodeAtlas é (e o que não é)

| É | Não é |
|---|---|
| Visualização de código estruturado (módulos, classes, métodos, arestas) | Um agente de IA ou chat |
| Plataforma de entendimento e revisão de mudanças feitas por agentes | Um linter / formatter / editor |
| Terminal real onde o usuário roda o agente que quiser | Um terminal embutido falso/decorativo |
| Barramento de eventos de navegação determinística | Um IDE para escrever código |

## Princípios de experiência

### 1. Ponto de entrada: alto nível, já agrupado

Abrir um projeto **não** mostra lista de arquivos nem grafo com milhares de nós. Mostra 5–15 blocos macro
(módulos/camadas), com espessura de aresta proporcional ao acoplamento. Responde "como este sistema é organizado"
antes de qualquer detalhe.

### 2. Zoom semântico, não zoom de câmera

Zoom não é "aumentar os nós que já estavam lá" — é **trocar a representação**:

| Nível | Representação | Arestas |
|---|---|---|
| 1 — Sistema | blocos = módulos/camadas | acoplamento |
| 2 — Módulo | blocos = classes/arquivos | imports |
| 3 — Classe | blocos = métodos | chamadas |
| 4 — Método | abre o código-fonte real num painel | — |

Cada transição é **entrada explícita** (duplo clique / comando), nunca scroll infinito. Breadcrumb visual informa
o nível de abstração atual.

### 3. Navegação lateral (seguir o fio)

Além de subir/descer níveis, dá para atravessar arestas: de um método, seguir uma chamada até outro método,
possivelmente em outro módulo, sem passar pelo nível de cima. "Portais" na borda representam entidades fora do
foco atual e pulam direto para elas.

### 4. Estado persistente de exploração

Cada visita fica registrada no próprio grafo (trilha de breadcrumbs) e numa sidebar clicável. Depois de explorar
por 10 minutos dá para ver visualmente o percurso e quanto do sistema já foi coberto — essencial para revisão.

### 5. Lentes como filtro, não como tela nova

Lentes (Camadas, Domínio, Acoplamento) **recolorem/reagrupam o mesmo grafo** em vez de abrir outra tela. A
posição espacial que o usuário já entendeu é mantida; muda cor/agrupamento.

### 6. Terminal como barramento de eventos

Todo clique no grafo, na árvore ou comando digitado é logado como linha clicável no histórico. Comandos
(`goto`, `up`, `ls`, `lens`, `clear`) são determinísticos. O terminal reforça "ferramenta plugável": sem chat,
sem agente embutido — tudo é comando estruturado.

### 7. Observar mais que adivinhar

Mudanças vêm do file watcher + re-parse incremental + diff estrutural. A integração tem duas camadas:

- **Camada universal** (funciona com qualquer agente): file watcher com debounce → re-parse incremental via
  tree-sitter só do arquivo tocado → diff contra o snapshot anterior → push ao frontend. Vale para Claude Code,
  Aider, Cursor CLI, Codex, qualquer coisa.
- **Camada profunda** (opcional, por agente): hooks como `PreToolUse`/`PostToolUse` do Claude Code revelam qual
  tool foi chamada e em qual arquivo, sem esperar o save. MVP entrega a camada 1; a camada 2 é enriquecimento
  posterior.

O **git diff** é a fonte de verdade do que mudou, evitando falso positivo de arquivo salvo sem mudança real.

## Referências visuais

Layout tipo IDE (referência: VS Code e Zed): Explorer à esquerda, Canvas central, Inspector à direita,
Terminal embaixo, Status bar. Ver `docs/02-product-shape.md`.

## O que torna a ferramenta útil (síntese)

1. Revisão de agentes: você vê o que mudou estruturalmente sem reabrir cada arquivo.
2. Entendimento de código desconhecido: o mapa é o próprio guia de navegação.
3. Zero dependência de integração com o agente: funciona com qualquer ferramenta de terminal.
4. Sessão explorável e auditável: o histórico de navegação é um log reutilizável.

## Fora de escopo (documentado para não escorregar)

- Gerar ou editar código.
- Chat embutido com LLM.
- Suporte a linguagens além de TS/JS no MVP (`specs/01-mvp-scope.md`).
- Qualidade de código (lint) — outro problema.
