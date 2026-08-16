import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";
import { useStore } from "../store";
import { demoGraph } from "../demo/demoGraph";

describe("StatusBar", () => {
  beforeEach(() => {
    useStore.setState({ level: 1, lens: "layers", focus: null, graph: null });
  });

  it("mostra nível e lente atuais", () => {
    useStore.setState({ level: 2, lens: "coupling" });
    render(<StatusBar />);
    expect(screen.getByText("level 2")).toBeInTheDocument();
    expect(screen.getByText("view coupling")).toBeInTheDocument();
  });

  it("mostra o caminho humano do foco", () => {
    useStore.setState({ graph: demoGraph, focus: "module:pedidos" });
    render(<StatusBar />);
    expect(screen.getByText("pedidos")).toBeInTheDocument();
  });

  it("mostra 'system' sem foco ou sem grafo", () => {
    render(<StatusBar />);
    expect(screen.getByText("system")).toBeInTheDocument();
  });

  it("mostra indicador de atenção do agente quando ativo (M10)", () => {
    useStore.setState({
      agentAttention: {
        type: "attention",
        agent: "Claude",
        file: "src/auth.ts",
        symbol: "login",
        message: "refatorando",
        timestamp: Date.now(),
      },
    });
    render(<StatusBar />);
    expect(screen.getByText(/Claude: login/)).toBeInTheDocument();
  });
});
