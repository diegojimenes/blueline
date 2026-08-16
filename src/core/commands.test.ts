import { beforeEach, describe, expect, it } from "vitest";
import type { NavigationState } from "./model/types";
import type { SerializedGraph } from "./serialize";
import { loadSerialized } from "./test-helpers";
import {
  cmdGoto,
  cmdHelp,
  cmdLens,
  cmdLs,
  cmdUp,
  gotoNode,
  parseCommand,
  resolveTarget,
  runCommand,
} from "./commands";
import { PROJECT_ID, visibleNodes } from "./navigation";

describe("parseCommand", () => {
  it("separa verbo e argumento, normalizando o verbo", () => {
    expect(parseCommand("  GOTO  gateway.Gateway  ")).toEqual({ name: "goto", arg: "gateway.Gateway" });
    expect(parseCommand("up")).toEqual({ name: "up", arg: "" });
    expect(parseCommand("lens coupling")).toEqual({ name: "lens", arg: "coupling" });
  });
});

describe("resolveTarget (fixture basic)", () => {
  let graph: SerializedGraph;
  beforeEach(async () => {
    graph = await loadSerialized("basic");
  });

  it("resolve por id exato", () => {
    const r = resolveTarget(graph, "class:src/auth/AuthService.ts:AuthService");
    expect("node" in r && r.node.name).toBe("AuthService");
  });

  it("resolve caminho pontilhado modulo.Classe.metodo", () => {
    const r = resolveTarget(graph, "gateway.Gateway.start");
    expect("node" in r && r.node.kind).toBe("method");
  });

  it("resolve módulo.Classe", () => {
    const r = resolveTarget(graph, "auth.AuthService");
    expect("node" in r && r.node.kind).toBe("class");
  });

  it("resolve classe por nome único", () => {
    const r = resolveTarget(graph, "AuthService");
    expect("node" in r && r.node.kind).toBe("class");
  });

  it("resolve por caminho de arquivo", () => {
    const r = resolveTarget(graph, "src/auth/AuthService.ts");
    expect("node" in r && r.node.name).toBe("AuthService");
  });

  it("reporta erro para alvo inexistente", () => {
    const r = resolveTarget(graph, "naoExiste");
    expect("error" in r).toBe(true);
  });

  it("reporta erro quando módulo não existe no caminho pontilhado", () => {
    const r = resolveTarget(graph, "naoexiste.Classe");
    expect("error" in r).toBe(true);
  });
});

