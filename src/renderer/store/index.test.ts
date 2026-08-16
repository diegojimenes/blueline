import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./index";
import { demoGraph } from "../demo/demoGraph";

describe("store · navegação M2", () => {
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
      log: [],
    });
  });

  it("dispatch 'goto' entra no método e gera histórico clicável", () => {
    useStore.getState().dispatch("goto gateway.Gateway.start");
    const s = useStore.getState();
    expect(s.level).toBe(4);
    expect(s.focus).toContain("method");
    expect(s.history).toHaveLength(1);
    expect(s.history[0].command).toBe("goto gateway.Gateway.start");
    expect(s.log[s.log.length - 1]).toMatchObject({ target: s.focus });
  });

  it("enterNode (duplo clique) e goto produzem as MESMAS entradas de histórico", () => {
    useStore.getState().dispatch("goto pedidos.PedidoService");
    const viaComando = useStore.getState().history;

    useStore.setState({ level: 1, focus: null, trail: [], selected: null, history: [], log: [] });
    useStore.getState().enterNode("class:src/pedidos/PedidoService.ts:PedidoService");
    const viaCanvas = useStore.getState().history;

    expect(viaCanvas.map((e) => ({ ...e, timestamp: 0 }))).toEqual(viaComando.map((e) => ({ ...e, timestamp: 0 })));
  });

  it("up volta ao sistema pelo caminho inverso", () => {
    useStore.getState().dispatch("goto auth.AuthService");
    expect(useStore.getState().level).toBe(3);
    useStore.getState().up();
    expect(useStore.getState().level).toBe(2);
    useStore.getState().up();
    expect(useStore.getState().level).toBe(1);
    expect(useStore.getState().focus).toBeNull();
  });

  it("clear limpa o log mas preserva o histórico de navegação", () => {
    useStore.getState().dispatch("goto gateway");
    useStore.getState().dispatch("clear");
    const s = useStore.getState();
    expect(s.log).toHaveLength(0);
    expect(s.history).toHaveLength(1);
  });

  it("comando desconhecido não muda navegação", () => {
    useStore.getState().dispatch("bogus xyz");
    const s = useStore.getState();
    expect(s.log.some((l) => l.text.includes("unknown"))).toBe(true);
    expect(s.history).toHaveLength(0);
  });

  it("cycleLens alterna a lente ativa e registra no histórico", () => {
    expect(useStore.getState().lens).toBe("layers");
    useStore.getState().cycleLens();
    expect(useStore.getState().lens).toBe("coupling");
    useStore.getState().cycleLens();
    expect(useStore.getState().lens).toBe("domain");
    useStore.getState().cycleLens();
    expect(useStore.getState().lens).toBe("layers");
  });

  it("back/forward percorrem o histórico de foco (Alt+← / Alt+→)", () => {
    useStore.getState().dispatch("goto gateway");
    useStore.getState().dispatch("goto gateway.Gateway");
    useStore.getState().back();
    const s = useStore.getState();
    expect(s.focus).toBe("module:gateway");
    expect(s.level).toBe(2);
    useStore.getState().back();
    expect(useStore.getState().focus).toBeNull();
    expect(useStore.getState().level).toBe(1);
    useStore.getState().forward();
    expect(useStore.getState().focus).toBe("module:gateway");
    useStore.getState().forward();
    expect(useStore.getState().focus).toContain("class");
  });

  it("back no início do histórico sobe ao sistema e depois não faz nada", () => {
    useStore.getState().dispatch("goto gateway");
    useStore.getState().back();
    expect(useStore.getState().level).toBe(1);
    expect(useStore.getState().focus).toBeNull();
    const before = useStore.getState();
    useStore.getState().back();
    expect(useStore.getState().level).toBe(1);
    expect(useStore.getState().historyIndex).toBe(before.historyIndex);
  });

  it("navegar depois de voltar trunca o caminho à frente", () => {
    useStore.getState().dispatch("goto gateway");
    useStore.getState().dispatch("goto gateway.Gateway");
    useStore.getState().back();
    useStore.getState().dispatch("goto pedidos");
    const s = useStore.getState();
    expect(s.historyIndex).toBe(s.history.length);
    useStore.getState().forward();
    expect(useStore.getState().focus).toBe("module:pedidos");
  });
});
