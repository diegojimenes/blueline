/**
 * Classificação determinística de input do terminal real (specs/08-terminal.md).
 *
 * Duas superfícies no mesmo xterm.js:
 *  - **Shell**: input vai ao PTY (backend) sem interferência.
 *  - **Comando BlueLine**: input começa com verbo reservado (goto|up|ls|lens|clear|help|open)
 *    e é processado por `core/commands` (o `open` é assíncrono — store).
 *
 * Regra de desambiguação (spec 08): se a primeira palavra do input for verbo
 * reservado, é comando BlueLine; senão, vai ao PTY. `ls` é sempre comando
 * BlueLine no MVP (`/bin/ls` usa o shell).
 *
 * A decisão é tomada tecla a tecla: enquanto o buffer é prefixo de um verbo
 * reservado, mantemos a linha "em decidindo" (sem eco); assim que deixa de ser,
 * enviamos o buffer acumulado ao PTY (o shell ecoa — sem duplicar).
 */

export const RESERVED_VERBS = ["goto", "up", "ls", "lens", "clear", "help", "open"] as const;

export type ReservedVerb = (typeof RESERVED_VERBS)[number];

export type TtyAction =
  | { kind: "pty"; data: string }
  | { kind: "command"; input: string }
  | { kind: "ui"; text: string }
  | { kind: "clear" };

/** Marcador impresso antes das linhas de navegação clicáveis no xterm. */
export const NAV_MARKER = "›";

/** Extrai o comando de uma linha de histórico clicável (ou null). */
export function navLineCommand(text: string): string | null {
  const m = text.trim().match(new RegExp(`^${NAV_MARKER} (goto|up|lens)( .*)?$`));
  if (!m) return null;
  return m[1] + (m[2] ?? "");
}

export interface TtyLineState {
  /** idle: prompt exibido, aguardando; deciding: bufferando início de linha; pass: PTY. */
  phase: "idle" | "deciding" | "pass";
  buffer: string;
}

export function initialTtyLine(): TtyLineState {
  return { phase: "idle", buffer: "" };
}

/** Verbo reservado se a primeira palavra da linha for um deles. */
export function isReservedLine(line: string): boolean {
  const first = line.trimStart().split(/\s+/)[0] ?? "";
  return (RESERVED_VERBS as readonly string[]).includes(first);
}

/** Buffer ainda pode virar um comando reservado (prefixo ou verbo completo [+arg]). */
export function isCommandStart(buffer: string): boolean {
  if (buffer.length === 0) return false;
  if ((RESERVED_VERBS as readonly string[]).some((v) => v.startsWith(buffer))) return true;
  if ((RESERVED_VERBS as readonly string[]).includes(buffer)) return true;
  const space = buffer.indexOf(" ");
  if (space > 0) {
    const verb = buffer.slice(0, space);
    return (RESERVED_VERBS as readonly string[]).includes(verb);
  }
  return false;
}

function isPrintable(c: string): boolean {
  if (c === "\r" || c === "\n" || c === "\x03" || c === "\x7f" || c === "\x08") return false;
  return true;
}

/**
 * Consome um chunk de input e devolve o novo estado + ações.
 * Chunks podem conter múltiplas teclas (paste); processa caractere a caractere.
 */
export function ttyStep(state: TtyLineState, chunk: string): { state: TtyLineState; actions: TtyAction[] } {
  const actions: TtyAction[] = [];
  let s = state;
  for (const c of chunk) {
    const step = stepChar(s, c);
    s = step.state;
    for (const a of step.actions) actions.push(a);
  }
  return { state: s, actions };
}

function stepChar(state: TtyLineState, c: string): { state: TtyLineState; actions: TtyAction[] } {
  switch (state.phase) {
    case "idle":
      if (isPrintable(c)) {
        // Começa uma linha: pode ser comando BlueLine?
        if (isCommandStart(c)) return { state: { phase: "deciding", buffer: c }, actions: [] };
        return { state: { phase: "pass", buffer: "" }, actions: [{ kind: "pty", data: c }] };
      }
      return { state, actions: [{ kind: "pty", data: c }] };

    case "deciding": {
      if (c === "\x7f" || c === "\x08") {
        const buffer = state.buffer.slice(0, -1);
        if (buffer.length === 0) return { state: { phase: "idle", buffer: "" }, actions: [] };
        return { state: { phase: "deciding", buffer }, actions: [] };
      }
      if (c === "\x03") {
        return {
          state: { phase: "idle", buffer: "" },
          actions: [{ kind: "ui", text: "^C\r\n" }],
        };
      }
      if (c === "\r") {
        const buffer = state.buffer;
        if (buffer.length === 0) return { state: { phase: "idle", buffer: "" }, actions: [{ kind: "pty", data: "\r" }] };
        if (isReservedLine(buffer)) return { state: { phase: "idle", buffer: "" }, actions: [{ kind: "command", input: buffer }] };
        return { state: { phase: "idle", buffer: "" }, actions: [{ kind: "pty", data: `${buffer}\r` }] };
      }
      if (isPrintable(c)) {
        const nb = state.buffer + c;
        if (isCommandStart(nb)) return { state: { phase: "deciding", buffer: nb }, actions: [] };
        return { state: { phase: "pass", buffer: "" }, actions: [{ kind: "pty", data: `${state.buffer}${c}` }] };
      }
      // Outros controles (setas etc.) durante a decisão: libera o buffer ao PTY.
      return { state: { phase: "pass", buffer: "" }, actions: [{ kind: "pty", data: `${state.buffer}${c}` }] };
    }

    case "pass":
      if (c === "\r") return { state: { phase: "idle", buffer: "" }, actions: [{ kind: "pty", data: c }] };
      return { state, actions: [{ kind: "pty", data: c }] };
  }
}
