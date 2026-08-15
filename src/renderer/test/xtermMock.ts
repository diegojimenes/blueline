/**
 * Mock mínimo de @xterm/xterm e @xterm/addon-fit para testes em jsdom.
 * Guarda a última instância criada para os testes dirigirem `onData` e
 * verificarem `write`/`writeln`.
 */
import { vi } from "vitest";

export const instances: MockTerminal[] = [];

export function lastTerminal(): MockTerminal | undefined {
  return instances[instances.length - 1];
}

export class MockTerminal {
  write = vi.fn();
  writeln = vi.fn();
  clear = vi.fn();
  reset = vi.fn();
  dispose = vi.fn();
  cols = 80;
  rows = 24;
  options: Record<string, unknown> = {};
  provider: unknown = null;
  buffer = {
    active: {
      getLine: () => null,
    },
  };
  private onDataCb: ((data: string) => void) | null = null;

  constructor() {
    instances.push(this);
  }

  loadAddon(): void {}
  open(): void {}
  registerLinkProvider(provider: unknown): void {
    this.provider = provider;
  }
  onData(cb: (data: string) => void): void {
    this.onDataCb = cb;
  }
  fireData(data: string): void {
    this.onDataCb?.(data);
  }
}

export class MockFitAddon {
  fit = vi.fn();
  proposeDimensions(): { cols: number; rows: number } {
    return { cols: 80, rows: 24 };
  }
}

vi.mock("@xterm/xterm", () => ({ Terminal: MockTerminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: MockFitAddon }));
