<div align="center">

# 🗺️ BlueLine

**Plataforma desktop de visualização arquitetural e entendimento de código em tempo real para desenvolvimento assistido por agentes de IA.**

[![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-2021_Edition-DEA584?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-178_tests_passed-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Coverage](https://img.shields.io/badge/Coverage-v8_enabled-brightgreen?style=flat-square)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

<br />

[Visão do Produto](#-o-que-é-o-blueline) •
[Principais Recursos](#-principais-recursos) •
[Arquitetura](#-arquitetura-do-sistema) •
[Comandos & Atalhos](#-comandos-e-atalhos) •
[Configuração](#-configuração-personalizada-bluelinejson) •
[Guia de Instalação](#-guia-de-instalação-e-uso) •
[Marcos M0–M13](#-marcos-implementados-m0m13) •
[Roadmap M14+](#-roadmap-m14)

</div>

---

## 💡 O que é o BlueLine?

Trabalhar com **agentes de IA no terminal** (como Claude Code, Cursor CLI, Aider, Codex ou scripts autônomos) é incrivelmente rápido, mas frequentemente **cego**. O agente cria, move e refatora arquivos em rajadas, deixando para o desenvolvedor o fardo cognitivo de reconstruir mentalmente a arquitetura do sistema a cada iteração.

O **BlueLine não é um agente, não é um chat e não é um editor de texto**. Ele **fica ao lado do seu fluxo**:
Abre o mesmo repositório no seu computador, observa as modificações em tempo real via file watcher nativo e exibe um **mapa vivo da arquitetura** (módulos, classes, métodos, funções aninhadas e as dependências entre eles), permitindo auditar e revisar alterações instantaneamente.

### ⚖️ O que o BlueLine é (e o que não é)

| ✅ É | ❌ Não é |
|---|---|
| **Visualização Estrutural Viva** (módulos, classes, métodos, arestas de chamadas/imports) | Um agente de IA, chatbot ou prompt wrapper |
| **Plataforma de Entendimento e Revisão** de mudanças em tempo real | Uma IDE completa para escrever código do zero |
| **Terminal Real PTY Integrado** onde você roda seu agente ou shell favorito | Um terminal embutido fake ou decorativo |
| **Zoom Semântico e Lentes Arquiteturais** mantendo a estabilidade espacial | Um linter, formatador ou gerador sintético de código |
| **Exportação Passiva de Contexto Determinístico** para colar no seu prompt | Um sistema que conversa com LLMs ou toma decisões autônomas |
| **Barramento Determinístico** de navegação com histórico auditável | Um visualizador de grafos genérico com nós desorganizados |

---

## ✨ Principais Recursos

### 🔍 1. Zoom Semântico em 5 Níveis
Em vez de um scroll infinito que apenas redimensiona caixas, o BlueLine troca a **representação semântica** em cada nível de abstração através de ações explícitas (duplo clique / comando `goto` / `up`):

```
[ Nível 1: Sistema ] ──> Blocos de Módulos/Camadas & Acoplamento global
        │
[ Nível 2: Módulo ]  ──> Classes, Funções e Arquivos do módulo & Relações de Import
        │
[ Nível 3: Classe ]  ──> Métodos e Membros da classe & Grafo de Chamadas
        │
[ Nível 4: Método ]  ──> Inspeção de Código-fonte, Assinatura e Escopo
        │
[ Nível 5: Local ]   ──> Funções aninhadas / closures locais e fluxo interno
```

### 👓 2. Lentes de Arquitetura (Sem Perda de Posição Espacial)
As lentes recolorem e agrupam o grafo **sem mover os nós**, preservando a memória espacial que você acabou de construir:
- 🏢 **Camadas (`layers`)**: Visualiza `domain`, `infra`, `ui`, `application`, `shared` e `entrypoint`.
- 🌐 **Domínio (`domain`)**: Agrupa símbolos por contextos de negócio configurados no `blueline.json`.
- 🔗 **Acoplamento (`coupling`)**: Destaca nós centrais e calcula métricas de dependência aferente/eferente.

### ⚡ 3. Live Updates & Observação em Tempo Real
- **File Watcher Nativo em Rust (`notify`)**: Detecta mudanças no disco com *debounce* inteligente (150ms).
- **Re-parse Incremental (Tree-Sitter WASM)**: Apenas os arquivos alterados são reprocessados.
- **Delta Push & Pulso Visual**: O Canvas emite um pulso visual destacado nos nós afetados assim que seu agente salva um arquivo.
- **Fonte de Verdade Git**: Integração direta com `git status` para distinguir edições reais de salvamentos no-op.

### 💻 4. Terminal Real (PTY) com Despachante Híbrido
O painel de terminal integra o **xterm.js** com um backend PTY real em Rust (`portable-pty`):
- Roda seu shell padrão (`bash`, `zsh`, `fish`) nativamente.
- Executa seu agente favorito (`claude`, `aider`, `git commit`, `pnpm test`) no mesmo diretório do projeto.
- **Despacho Inteligente**: Comandos reservados (`goto`, `up`, `ls`, `lens`, `query`, `clear`, `help`) são interceptados instantaneamente e refletidos no grafo.
- **Histórico Clicável**: Cada comando registrado no terminal vira um link para navegar pelo grafo.

### 🌀 5. Portais & Navegação Lateral
Ao inspecionar uma classe ou método no Nível 3, chamadas a entidades externas são renderizadas como **Portais Determinísticos** nas laterais do Canvas (entradas à esquerda, saídas à direita), permitindo saltar diretamente para módulos externos seguindo o fluxo de execução sem poluição visual.

### 🔎 6. Busca Fuzzy Global Instantânea (`Ctrl+P` / `Cmd+P` / `/`)
Modal `QuickSearch` com busca difusa indexada em memória para encontrar instantaneamente qualquer módulo, classe, interface ou método por nome ou caminho canônico.

### 📊 7. Diff Estrutural & Snapshots de Grafo
- Visualizador de **Git Diff unificado** com syntax highlighting e word-level diff para adições, deleções e hunks.
- Comparação entre snapshots de grafo (`computeGraphDiff`) identificando nós estruturalmente adicionados, removidos ou modificados após rajadas de commits do agente.

### 📋 8. Protocolo de Agente & Exportação Passiva de Contexto
> **Importante:** O BlueLine **NÃO** conversa com o agente, **NÃO** faz chamadas a APIs de LLMs e **NÃO** possui chat conversacional.
- **Exportação de Contexto Estruturado**: Fornece um mecanismo rápido para copiar a assinatura, hierarquia, dependências e referências cruzadas de um nó no formato otimizado para você colar no prompt do seu agente de IA CLI.
- **Indicador Visual de Atenção**: Notificação visual na `StatusBar` e na barra de revisão indicando os nós em foco na sessão de análise.

### 🐍 9. Suporte Multi-Linguagem Extensível
Arquitetura de parsing baseada em `CompositeParser`:
- 🟦 **TypeScript / TSX / JavaScript / JSX** (via Tree-Sitter WASM incremental).
- 🟨 **Python (`.py`, `.pyi`)** (extração de classes, métodos, imports e chamadas).

### 🚀 10. Performance com Spatial Grid Hash & Cache Persistente
- **Spatial Grid Index**: Culling espacial com tempo de resposta $O(1)$, mantendo 60 FPS fluidos no Canvas mesmo com milhares de nós.
- **Graph Cache Storage**: Armazenamento e restauração de snapshots em cache para boot instantâneo de projetos extensos.

### 🎯 11. Motor de Query Estruturada (`query` / `q`)
Consultas declarativas avançadas direto no terminal para filtrar e isolar partes específicas da arquitetura:
```bash
query kind:class layer:domain coupling:>2
query name:User file:auth.ts
query kind:method owner:PedidoService
```

### 💾 12. Persistência Reativa de Sessão
Armazena a trilha percorrida, nós visitados, lente ativa, posição de viewport e histórico no `localStorage`. Ao reabrir o aplicativo, a sessão é restaurada e validada estruturalmente contra o estado atual do disco.

---

## 🏛️ Arquitetura do Sistema

O BlueLine é construído com separação estrita de responsabilidades: **Modelo Primeiro, UI Depois**.

```mermaid
graph TD
    subgraph RustBackend["Backend Nativo (Rust / Tauri 2)"]
        PTY[PTY Process - portable-pty]
        Watcher[File Watcher - notify]
        Git[System Git Provider]
        FS[Project File Scanner]
    end

    subgraph CoreDomain["Núcleo Puro (src/core - TypeScript)"]
        TreeSitter[Tree-Sitter WASM Parser]
        BuildGraph[Graph Builder & Resolver]
        CodeGraph[(Normalized CodeGraph)]
        SpatialIndex[Spatial Grid Hash Index]
        QueryEngine[Query Engine]
        Lenses[Architecture Lenses]
        Delta[Incremental Delta & Diff]
    end

    subgraph FrontendUI["Interface do Usuário (src/renderer - React 19)"]
        Store[Zustand State Store]
        Canvas[Canvas 2D Renderer]
        Explorer[Tree Explorer]
        Inspector[Inspector & Metrics]
        Terminal[xterm.js Terminal]
        QuickSearch[QuickSearch Modal]
    end

    Watcher -->|blueline:files-changed| TreeSitter
    FS -->|read_project| TreeSitter
    Git -->|git_status / git_diff| Delta
    PTY <-->|PTY I/O Stream| Terminal

    TreeSitter --> BuildGraph --> CodeGraph
    CodeGraph --> SpatialIndex
    CodeGraph --> QueryEngine
    CodeGraph --> Lenses
    CodeGraph --> Delta

    CodeGraph --> Store
    Store --> Canvas
    Store --> Explorer
    Store --> Inspector
    Store --> Terminal
    Store --> QuickSearch
```

### Regras de Ouro da Engenharia
1. **Núcleo sem Framework (`src/core`)**: Toda a lógica de parse, resolução de imports, cálculo de layout, lentes, busca e diff é TypeScript puro testável com Vitest sem depender do React ou Tauri.
2. **Grafo Normalizado e Determinístico**: IDs estáveis no formato `modulo.Classe.metodo`.
3. **Observar > Adivinhar**: Mudanças reais são detectadas pelo sistema de arquivos e validadas contra o Git.

---

## ⌨️ Comandos e Atalhos

### Comandos do Terminal BlueLine

| Comando | Sintaxe / Exemplo | Descrição |
|---|---|---|
| `goto` | `goto auth.AuthService.login` | Salta diretamente para um nó por caminho ou nome |
| `up` | `up` | Sobe um nível no zoom semântico (equivalente a `Esc`) |
| `ls` | `ls` | Lista os nós visíveis e filhos no nível atual |
| `lens` | `lens layers` \| `lens domain` \| `lens coupling` | Alterna a lente arquitetural ativa |
| `query` / `q` | `query kind:class layer:domain` | Filtra o grafo usando seletores estruturados |
| `clear` | `clear` | Limpa a tela do terminal |
| `help` | `help` | Exibe a lista de comandos e opções disponíveis |

*(Qualquer outro comando não reservado, como `git`, `npm`, `cargo`, `claude`, `aider`, é enviado diretamente ao shell PTY nativo)*

### Atalhos de Teclado

| Atalho | Ação |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>P</kbd> ou <kbd>Cmd</kbd> + <kbd>P</kbd> | Abrir modal de **Busca Rápida** (QuickSearch) |
| <kbd>/</kbd> | Focar no Terminal / Busca rápida |
| <kbd>Esc</kbd> | Subir um nível de zoom semântico |
| <kbd>Duplo Clique</kbd> (no nó) | Fazer zoom semântico e entrar no elemento |
| <kbd>Duplo Clique</kbd> (no vazio) | Subir um nível de zoom semântico |
| <kbd>Alt</kbd> + <kbd>←</kbd> | Voltar no histórico de navegação |
| <kbd>Alt</kbd> + <kbd>→</kbd> | Avançar no histórico de navegação |
| <kbd>L</kbd> | Alternar ciclicamente entre as Lentes |

---

## ⚙️ Configuração Personalizada (`blueline.json`)

Você pode adicionar um arquivo `blueline.json` na raiz do seu repositório para personalizar a taxonomia de camadas e domínios de negócio específicos do seu projeto (evitando que diretórios como `engine`, `systems` ou `behaviors` caiam em classificações genéricas):

```json
{
  "layerPaths": {
    "domain": ["models", "entities", "domain", "core"],
    "application": ["usecases", "services", "controllers", "systems"],
    "infra": ["database", "repositories", "clients", "http", "adapters"],
    "ui": ["components", "views", "screens", "canvas"]
  },
  "domainPaths": {
    "billing": ["billing", "payments", "checkout"],
    "auth": ["auth", "users", "identity"],
    "physics": ["physics", "simulation", "collision"],
    "analytics": ["metrics", "tracking"]
  },
  "ignore": ["**/*.test.ts", "**/dist/**", "**/node_modules/**"]
}
```

> **Nota de Compatibilidade**: O arquivo `blueline.json` é o padrão oficial. Por motivos de retrocompatibilidade com projetos existentes, o arquivo legado `codeatlas.json` continua sendo carregado como fallback caso `blueline.json` não seja encontrado.

---

## 📁 Estrutura de Diretórios

```
blueline/
├── src/
│   ├── core/                  # Núcleo puro (independente de UI)
│   │   ├── analyze/           # Construção e resolução do grafo
│   │   ├── parse/             # Parsers Tree-Sitter TS/JS e Python
│   │   ├── storage/           # Cache de grafo persistente
│   │   ├── agent-protocol.ts  # Exportação de contexto para prompts
│   │   ├── commands.ts        # Parser e despachante de comandos
│   │   ├── diff.ts            # Git diff e comparação de snapshots
│   │   ├── layout.ts          # Algoritmos de layout determinísticos
│   │   ├── lenses.ts          # Lentes (Camadas, Domínio, Acoplamento)
│   │   ├── navigation.ts      # Zoom semântico e visibilidade
│   │   ├── query.ts           # Motor de consultas estruturadas
│   │   ├── search.ts          # Motor de busca fuzzy
│   │   ├── spatial-index.ts   # Spatial Grid Hash O(1)
│   │   └── workspace.ts       # Agregação de monorepos
│   └── renderer/              # Interface React 19
│       ├── components/        # Canvas, Explorer, Inspector, Terminal, QuickSearch, etc.
│       ├── store/             # Zustand store reativo e integrado
│       └── session.ts         # Persistência e restauração de sessão
├── src-tauri/                 # Backend Rust (Tauri 2)
│   └── src/
│       ├── git.rs             # Provedor Git nativo (git status / diff)
│       ├── ptys.rs            # Terminal PTY real (portable-pty)
│       ├── watcher.rs         # File watcher de alta performance (notify)
│       └── project.rs         # Scanner de arquivos do projeto
├── docs/                      # Visão e design de produto
├── specs/                     # Especificações técnicas formais (M0 a M13)
└── fixtures/                  # Repositórios e códigos de teste
```

---

## 🚀 Guia de Instalação e Uso

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 20 ou superior)
- [pnpm](https://pnpm.io/) (versão 9 ou superior)
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (para compilação do Tauri 2)

### 1. Clonar e Instalar Dependências

```bash
# Clone o repositório
git clone git@github.com:diegojimenes/blueline.git
cd blueline

# Instale as dependências
pnpm install
```

### 2. Executar em Modo de Desenvolvimento

```bash
# Executar a aplicação desktop completa (Tauri 2 + React):
pnpm tauri dev

# Ou executar apenas a interface web no navegador (com demo mockada):
pnpm dev
```

### 3. Abrindo um Repositório no BlueLine

1. Ao abrir o aplicativo, clique no botão **"Abrir"** no canto superior esquerdo ou use o seletor de diretório.
2. O BlueLine irá escanear o projeto, construir o grafo estrutural e iniciar o watcher de arquivos em tempo real.
3. No painel inferior de terminal, seu shell habitual estará pronto para rodar seu agente de IA (`claude`, `aider`, etc.) ou comandos de navegação (`goto`, `ls`, `query`).

---

## 🧪 Testes e Qualidade

O projeto possui uma suíte completa de testes automatizados executados a cada commit no pipeline de CI:

```bash
# Executar todos os testes de unidade no frontend e core (178 testes Vitest)
pnpm test

# Executar testes com relatório de cobertura (v8)
pnpm test:coverage

# Executar testes unitários do backend nativo Rust (8 testes Cargo)
cd src-tauri && cargo test

# Checagem estrita de tipos e linter
pnpm typecheck
pnpm lint
```

**Status Atual dos Testes:**
- ✅ **178 testes Vitest** passando (100% verde)
- ✅ **8 testes Cargo (Rust)** passando (100% verde)
- ✅ Typecheck TypeScript (`tsc --noEmit`) e ESLint 100% livres de erros

---

## 🏆 Marcos Implementados (M0–M13)

- [x] **M0 — Fundação**: Setup Tauri 2 + React 19 + TypeScript estrito + Vitest + CI.
- [x] **M1 — Parse & Modelo**: Parser Tree-Sitter WASM incremental, normalização de grafo e serialização canônica.
- [x] **M2 — Grafo & Zoom Semântico**: Layout determinístico por níveis, canvas com culling, navegação por portais e histórico.
- [x] **M3 — Layout IDE & Lentes**: Painéis de Explorer, Inspector e Canvas com lentes de Camadas, Domínio e Acoplamento.
- [x] **M4 — Terminal Real**: Integração de xterm.js com PTY Rust (`portable-pty`) e interceptação de comandos.
- [x] **M5 — Live Updates**: Watcher `notify` com debounce, re-parse incremental, diff e pulso visual.
- [x] **M5.1 — UX Refinada & Níveis 4/5**: Inspeção de métodos, funções aninhadas/locais, arestas limpas e integração com Git.
- [x] **M6 — Persistência de Sessão**: Salva e restaura trilhas, foco e histórico com validação de consistência no disco.
- [x] **M7 — Busca Fuzzy Global**: QuickSearch modal com atalhos `Ctrl+P`/`Cmd+P`/`/` e filtro $O(1)$.
- [x] **M8 & M9 — Diff & Snapshots**: Diff visual unificado no Inspector e `computeGraphDiff` para auditoria estrutural.
- [x] **M10 — Protocolo de Agente**: Extração passiva de contexto de símbolos/chamadas para prompts e notificação visual de atenção.
- [x] **M11 — Extensibilidade Multi-Linguagem**: Suporte a repositórios Python (`.py`/`.pyi`) via `CompositeParser`.
- [x] **M12 — Performance & Cache**: Spatial Grid Hash para culling a 60 FPS e `GraphCacheStorage` para repositórios gigantes.
- [x] **M13 — Query Graph & Multi-Projeto**: Motor de consultas estruturadas (`query kind:class layer:domain`) e suporte a workspaces.

---

## 🗺️ Roadmap (M14+)

Planejamento para as próximas versões do BlueLine:

- [ ] **M14 — Clusters Semânticos & Persistência de Visões (`save-view` / `load-view`)**:
  - Salvar conjuntos de nós e símbolos focados durante uma investigação de bug ou refatoração complexa.
  - Carregar visões salvas instantaneamente no Canvas para alternar entre diferentes fluxos de trabalho sem perder o contexto cognitivo.
- [ ] **M15 — Exportação Arquitetural e Relatórios**:
  - Exportação de diagramas estruturais em SVG vetorial e resumos arquiteturais em Markdown para documentação de PRs e ADRs.
- [ ] **M16 — Métricas de Complexidade e Impacto**:
  - Cálculo visual de complexidade ciclomática e raio de impacto estrutural ao modificar classes centrais.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo `LICENSE` para mais informações.
