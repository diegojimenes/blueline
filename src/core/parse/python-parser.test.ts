import { describe, expect, it } from "vitest";
import { CompositeParser } from "./composite-parser";
import { PythonParser } from "./python-parser";

describe("core · multi-language parser pipeline (M11)", () => {
  const pythonParser = new PythonParser();

  const PYTHON_CODE = `
import os
from math import sqrt, sin as s
from services.auth import AuthService

class PaymentGateway:
    def process_payment(self, amount):
        def validate():
            self.check_fraud(amount)
        validate()
        return True

    def check_fraud(self, amount):
        pass

def main():
    gateway = PaymentGateway()
    gateway.process_payment(100)
`;

  it("PythonParser identifica extensões .py e .pyi", () => {
    expect(pythonParser.supports("main.py")).toBe(true);
    expect(pythonParser.supports("types.pyi")).toBe(true);
    expect(pythonParser.supports("app.ts")).toBe(false);
  });

  it("PythonParser extrai classes, métodos, locais, imports e chamadas", () => {
    const symbols = pythonParser.parseFile("src/payment.py", PYTHON_CODE);

    expect(symbols.classes.length).toBe(1);
    expect(symbols.classes[0].name).toBe("PaymentGateway");
    expect(symbols.classes[0].methods.map((m) => m.name)).toEqual(["process_payment", "check_fraud"]);

    expect(symbols.methods.map((m) => m.name)).toEqual(["main"]);

    expect(symbols.locals.length).toBe(1);
    expect(symbols.locals[0].name).toBe("validate");
    expect(symbols.locals[0].owner).toBe("process_payment");

    expect(symbols.imports.length).toBe(3);
    const mathImport = symbols.imports.find((i) => i.from === "math");
    expect(mathImport?.symbols).toEqual(["sqrt", "sin"]);
    expect(mathImport?.items).toEqual([
      { name: "sqrt" },
      { name: "sin", alias: "s" },
    ]);

    expect(symbols.calls.some((c) => c.target === "check_fraud" && c.receiver === "self")).toBe(true);
    expect(symbols.calls.some((c) => c.target === "validate")).toBe(true);
  });

  it("CompositeParser despacha para o parser correto baseado na extensão", () => {
    const composite = new CompositeParser([pythonParser]);
    expect(composite.supports("main.py")).toBe(true);
    expect(composite.supports("main.rs")).toBe(false);

    const symbols = composite.parseFile("main.py", "def test():\n    pass\n");
    expect(symbols.methods[0].name).toBe("test");
  });
});
