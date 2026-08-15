import { describe, expect, it } from "vitest";
import { dirname, resolveRelative, stripExtension } from "./path";

describe("path helpers (posix)", () => {
  it("dirname/basename/stripExtension", () => {
    expect(dirname("src/pedidos/Pedido.ts")).toBe("src/pedidos");
    expect(dirname("Pedido.ts")).toBe("");
    expect(stripExtension("Pedido.ts")).toBe("Pedido");
    expect(stripExtension("Pedido.service.ts")).toBe("Pedido.service");
  });

  it("resolveRelative resolve ../ e ./", () => {
    expect(resolveRelative("src/gateway/Gateway.ts", "../auth/AuthService")).toBe("src/auth/AuthService");
    expect(resolveRelative("src/helpers/format.ts", "../utils")).toBe("src/utils");
    expect(resolveRelative("src/a/b.ts", "../../x")).toBe("x");
    expect(resolveRelative("src/a.ts", "./b")).toBe("src/b");
  });
});
