import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { useStore } from "./store";

describe("App (layout M0)", () => {
  beforeEach(() => {
    useStore.setState({ projectOpen: false, focus: null, level: 1, lens: "layers" });
  });

  it("renderiza os quatro painéis + status bar", () => {
    render(<App />);
    expect(screen.getByLabelText("Explorer")).toBeInTheDocument();
    expect(screen.getByLabelText("Canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Terminal")).toBeInTheDocument();
    const statusbar = within(screen.getByRole("contentinfo"));
    expect(statusbar.getByText("nível 1")).toBeInTheDocument();
    expect(statusbar.getByText("lente layers")).toBeInTheDocument();
  });

  it("aplica o tema no atributo data-theme da raiz", () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("alterna tema ao clicar no toggle", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Alternar tema"));
    expect(document.documentElement.dataset.theme).toBe("light");
    useStore.setState({ theme: "dark" });
  });
});
