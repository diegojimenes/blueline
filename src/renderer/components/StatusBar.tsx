import { canonicalPathOf } from "../../core";
import { useStore } from "../store";
import { useTranslation } from "../i18n";

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
  const { t, tp } = useTranslation();

  const path = focus && graph ? canonicalPathOf(graph, focus) : "system";
  const watcherText =
    watcherState === "off"
      ? t("status_watcher_off")
      : watcherState === "active"
        ? t("status_watcher_active")
        : t("status_watcher_updated", { time: watcherTime ?? "" });
  const gitText = !gitRepo
    ? t("status_git_none")
    : gitDirty.length === 0
      ? t("status_git_clean")
      : tp("status_git_dirty", gitDirty.length);

  return (
    <footer className="statusbar">
      <span className="status-segment">{t("status_level", { level })}</span>
      <span className="status-segment">{t("status_view", { lens })}</span>
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
