# Spec 08 — Terminal

> Terminal **real** (PTY) onde o usuário roda seu agente/ferramenta, + terminal de comandos de navegação
> que funciona como **barramento de eventos**. Duas superfícies no mesmo componente xterm.js.

## Arquitetura

- Backend (Rust, D2): `portable-pty` hospeda `$SHELL -l` com cwd do projeto. I/O trafega por IPC com o webview.
- Frontend: xterm.js renderiza; input do usuário vai para o PTY.
- Nenhum `node-pty`/sidecar Node (D2).

```
xterm.js (webview) ◀──IPC──▶ PTY (Rust) ◀──stdin/stdout──▶ $SHELL / agente
```

## Dois modos

| Modo | O que digita | Onde processa | Exemplo |
|---|---|---|---|
| Shell | qualquer comando → vai ao PTY | backend (shell real) | `claude`, `aider`, `git status` |
| Comando CodeAtlas | começa com um dos verbos reservados | `core/commands` (determinístico) | `goto pedidos.PedidoService` |

- **Regra de desambiguação:** se a primeira palavra do input for verbo reservado (`goto|up|ls|lens|clear|help`),
  é comando CodeAtlas; senão, é enviado ao PTY. Exceção documentada: se o usuário tiver um binário chamado `ls`
  no PATH (comum), `ls` no MVP é sempre o comando CodeAtlas; digitar caminho completo (`/bin/ls`) usa o shell.

## Comandos determinísticos

| Comando | Efeito |
|---|---|
| `goto <caminho>` | navega para o nó; `<caminho>` em formato `modulo[.Classe[.metodo]]` (ex.: `goto pedidos.PedidoService.criarPedido`) |
| `up` | sobe um nível (foco pai) |
| `ls` | lista nós no nível atual (com métrica de acoplamento quando a lente pedir) |
| `lens <layers|coupling|domain>` | troca a lente ativa |
| `clear` | limpa a tela do terminal (não apaga histórico de navegação) |
| `help` | lista comandos e formato de caminho |

- Todos são **puros** em `src/core/commands`: recebem `(state, graph)` e retornam `(newState, output)`.
  Testáveis sem terminal.

## Histórico clicável (barramento de eventos)

- Todo evento de navegação (grafo, Explorer, teclado, comando) emite `navigation:changed` → o terminal
  **loga** uma linha clicável: `> goto pedidos.PedidoService  (pedidos > PedidoService)`.
- Clique numa linha re-executa o comando correspondente (volta a um ponto passado do percurso).
- Formato canônico do log: `<timestamp> <comando> (<caminho humano>)`.

## Spawn de agentes

- O usuário roda o agente normalmente: `cd` (já em cwd do projeto) e `claude` / `aider` / `codex` etc.
- As alterações salvas pelo agente são detectadas pelo watcher → live update (`specs/09-live-updates.md`).
- **Sem acoplamento:** o terminal não sabe o que é um agente; apenas hospeda o shell.

## Estado & testes

- `core/commands` coberto por vitest: tabela de casos (valores válidos, inválidos, caminhos ambíguos).
- Backend: teste de unidade de `ptys.rs` (spawn shell, echo de input/output, encerramento limpo).
- Componente terminal: renderização xterm mockada, assert de log de navegação.

> **Implementado no M4:** a desambiguação tecla a tecla vive em `src/core/tty.ts` (pura). Enquanto o buffer é
> prefixo de um verbo reservado, a linha fica em "decisão" sem eco; se deixa de ser, o buffer é liberado ao
> PTY (o shell ecoa — sem duplicar). Linhas de navegação são impressas como `› <comando>  (<caminho>)` e
> clicáveis via link provider do xterm. No browser (`pnpm dev`, sem Tauri) cai num shell demo que apenas ecoa.
