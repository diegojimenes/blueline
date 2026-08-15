# Glossário

Termos usados de forma consistente em docs, specs e código. Nomes de tipos em inglês (usados no código).

| Termo | Definição |
|---|---|
| **CodeGraph** | Modelo normalizado do código do projeto: nós + arestas + snapshots. `specs/03-data-model.md`. |
| **Nó (Node)** | Entidade do grafo: `ProjectNode`, `ModuleNode`, `ClassNode`, `MethodNode`. Tem ID estável. |
| **Aresta (Edge)** | Ligação entre nós: acoplamento, import, chamada. Tipada e com metadados. |
| **Nível (Level)** | Nível de zoom semântico: 1 Sistema, 2 Módulo, 3 Classe, 4 Método. |
| **Transição** | Ação explícita de troca de nível (entrar/sair), nunca scroll infinito. |
| **Salto lateral** | Navegação por aresta sem mudar de nível (via portais ou lista do Inspector). |
| **Portal** | Nó tracejado na borda do canvas representando entidade fora do foco atual; clique pula para ela. |
| **Trilha (Trail)** | Caminho de exploração percorrido, iluminado sobre o grafo e clicável no histórico. |
| **Lente (Lens)** | Filtro que recolor/regrupa o mesmo grafo (Camadas, Domínio, Acoplamento). Não abre tela nova. |
| **Watcher** | Observação de arquivos (crate `notify`) que detecta mudanças no working dir. |
| **Re-parse incremental** | Reparse só dos arquivos alterados via tree-sitter, sem re-analisar o projeto. |
| **Diff estrutural** | Diferença entre o snapshot anterior e o atual do CodeGraph (nós/arestas adicionados/removidos/alterados). |
| **Git diff** | Fonte de verdade do que mudou; evita falso positivo de save sem mudança real. |
| **PTY** | Terminal pseudo-tty real (crate `portable-pty`) que hospeda `$SHELL`/agentes. |
| **Barramento de eventos** | Todo evento de navegação vira linha clicável no histórico do terminal. |
| **Camada (Layer)** | Agrupamento macro por convenção de caminho (ex.: `src/api`, `src/domain`). |
| **Domínio** | Agrupamento por prefixo de caminho configurável (ex.: `pedidos`, `pagamentos`). |
| **Acoplamento** | Grau de conexão de um nó (contagem de arestas in/out; interno vs externo). |
| **Snapshot** | Estado imutável do CodeGraph em um instante, usado para diff. |
| **Fixture** | Projeto TS fictício pequeno usado em testes para gerar grafos golden. |
| **Grafo golden** | Snapshot de referência do parse de uma fixture, comparado nos testes. |
