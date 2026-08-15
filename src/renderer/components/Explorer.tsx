import { useStore } from "../store";

export function Explorer() {
  const projectOpen = useStore((s) => s.projectOpen);
  return (
    <section className="panel panel-explorer" aria-label="Explorer">
      <div className="panel-title">Explorer</div>
      <div className="panel-body">
        {projectOpen ? (
          <p className="placeholder">Árvore do grafo (marco M3)</p>
        ) : (
          <p className="placeholder">Nenhum projeto aberto</p>
        )}
      </div>
    </section>
  );
}