describe("cmdGoto — navegação 1→4 (specs/12-milestones.md, M2)", () => {
  let graph: SerializedGraph;
  let nav: NavigationState;
  const NOW = 1000;

  beforeEach(async () => {
    graph = await loadSerialized("basic");
    nav = { focus: null, level: 1, lens: "layers", trail: [], selected: null, visited: new Set() };
  });

  it("goto gateway: entra no módulo (nível 2) e gera histórico", () => {
    const r = cmdGoto(graph, nav, "gateway", { now: NOW });
    expect(r.nav.level).toBe(2);
    expect(r.nav.focus).toBe("module:gateway");
    expect(r.nav.trail).toEqual([PROJECT_ID, "module:gateway"]);
    expect(r.nav.visited.has("module:gateway")).toBe(true);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toEqual({
      timestamp: NOW,
      command: "goto gateway",
      humanPath: "gateway",
      target: "module:gateway",
    });
  });

  it("goto gateway.Gateway: entra na classe (nível 3)", () => {
    const r = cmdGoto(graph, nav, "gateway.Gateway", { now: NOW });
    expect(r.nav.level).toBe(3);
    expect(r.nav.trail).toEqual([PROJECT_ID, "module:gateway", "class:src/gateway/Gateway.ts:Gateway"]);
  });

  it("goto gateway.Gateway.start: entra no método (nível 4)", () => {
    const r = cmdGoto(graph, nav, "gateway.Gateway.start", { now: NOW });
    expect(r.nav.level).toBe(4);
    expect(r.nav.focus).toContain("method");
  });

  it("up desce de nível até o sistema; nível 1 não sobe", () => {
    let r = cmdGoto(graph, nav, "gateway.Gateway.start", { now: NOW });
    expect(r.nav.level).toBe(4);

    r = cmdUp(graph, r.nav, { now: NOW });
    expect(r.nav.level).toBe(3);
    expect(r.nav.focus).toBe("class:src/gateway/Gateway.ts:Gateway");

    r = cmdUp(graph, r.nav, { now: NOW });
    expect(r.nav.level).toBe(2);
    expect(r.nav.focus).toBe("module:gateway");

    r = cmdUp(graph, r.nav, { now: NOW });
    expect(r.nav.level).toBe(1);
    expect(r.nav.focus).toBeNull();

    const stayed = cmdUp(graph, r.nav, { now: NOW });
    expect(stayed.nav).toBe(r.nav);
    expect(stayed.lines[0]).toContain("nível 1");
  });

  it("duplo clique (gotoNode) e goto produzem o MESMO histórico e estado", () => {
    const viaComando = cmdGoto(graph, nav, "pedidos.PedidoService", { now: NOW });
    const viaCanvas = gotoNode(graph, nav, "class:src/pedidos/PedidoService.ts:PedidoService", { now: NOW });
    expect(viaCanvas.entries).toEqual(viaComando.entries);
    expect(viaCanvas.nav).toEqual(viaComando.nav);
  });

  it("goto com alvo inexistente não muda navegação nem gera histórico", () => {
    const r = cmdGoto(graph, nav, "naoExiste", { now: NOW });
    expect(r.nav).toEqual(nav);
    expect(r.entries).toHaveLength(0);
  });

  it("runCommand despacha goto/up/ls/lens/help e desconhecido", () => {
    expect(runCommand(graph, nav, "lens domain", { now: NOW }).nav.lens).toBe("domain");
    expect(runCommand(graph, nav, "help", { now: NOW }).lines.length).toBeGreaterThan(2);
    expect(runCommand(graph, nav, "bogus", { now: NOW }).lines[0]).toContain("unknown");
    expect(cmdLens(nav, "nope").lines[0]).toContain("inválida");
    expect(cmdHelp(nav).lines.length).toBeGreaterThan(0);
  });
});

describe("cmdLs (fixture basic)", () => {
  let graph: SerializedGraph;
  beforeEach(async () => {
    graph = await loadSerialized("basic");
  });

  function navFor(level: number, focus: string | null): NavigationState {
    return { focus, level: level as 1 | 2 | 3 | 4, lens: "layers", trail: [], selected: null, visited: new Set() };
  }

  it("nível 1 lista módulos com contagem de classes", () => {
    const r = cmdLs(graph, navFor(1, null), {});
    expect(r.lines.join("\n")).toContain("auth");
    expect(r.lines.join("\n")).toContain("1 classe");
    expect(r.lines.join("\n")).toContain("pedidos");
  });

  it("nível 2 lista classes do módulo com arquivo", () => {
    const r = cmdLs(graph, navFor(2, "module:pedidos"), {});
    expect(r.lines.join("\n")).toContain("PedidoService");
    expect(r.lines.join("\n")).toContain("src/pedidos/PedidoService.ts");
    expect(r.lines.join("\n")).toContain("Pedido");
  });

  it("nível 3 lista métodos da classe com linha", () => {
    const r = cmdLs(graph, navFor(3, "class:src/gateway/Gateway.ts:Gateway"), {});
    expect(r.lines.join("\n")).toContain("start");
    expect(r.lines.join("\n")).toContain(":5");
  });

  it("nível 4 lista chamadas de/para o método em foco", () => {
    const r = cmdLs(graph, navFor(4, "method:src/gateway/Gateway.ts:class:src/gateway/Gateway.ts:Gateway:start"), {});
    expect(r.lines.join("\n")).toContain("chama:");
    expect(r.lines.join("\n")).toContain("auth.AuthService.login");
  });
});

