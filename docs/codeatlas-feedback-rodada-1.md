# CodeAtlas — feedback e dúvidas (rodada 1)

Contexto: Tauri + node-pty. Revisão feita em cima de screenshot do app rodando no projeto "game engine", tela `core.PhysicsSystem`, Modo Revisão IA ativo (21 arquivos / 42 símbolos).

## Dúvidas técnicas (preciso de resposta antes de sugerir próximos passos)

1. **Como "símbolos tocados" é calculado hoje?**
   É git diff (linhas alteradas) mapeado pra nós da AST, ou vem de hooks do agente (ex: eventos PreToolUse/PostToolUse do Claude Code, quando disponíveis)? Isso muda bastante a precisão: diff é genérico e funciona com qualquer agente, mas só sabe o que mudou depois do save; hooks sabem o que tá mudando *enquanto* acontece, mas só existem pra agentes que expõem esse tipo de evento. Se hoje é só diff, vale mapear quais agentes (Claude Code, Aider, Cursor CLI, etc.) expõem hooks e planejar isso como camada de enriquecimento opcional.

2. **O app faz parsing do stdout do agente (scraping de texto tipo `Edit(...)`) pra saber o que ele está fazendo, ou é 100% baseado em filesystem/git?**
   Se for scraping de stdout, isso é frágil — cada agente tem formato de output diferente e pode mudar sem aviso. Se for só fs+git, isso é mais robusto mas mais genérico. Preciso saber qual caminho foi escolhido pra avaliar o resto.

3. **O "Anterior / Próximo" do Modo Revisão IA é escopado a quê?**
   Na tela, mostra "1 / 42" enquanto o foco visível é `core.PhysicsSystem`. Os 42 símbolos são do projeto inteiro ou filtrados pra essa classe/módulo? Se for global, navegar "Próximo" a partir de um método de física pode pular pra um componente de UI sem aviso.

4. **Debounce / batching de eventos do watcher.**
   Agentes de IA costumam escrever em rajada (múltiplos saves em poucos ms). O watcher já tem debounce, ou cada save dispara um re-parse individual? Isso importa tanto pra performance quanto pra não gerar entradas duplicadas/ruidosas na lista de alterações.

5. **O que acontece se o agente fizer commit automático durante a sessão?**
   Alguns agentes commitam sozinhos. Se o tracking de "símbolo tocado" é baseado em diff contra o working tree, um commit no meio da sessão pode "limpar" o diff e a ferramenta perder o rastro do que mudou. Vale confirmar se isso é tratado (ex: comparar contra o commit do início da sessão, não contra HEAD).

## Bugs / pontos a verificar

- **Terminal "matando" o processo e reabrindo no diretório do projeto**: já esclarecido que é comportamento esperado (processo do agente termina → novo prompt no cwd). Vale só confirmar que o watcher de arquivos não depende do processo do terminal estar vivo pra continuar funcionando — se o terminal cair, a visualização não pode perder eventos.
- **Truncamento de nomes longos** (ex: "getCharacterControll…"): confirmar se existe tooltip/hover mostrando o nome completo, ou se o nome só fica cortado sem alternativa de leitura.

## Sugestões de melhoria

1. **Deixar o escopo da paginação explícito na UI** — "1/42 no projeto" vs "1/8 nesta classe", com toggle pra alternar entre os dois modos de navegação.
2. **Classificação de domínio caiu em "outros" pra `core.PhysicsSystem`** — heurística provavelmente foi desenhada em cima de nomenclatura tipo `service`/`controller`/`repository` (padrão web/CRUD), que não cobre bem arquitetura de engine (`core`, `components`, `behaviors`, `systems`). Sugestão: permitir um arquivo de configuração por projeto (ex: `.codeatlas.json`) onde o usuário define/mapeia a taxonomia de domínio e camada do próprio projeto, em vez de depender só de heurística automática.
3. **Barra de "Acoplamento Estrutural"** — confirmar se a escala é relativa ao máximo do projeto ou absoluta. Com "1 dependência" a barra aparenta quase vazia; se for relativa, tá correto, mas vale mostrar o número absoluto ao lado pra não parecer bug.
4. **Indicador de status do watcher** — hoje mostra só "ativo". Sugestão: mostrar também há quanto tempo veio o último evento e se está tentando reconectar, pra ficar claro quando algo parou de funcionar silenciosamente.

## Em aberto pra próxima rodada
Aguardando mais screenshots pra revisar: fluxo de abrir um projeto novo pela primeira vez, e o modo sem "Revisão IA" ativo (código não alterado).

---

# Rodada 2 — grafo em nível 1/2, lentes, e revisão em nível 3

Contexto: 5 screenshots — nível 1 (módulos, lente camadas e depois coupling via tecla `L`), nível 2 (classes dentro de `core`), nível 3 (métodos dentro de `core.SceneIO`, com diff).

## Bug encontrado

- **Card com nome e caminho de arquivo não batem**: no nível 2 (classes de `core`), o card mostra título "Registry" mas o caminho embaixo é `core/BehaviorSystem.ts`. Ou o card está pegando o nome errado, ou o caminho errado — os dois juntos não fazem sentido. Provavelmente um bug no mapeamento símbolo→arquivo na hora de montar os cards desse nível.

## O objetivo é "ajudar a entender o código" — onde a UI ainda atrapalha isso

