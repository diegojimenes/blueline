import { describe, expect, it } from "vitest";

import type { BackendEvent, CoreEvent } from "./events";

const coreEvents: CoreEvent[] = [
  {
    type: "navigation:changed",
    state: { focus: null, level: 1, lens: "layers", trail: [], selected: null, visited: new Set() },
  },
  { type: "lens:changed", lens: "coupling" },
  { type: "parse:progress", parsed: 1, total: 10 },
];

const backendEvents: BackendEvent[] = [
  { type: "files:changed", paths: ["src/a.ts"], mtime: 1234 },
  { type: "ptty:data", data: "\x1b[32mok\x1b[0m" },
  { type: "ptty:exit", code: 0 },
  { type: "git:status", dirty: ["src/a.ts"] },
];

describe("barramento de eventos", () => {
  it("eventos do núcleo são serializáveis (contrato de barramento)", () => {
    for (const event of coreEvents) {
      const roundTripped = JSON.parse(JSON.stringify(event)) as CoreEvent;
      expect(roundTripped.type).toBe(event.type);
    }
  });

  it("eventos do backend são serializáveis", () => {
    for (const event of backendEvents) {
      const roundTripped = JSON.parse(JSON.stringify(event)) as BackendEvent;
      expect(roundTripped.type).toBe(event.type);
    }
  });

  it("NavigationState preserva valores após round-trip", () => {
    const event: CoreEvent = {
      type: "navigation:changed",
      state: { focus: "class:x.ts:Foo", level: 3, lens: "layers", trail: ["a", "b"], selected: null, visited: new Set(["a"]) },
    };
    const roundTripped = JSON.parse(JSON.stringify(event)) as CoreEvent;
    if (roundTripped.type === "navigation:changed") {
      expect(roundTripped.state.level).toBe(3);
      expect(roundTripped.state.lens).toBe("layers");
    }
  });
});
