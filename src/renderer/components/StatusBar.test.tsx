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
    expect(screen.getByText("nível 2")).toBeInTheDocument();
    expect(screen.getByText("lente coupling")).toBeInTheDocument();
  });

  it("mostra o caminho humano do foco", () => {
    useStore.setState({ graph: demoGraph, focus: "module:pedidos" });
    render(<StatusBar />);
    expect(screen.getByText("pedidos")).toBeInTheDocument();
  });

  it("mostra 'sistema' sem foco ou sem grafo", () => {
    render(<StatusBar />);
    expect(screen.getByText("sistema")).toBeInTheDocument();
  });
});
