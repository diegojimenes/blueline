import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";
import { useStore } from "../store";

describe("StatusBar", () => {
  beforeEach(() => {
    useStore.setState({ level: 1, lens: "layers", focus: null });
  });

  it("mostra nível e lente atuais", () => {
    useStore.setState({ level: 2, lens: "coupling" });
    render(<StatusBar />);
    expect(screen.getByText("nível 2")).toBeInTheDocument();
    expect(screen.getByText("lente coupling")).toBeInTheDocument();
  });

  it("mostra o foco quando há nó em foco", () => {
    useStore.setState({ focus: "module:pedidos" });
    render(<StatusBar />);
    expect(screen.getByText("module:pedidos")).toBeInTheDocument();
  });
});
