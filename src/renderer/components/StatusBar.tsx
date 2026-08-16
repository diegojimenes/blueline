import { canonicalPathOf } from "../../core";
import { useStore } from "../store";

export function StatusBar() {
  const level = useStore((s) => s.level);
  const lens = useStore((s) => s.lens);
  const focus = useStore((s) => s.focus);
  const graph = useStore((s) => s.graph);
  const watcherState = useStore((s) => s.watcherState);
  const watcherTime = useStore((s) => s.watcherTime);
  const gitRepo = useStore((s) => s.gitRepo);
  const gitDirty = useStore((s) => s.gitDirty);
  const agentAttention = useStore((s) => s.agentAttention);
  const revision = graph?.revision ?? 0;

  const path = focus && graph ? canonicalPathOf(graph, focus) : "sistema";
  const watcherText =
    watcherState === "off" ? "watcher: —" : watcherState === "active" ? "watcher: ativo" : `watcher: atualizado ${watcherTime ?? ""}`;
  const gitText = !gitRepo ? "git: —" : gitDirty.length === 0 ? "git: limpo" : `git: ${gitDirty.length} alterado${gitDirty.length === 1 ? "" : "s"}`;

  return (
    <footer className="statusbar">
      <span className="status-segment">nível {level}</span>
      <span className="status-segment">lente {lens}</span>
      <span className="status-segment status-path">{path}</span>
      {agentAttention && (
        <span className="status-segment status-agent">
          🤖 {agentAttention.agent}: {agentAttention.symbol || agentAttention.file}
          {agentAttention.message ? ` (${agentAttention.message})` : ""}
        </span>
      )}
      <span className="status-segment">rev {revision}</span>
      <span className="status-segment">{gitText}</span>
      <span className="status-segment">{watcherText}</span>
    </footer>
  );
}