1. **Lente só descobrível via atalho `L`, sem controle visual clicável.**
   Hoje o único indício de que existem lentes é um badge pequeno no canto superior esquerdo do canvas ("CAMADA: CORE" / "CAMADA: COUPLING") que só muda se você já souber apertar `L`. Pra quem tá tentando entender uma base de código pela primeira vez, isso é a funcionalidade mais importante da ferramenta e a mais escondida. Sugestão: manter o atalho, mas também ter pills/botões clicáveis (como tínhamos nos protótipos) — descoberta não pode depender de o usuário already saber o atalho.

2. **Lente de acoplamento (coupling) não tem legenda, e a escala não é óbvia pela cor.**
   No print com "CAMADA: COUPLING", os cards ficam com fundo avermelhado/amarronzado mas é difícil dizer, só de olhar, qual módulo tem mais ou menos acoplamento que o outro — a maioria parece "meio vermelha". Uma lente cuja função é justamente comunicar intensidade numa escala precisa ter uma legenda visível (gradiente com valores) sempre que estiver ativa, não só implícita na cor de fundo.

3. **Modo Revisão IA com "MODIFICADO" em quase todo card faz o destaque perder função.**
   Com 21 de X arquivos alterados, boa parte da tela fica com borda laranja e badge "MODIFICADO" — quando quase tudo tá marcado, nada se destaca de verdade. Isso é o efeito colateral clássico de "highlight everything = highlight nothing". Ideias:
   - Diferenciar magnitude visualmente (borda mais grossa/cor mais saturada pra métodos com diff grande, mais sutil pra diffs pequenos) em vez de um badge binário.
   - Ter um filtro "mostrar só os mais impactados" (top N por linhas alteradas) como ponto de entrada, em vez de a lista inteira de uma vez.

4. **DOMÍNIO aparece como "outros" em todo nível revisado até agora** (`components`, `core`, `PhysicsSystem`...) — confirma o ponto da rodada 1: a lente de domínio hoje não diferencia nada nesse projeto, então na prática não ajuda em nada a entender a arquitetura dele. Esse é provavelmente o item de maior prioridade pra próxima leva, porque é uma lente inteira sem sinal.

5. **Arestas entre módulos não têm rótulo nem tooltip.**
   No nível 1 dá pra ver linhas conectando `editor→hooks`, `components→core`, `components→hooks`, mas não tem como saber, sem abrir o código, se é import, chamada de função, ou outra coisa — nem quantas ocorrências essa aresta representa. Um hover na aresta mostrando "3 imports" ou "1 chamada direta" mudaria muito o quanto a ferramenta realmente explica a relação, em vez de só apontar que ela existe.

6. **Espaço vazio nos cards de módulo/classe é oportunidade desperdiçada.**
   Os cards (ex: "components", "core") têm bastante espaço em branco entre o contador de classes e o caminho do arquivo. Dava pra usar esse espaço pra algo que ajude a entender rápido: uma mini-lista dos itens mais relevantes ali dentro (ex: as 2-3 classes mais acopladas, ou as mais alteradas na sessão atual).

7. **A ideia com mais potencial pra "ajudar a entender", olhando o nível 3 (`core.SceneIO`)**: a lista de métodos alterados tem `saveScene`, `saveTauri`, `saveBrowser`, `loadScene`, `loadTauri`, `loadLastSceneTauri`, `loadBrowser`, `isTauri` — 8 itens numa lista plana, cada um como card separado. Mas isso é **uma mudança só**, só que espalhada: "SceneIO ganhou um branch de persistência dual (Tauri vs navegador)". Listar cada método isoladamente exige que o dev reconstrua essa intenção na cabeça, exatamente o problema que motivou a ferramenta inteira. Sugestão de maior impacto: agrupar metodos com padrão de nome/diff parecido num cluster com uma legenda curta de "o que esse grupo faz" (pode ser heurística de prefixo `save*`/`load*` pra começar, sem precisar de IA; depois, se quiser, uma lente que usa IA só pra gerar essa legenda de intenção por grupo — continua sendo uma lente/plugin, não um agente de chat).

8. **Progresso de revisão não é visível.**
   O contador "1 / 42" mostra só a posição atual, não quanto já foi de fato revisado. Vale ter algo tipo "12 de 42 revisados" com marca de "visto" separada do badge "MODIFICADO" (ideia parecida com o que o CodeSee fazia com "mark as reviewed" nos PRs).

9. **Diff view corta linhas longas sem opção de quebrar.**
   No painel de diff (nível 3), várias linhas de código ficam cortadas na lateral (ex: `console.info(...)`, `readTextFile(...)`) sem quebra de linha visível. Um toggle "quebrar linha" no painel de diff resolveria.

10. **Chip de referência cruzada ("← App") sobrepondo um card no nível 3.**
    Na tela de métodos do `SceneIO`, o portal "← App" aparece flutuando por cima do card `loadBrowser`, meio deslocado — parece colisão de posicionamento/z-index, vale checar o layout desses chips nesse nível especificamente.

## Coisa que já está funcionando bem e vale manter
- A separação entre **dado** (o que mudou, badge MODIFICADO) e **lente** (como colorir) se mantém consistente trocando de lente — o "MODIFICADO" não some nem muda ao trocar de CORE pra COUPLING. Isso confirma que a arquitetura de lentes como camada de cor por cima do mesmo grafo, que discutimos desde o início, está implementada do jeito certo.
- Nível/breadcrumb/painel de inspeção (`CAMADA`/`DOMÍNIO`/`CLASSES`/`Acoplamento`) consistente em todos os níveis.
