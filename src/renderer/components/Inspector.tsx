import { useStore } from "../store";

export function Inspector() {
  const selected = useStore((s) => s.selected);
  return (
    <section className="panel panel-inspector" aria-label="Inspector">
      <div className="panel-title">Inspector</div>
      <div className="panel-body">
        {selected ? (
          <p className="placeholder">Métricas de {selected} (marco M3)</p>
        ) : (
          <p className="placeholder">Selecione um nó para ver métricas e código</p>
        )}
      </div>
    </section>
  );
}
