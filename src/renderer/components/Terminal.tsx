import { useStore } from "../store";

export function Terminal() {
  const history = useStore((s) => s.history);
  return (
    <section className="panel panel-terminal" aria-label="Terminal">
      <div className="panel-title">Terminal</div>
      <div className="terminal-body">
        {history.length === 0 ? (
          <p className="terminal-placeholder">
            $ Terminal real será conectado ao PTY no marco M4. Navegue com: ls · goto · up · lens
          </p>
        ) : (
          <ul className="terminal-history">
            {history.map((entry) => (
              <li key={entry.timestamp}>$ {entry.command}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
