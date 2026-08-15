import { describe, expect, it } from "vitest";
import { walkProject } from "./walk";
import { fixturePath } from "./test-helpers";

describe("walkProject", () => {
  it("projeto vazio retorna lista vazia", () => {
    expect(walkProject(fixturePath("empty"))).toEqual([]);
  });

  it("basic lista os arquivos TS em ordem canônica", () => {
    expect(walkProject(fixturePath("basic"))).toEqual([
      "src/auth/AuthService.ts",
      "src/gateway/Gateway.ts",
      "src/pedidos/Pedido.ts",
      "src/pedidos/PedidoService.ts",
    ]);
  });

  it("ignora diretórios de dependências/build", () => {
    expect(walkProject(fixturePath("basic")).some((p) => p.includes("node_modules"))).toBe(false);
  });
});
