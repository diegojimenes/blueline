import { describe, expect, it } from "vitest";
import {
  initialTtyLine,
  isCommandStart,
  isReservedLine,
  navLineCommand,
  ttyStep,
  type TtyAction,
} from "./tty";

function run(input: string): TtyAction[] {
  const { state, actions } = ttyStep(initialTtyLine(), input);
  void state;
  return actions;
}

function ptyOf(actions: TtyAction[]): string {
  return actions
    .filter((a) => a.kind === "pty")
    .map((a) => a.data)
    .join("");
}

describe("tty · desambiguação comando vs shell (specs/08-terminal.md)", () => {
  it("goto reservado → comando CodeAtlas", () => {
    const actions = run("goto pedidos.PedidoService.criar\r");
    expect(actions).toContainEqual({ kind: "command", input: "goto pedidos.PedidoService.criar" });
    expect(actions.some((a) => a.kind === "pty")).toBe(false);
  });

  it("comando comum → PTY (passthrough sem eco duplicado)", () => {
    const actions = run("git status\r");
    expect(ptyOf(actions)).toBe("git status\r");
    expect(actions.some((a) => a.kind === "command")).toBe(false);
  });

  it("ls é sempre comando CodeAtlas no MVP", () => {
    expect(run("ls\r")).toContainEqual({ kind: "command", input: "ls" });
  });

  it("/bin/ls (caminho completo) usa o shell", () => {
    const actions = run("/bin/ls\r");
    expect(ptyOf(actions)).toBe("/bin/ls\r");
    expect(actions.some((a) => a.kind === "command")).toBe(false);
  });

  it("up/lens/help/clear também são comandos", () => {
    expect(run("up\r")).toContainEqual({ kind: "command", input: "up" });
    expect(run("lens coupling\r")).toContainEqual({ kind: "command", input: "lens coupling" });
    expect(run("help\r")).toContainEqual({ kind: "command", input: "help" });
    expect(run("clear\r")).toContainEqual({ kind: "command", input: "clear" });
    expect(run("open ./projeto\r")).toContainEqual({ kind: "command", input: "open ./projeto" });
  });

  it("linha só com prefixo de verbo vai ao PTY (ex.: 'l')", () => {
    const actions = run("l\r");
    expect(ptyOf(actions)).toBe("l\r");
  });

  it("verbo interrompido por tecla comum vira shell (g→gi)", () => {
    const actions = run("giant\r");
    expect(ptyOf(actions)).toBe("giant\r");
    expect(actions.some((a) => a.kind === "command")).toBe(false);
  });

  it("verbo seguido de texto não reservado vira shell (gotoxy)", () => {
    const actions = run("gotoxy\r");
    expect(ptyOf(actions)).toBe("gotoxy\r");
  });

  it("backspace durante a decisão não ecoa", () => {
    const actions = run("l\x7f\r");
    expect(ptyOf(actions)).toBe("\r");
    expect(actions.some((a) => a.kind === "command")).toBe(false);
  });

  it("ctrl+c durante a decisão cancela a linha (UI)", () => {
    const actions = run("g\x03");
    expect(actions).toContainEqual({ kind: "ui", text: "^C\r\n" });
    expect(actions.some((a) => a.kind === "pty")).toBe(false);
  });

  it("enter vazio no prompt vai ao PTY", () => {
    expect(run("\r")).toEqual([{ kind: "pty", data: "\r" }]);
  });

  it("decisão sobrevive a chunks quebrados (paste parcial)", () => {
    const first = ttyStep(initialTtyLine(), "g");
    expect(first.state.phase).toBe("deciding");
    const second = ttyStep(first.state, "oto gateway\r");
    expect(second.actions).toContainEqual({ kind: "command", input: "goto gateway" });
  });

  it("após uma linha shell, a próxima linha decide de novo", () => {
    const shellLine = ttyStep(initialTtyLine(), "echo oi\r");
    expect(shellLine.state.phase).toBe("idle");
    const next = ttyStep(shellLine.state, "up\r");
    expect(next.actions).toContainEqual({ kind: "command", input: "up" });
  });

  it("isReservedLine e isCommandStart (unidades)", () => {
    expect(isReservedLine("goto x")).toBe(true);
    expect(isReservedLine("  ls")).toBe(true);
    expect(isReservedLine("git status")).toBe(false);
    expect(isCommandStart("l")).toBe(true);
    expect(isCommandStart("le")).toBe(true);
    expect(isCommandStart("lens")).toBe(true);
    expect(isCommandStart("lens ")).toBe(true);
    expect(isCommandStart("gi")).toBe(false);
    expect(isCommandStart("gotoxy")).toBe(false);
  });

  it("navLineCommand extrai o comando de linha clicável", () => {
    expect(navLineCommand("› goto pedidos.PedidoService")).toBe("goto pedidos.PedidoService");
    expect(navLineCommand("› up")).toBe("up");
    expect(navLineCommand("› lens coupling")).toBe("lens coupling");
    expect(navLineCommand("echo oi")).toBeNull();
    expect(navLineCommand("› git status")).toBeNull();
  });
});
