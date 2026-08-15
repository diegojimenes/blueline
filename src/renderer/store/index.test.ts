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
    expect(s.log.some((l) => l.text.includes("desconhecido"))).toBe(true);
    expect(s.history).toHaveLength(0);
  });
});
