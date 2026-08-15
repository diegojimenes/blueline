import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Terminal } from "./Terminal";
import { useStore } from "../store";
import { demoGraph } from "../demo/demoGraph";
import { lastTerminal, instances } from "../test/xtermMock";

function terminal() {
  return lastTerminal()!;
}

describe("Terminal · xterm.js (M4)", () => {
  beforeEach(() => {
    useStore.setState({
      graph: demoGraph,
      level: 1,
      focus: null,
      lens: "layers",
      trail: [],
      selected: null,
      visited: new Set(),
      history: [],
      historyIndex: 0,
      log: [],
    });
    instances.length = 0;
  });

  it("monta xterm e indica modo demo no browser", () => {
    render(<Terminal />);
    const term = terminal();
    expect(term.writeln).toHaveBeenCalledWith(expect.stringContaining("modo browser"));
    expect(term.write).toHaveBeenCalledWith("codeatlas » ");
  });

  it("goto digitado é interceptado → comando CodeAtlas + linha clicável", () => {
    render(<Terminal />);
    const term = terminal();
    term.fireData("goto gateway.Gateway.start\r");

    expect(useStore.getState().level).toBe(4);
    expect(useStore.getState().focus).toContain("method");

    const allWrites = [...term.writeln.mock.calls.map((c) => c[0]), ...term.write.mock.calls.map((c) => c[0])].join("\n");
    expect(allWrites).toContain("›");
    expect(allWrites).toContain("goto gateway.Gateway.start  (gateway.Gateway.start)");
  });

  it("comando de shell vai ao shell demo (sem comando CodeAtlas)", () => {
    render(<Terminal />);
    const term = terminal();
    term.fireData("git status\r");

    expect(useStore.getState().history).toHaveLength(0);
    const typed = term.write.mock.calls.map((c) => c[0]).join("");
    expect(typed).toContain("git status");
  });

  it("clear limpa a tela", () => {
    render(<Terminal />);
    const term = terminal();
    term.fireData("clear\r");
    expect(term.clear).toHaveBeenCalled();
  });

  it("up sobe de nível via terminal", () => {
    render(<Terminal />);
    const term = terminal();
    term.fireData("goto gateway\r");
    expect(useStore.getState().level).toBe(2);
    term.fireData("up\r");
    expect(useStore.getState().level).toBe(1);
  });
});
