import { useStore } from "../store";

export function Canvas() {
  const level = useStore((s) => s.level);
  const lens = useStore((s) => s.lens);
  return (
    <section className="panel panel-canvas" aria-label="Canvas">
      <div className="panel-title">
        <span>Grafo</span>
        <span className="badge">nível {level}</span>
      </div>
      <div className="panel-body">
        <p className="placeholder">
          Canvas do grafo — zoom semântico nível {level} · lente {lens} (marco M2)
        </p>
      </div>
    </section>
  );
}
