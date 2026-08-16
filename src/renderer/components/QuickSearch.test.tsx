import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickSearch } from "./QuickSearch";
import { useStore } from "../store";
import type { SerializedGraph } from "../../core";

describe("QuickSearch · busca fuzzy global (M7)", () => {
  const fakeGraph: SerializedGraph = {
    projectRoot: "/test",
    revision: 1,
    nodes: [
      { kind: "project", id: "project", name: "app" },
      { kind: "module", id: "module:auth", name: "auth", path: "src/auth" },
      { kind: "class", id: "class:src/auth/User.ts:User", name: "User", file: "src/auth/User.ts", startLine: 1 },
      {
        kind: "method",
        id: "method:src/auth/User.ts:User:verifyPassword",
        name: "verifyPassword",
        file: "src/auth/User.ts",
        startLine: 12,
        owner: "class:src/auth/User.ts:User",
      },
    ],
    edges: [],
    moduleEdges: [],
  };

  beforeEach(() => {
    useStore.setState({
      graph: fakeGraph,
      focus: null,
      level: 1,
    });
  });

  it("não renderiza quando open é false", () => {
    render(<QuickSearch open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza lista de símbolos quando aberto", () => {
    render(<QuickSearch open={true} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("verifyPassword")).toBeInTheDocument();
  });

  it("filtra símbolos conforme o usuário digita", async () => {
    const user = userEvent.setup();
    render(<QuickSearch open={true} onClose={() => {}} />);

    const input = screen.getByLabelText("Buscar símbolos no projeto");
    await user.type(input, "verify");

    expect(screen.getByText("verifyPassword")).toBeInTheDocument();
    expect(screen.queryByText("User")).not.toBeInTheDocument();
  });

  it("seleciona nó ao pressionar Enter e fecha o modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<QuickSearch open={true} onClose={onClose} />);

    const input = screen.getByLabelText("Buscar símbolos no projeto");
    await user.type(input, "verify");
    await user.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalled();
    const state = useStore.getState();
    expect(state.focus).toBe("method:src/auth/User.ts:User:verifyPassword");
  });

  it("fecha ao pressionar Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<QuickSearch open={true} onClose={onClose} />);

    const input = screen.getByLabelText("Buscar símbolos no projeto");
    await user.type(input, "{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