describe("nível 5 — funções locais (fixture nested)", () => {
  let graph: SerializedGraph;
  beforeEach(async () => {
    graph = await loadSerialized("nested");
  });

  function navFor(level: number, focus: string | null): NavigationState {
    return { focus, level: level as 1 | 2 | 3 | 4 | 5, lens: "layers", trail: [], selected: null, visited: new Set() };
  }

  const PROCESS = "method:src/lib/Calc.ts:class:src/lib/Calc.ts:Calc:process";
  const DOUBLE = "local:src/lib/Calc.ts:method:src/lib/Calc.ts:class:src/lib/Calc.ts:Calc:process:double";

  it("cria nós 'local' filiados ao método (aresta member)", () => {
    const process = graph.nodes.find((n) => n.id === PROCESS);
    expect(process?.kind).toBe("method");
    const locals = graph.nodes.filter((n) => n.kind === "local" && n.owner === PROCESS);
    expect(locals.map((l) => l.name).sort()).toEqual(["double", "sum"]);
    const member = graph.edges.find((e) => e.type === "member" && e.from === PROCESS && e.to === DOUBLE);
    expect(member).toBeDefined();
  });

  it("goto para uma local entra no nível 5; up volta para o método (nível 4)", () => {
    const down = gotoNode(graph, navFor(4, PROCESS), DOUBLE, {});
    expect(down.nav.level).toBe(5);
    expect(down.nav.focus).toBe(DOUBLE);
    expect(down.nav.trail[down.nav.trail.length - 1]).toBe(DOUBLE);
    const up = cmdUp(graph, down.nav, {});
    expect(up.nav.level).toBe(4);
    expect(up.nav.focus).toBe(PROCESS);
  });

  it("local em foco (folha) continua visível no canvas — não cai em estado vazio", () => {
    const visible = visibleNodes(graph, { level: 5, focus: DOUBLE }, {});
    expect(visible.map((n) => n.id)).toEqual([DOUBLE]);
  });

  it("cmdLs nível 5 lista as funções locais", () => {
    const r = cmdLs(graph, navFor(5, PROCESS), {});
    const text = r.lines.join("\n");
    expect(text).toContain("double");
    expect(text).toContain("sum");
    expect(text).toContain("(local)");
  });
});


describe("novos comandos (impact, deps, dependents, trace, changed)", () => {
  let graph: SerializedGraph;
  let nav: NavigationState;

  beforeEach(async () => {
    graph = await loadSerialized("basic");
    nav = { focus: null, level: 1, lens: "layers", trail: [], selected: null, visited: new Set() };
  });

  it("query impact", () => {
    const result = runCommand(graph, nav, "impact gateway.Gateway", { config: {} });
    expect(result.lines.join("\n")).toContain("impact:");
    expect(result.lines.join("\n")).toContain("gateway.Gateway");
    expect(result.target).toBe("class:src/gateway/Gateway.ts:Gateway");
  });

  it("query deps", () => {
    const result = runCommand(graph, nav, "deps auth.AuthService", { config: {} });
    expect(result.lines.join("\n")).toContain("deps:");
  });

  it("query dependents", () => {
    const result = runCommand(graph, nav, "dependents auth.AuthService", { config: {} });
    expect(result.lines.join("\n")).toContain("dependents:");
  });

  it("query trace", () => {
    const result = runCommand(graph, nav, "trace gateway.Gateway", { config: {} });
    expect(result.lines.join("\n")).toContain("trace:");
  });

  it("query changed", () => {
    const result = runCommand(graph, nav, "changed", { gitDirty: ["src/gateway/Gateway.ts"], config: {} });
    expect(result.lines.join("\n")).toContain("changed:");
    expect(result.lines.join("\n")).toContain("Gateway");
  });
});
