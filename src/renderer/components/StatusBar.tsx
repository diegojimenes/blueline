import { canonicalPathOf } from "../../core";
import { useStore } from "../store";

export function StatusBar() {
  const level = useStore((s) => s.level);
  const lens = useStore((s) => s.lens);
  const focus = useStore((s) => s.focus);
  const graph = useStore((s) => s.graph);
  const revision = graph?.revision ?? 0;

  const path = focus && graph ? canonicalPathOf(graph, focus) : "sistema";

  return (
    <footer className="statusbar">
      <span className="status-segment">nível {level}</span>
      <span className="status-segment">lente {lens}</span>
      <span className="status-segment status-path">{path}</span>
      <span className="status-segment">rev {revision}</span>
      <span className="status-segment">watcher: —</span>
    </footer>
  );
}
