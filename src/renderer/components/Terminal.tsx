import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

export function Terminal() {
  const log = useStore((s) => s.log);
  const dispatch = useStore((s) => s.dispatch);
  const gotoId = useStore((s) => s.gotoId);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    dispatch(value);
    setInput("");
  };

  return (
    <section className="panel panel-terminal" aria-label="Terminal">
      <div className="panel-title">
        <span>Terminal</span>
        <span className="terminal-hint">goto · up · ls · lens · help · clear</span>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {log.length === 0 ? (
          <p className="terminal-placeholder">
            $ Terminal real chega no M4 (PTY). Por ora, comandos determinísticos: duplo clique no grafo ou digite
            abaixo — ex.: <code>goto gateway.Gateway</code>
          </p>
        ) : (
          <ul className="terminal-log">
            {log.map((line) =>
              line.target ? (
                <li key={line.id}>
                  <button type="button" className="log-line log-line-clickable" onClick={() => gotoId(line.target!)}>
                    {line.text}
                  </button>
                </li>
              ) : (
                <li key={line.id}>
                  <span className="log-line">{line.text}</span>
                </li>
              ),
            )}
          </ul>
        )}
        <form className="terminal-input" onSubmit={onSubmit}>
          <span className="prompt">$</span>
          <input
            aria-label="Comando CodeAtlas"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="goto pedidos.PedidoService"
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>
    </section>
  );
}
