import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { NAV_MARKER, initialTtyLine, navLineCommand, ttyStep, type TtyLineState } from "../../core";
import { useStore } from "../store";

const PROMPT = "blueline » ";

interface PtyOutputEvent {
  data: string;
}

/**
 * Terminal real (M4, specs/08-terminal.md).
 *
 * Duas superfícies no mesmo xterm.js: PTY do shell (backend Rust) + comandos
 * determinísticos do CodeAtlas (barramento de eventos). A classificação do
 * input é pura (`core/tty`) e testável sem terminal.
 */
export function Terminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineStateRef = useRef<TtyLineState>(initialTtyLine());
  const ptyIdRef = useRef<number | null>(null);
  const ptyCwdRef = useRef<string | null>(null);
  const unlistensRef = useRef<UnlistenFn[]>([]);

  const execCommand = useStore((s) => s.execCommand);
  const projectPath = useStore((s) => s.projectPath);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      convertEol: true,
      fontSize: 12,
      cursorBlink: true,
      theme: {
        background: "#0d0f13",
        foreground: "#c9d1d9",
        cursor: "#e6edf3",
      },
    });
    termRef.current = term;
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const ro = new ResizeObserver(() => {
      fit.fit();
      const cols = term.cols;
      const rows = term.rows;
      if (ptyIdRef.current != null) {
        invoke("ptty_resize", { id: ptyIdRef.current, cols, rows }).catch(() => {});
      }
    });
    ro.observe(container);

    const writeOut = (data: string) => term.write(data);

    if (!isTauri()) {
      // Browser (`pnpm dev`): sem backend, o terminal apenas ecoa o input.
      term.writeln("BlueLine — modo browser (sem PTY). Terminal real: pnpm tauri dev.");
      term.write(PROMPT);
    } else {
      // Listener único por janela; o PTY em si é (re)spawnado pelo efeito
      // `projectPath` abaixo, para o shell nascer no diretório do projeto aberto.
      listen<PtyOutputEvent>("codeatlas:pty-output", (e) => writeOut(e.payload.data)).then((u) =>
        unlistensRef.current.push(u),
      );
      listen("codeatlas:pty-exit", () => {
        term.writeln("\r\n[shell encerrado — aperte Enter para um novo prompt]");
      }).then((u) => unlistensRef.current.push(u));
    }

    const handleCommand = (input: string) => {
      if (input === "clear") {
        term.clear();
        term.write(PROMPT);
        return;
      }
      term.writeln(`\r\n\x1b[36m${PROMPT.trim()}\x1b[0m ${input}`);
      const result = execCommand(input);
      for (const line of result.lines) {
        term.writeln(line);
      }
      if (result.target) {
        const last = result.entries[result.entries.length - 1];
        const path = last?.humanPath ?? input;
        term.writeln(`\x1b[36m${NAV_MARKER}\x1b[0m ${input}  (${path})`);
      }
      term.write(PROMPT);
    };

    term.onData((data) => {
      const { state, actions } = ttyStep(lineStateRef.current, data);
      lineStateRef.current = state;
      for (const a of actions) {
        switch (a.kind) {
          case "pty":
            if (ptyIdRef.current != null) {
              invoke("ptty_write", { id: ptyIdRef.current, data: a.data }).catch(() => {});
            } else {
              demoShell(term, a.data);
            }
            break;
          case "ui":
            term.write(a.text);
            break;
          case "command":
            handleCommand(a.input);
            break;
          case "clear":
            term.clear();
            break;
        }
      }
    });

    // Histórico clicável (specs/08): clicar numa linha `› <comando>` re-executa.
    term.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const buffer = term.buffer.active;
        const line = buffer.getLine(bufferLineNumber);
        if (line) {
          const text = line.translateToString(true);
          if (navLineCommand(text) !== null) {
            const range = {
              start: { x: 0, y: bufferLineNumber },
              end: { x: line.length, y: bufferLineNumber },
            };
            callback([
              {
                range,
                text,
                activate: () => {
                  const command = navLineCommand(text);
                  if (command) handleCommand(command);
                },
              },
            ]);
            return;
          }
        }
        callback(undefined);
      },
    });

    return () => {
      ro.disconnect();
      for (const u of unlistensRef.current) u();
      unlistensRef.current = [];
      if (ptyIdRef.current != null) {
        invoke("ptty_kill", { id: ptyIdRef.current }).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
    };
  }, [execCommand]);

  // O shell nasce no diretório do projeto: ao abrir um repo (ou trocar), o PTY
  // antigo é encerrado e um novo sobe com cwd = raiz do projeto.
  useEffect(() => {
    if (!isTauri()) return;
    const term = termRef.current;
    if (!term) return;
    const target = projectPath ?? "/";
    if (ptyCwdRef.current === target) return;
    if (ptyIdRef.current != null) {
      invoke("ptty_kill", { id: ptyIdRef.current }).catch(() => {});
      ptyIdRef.current = null;
    }
    ptyCwdRef.current = target;
    term.writeln(`\r\n\x1b[36m● cwd: ${target}\x1b[0m\r\n`);
    invoke<number>("ptty_spawn", { cwd: target })
      .then((id) => {
        ptyIdRef.current = id;
      })
      .catch((err) => {
        term.writeln(`falha ao spawnar PTY: ${err}`);
      });
  }, [projectPath]);

  return (
    <section className="panel panel-terminal" aria-label="Terminal">
      <div className="panel-title">
        <span>Terminal</span>
        <span className="terminal-hint">shell + comandos: open · goto · up · ls · lens · clear · help</span>
      </div>
      <div className="panel-body xterm-wrap" ref={containerRef} />
    </section>
  );
}

/** Shell de demonstração (browser): ecoa o input e avisa que não há PTY. */
function demoShell(term: XTerm, data: string) {
  if (data === "\r") {
    term.write("\r\n[terminal real: PTY disponível em pnpm tauri dev]\r\n");
    term.write(PROMPT);
  } else {
    term.write(data);
  }
}
