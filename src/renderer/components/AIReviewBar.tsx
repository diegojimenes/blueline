import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useTranslation } from "../i18n";

export function AIReviewBar() {
  const graph = useStore((s) => s.graph);
  const gitDirty = useStore((s) => s.gitDirty);
  const agentAttention = useStore((s) => s.agentAttention);
  const enterNode = useStore((s) => s.enterNode);
  const { t, tp } = useTranslation();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scope, setScope] = useState<"scoped" | "project">("scoped");
  const focus = useStore((s) => s.focus);
  const level = useStore((s) => s.level);

  // Symbols affected by files in gitDirty
  const allDirtyNodes = useMemo(() => {
    if (!graph || gitDirty.length === 0) return [];
    return graph.nodes.filter(
      (n) => (n.kind === "class" || n.kind === "method") && "file" in n && gitDirty.includes(n.file),
    );
  }, [graph, gitDirty]);

  // Symbols affected within the current focus/scope
  const scopedDirtyNodes = useMemo(() => {
    if (!focus || allDirtyNodes.length === 0) return allDirtyNodes;
    return allDirtyNodes.filter((n) => {
      if (n.id === focus) return true;
      if (n.kind === "method" && n.owner === focus) return true;
      return false;
    });
  }, [allDirtyNodes, focus]);

  const hasScopeChoice = level >= 2 && focus !== null && scopedDirtyNodes.length > 0 && scopedDirtyNodes.length !== allDirtyNodes.length;
  const activeNodes = (scope === "scoped" && hasScopeChoice) ? scopedDirtyNodes : allDirtyNodes;

  if (gitDirty.length === 0 && !agentAttention) {
    return null;
  }

  const handleNext = () => {
    if (activeNodes.length === 0) return;
    const nextIdx = (currentIndex + 1) % activeNodes.length;
    setCurrentIndex(nextIdx);
    enterNode(activeNodes[nextIdx].id);
  };

  const handlePrev = () => {
    if (activeNodes.length === 0) return;
    const prevIdx = (currentIndex - 1 + activeNodes.length) % activeNodes.length;
    setCurrentIndex(prevIdx);
    enterNode(activeNodes[prevIdx].id);
  };

  const toggleScope = () => {
    setScope((prev) => (prev === "scoped" ? "project" : "scoped"));
    setCurrentIndex(0);
  };

  return (
    <div className="ai-review-bar" role="region" aria-label={t("ai_review_aria")}>
      <div className="ai-review-left">
        <span className="ai-review-badge">
          <span className="ai-pulse-dot" />
          {t("ai_review_badge")}
        </span>
        <span className="ai-review-summary">
          <strong>{gitDirty.length}</strong> {tp("ai_files_modified", gitDirty.length)}
          {allDirtyNodes.length > 0 && (
            <span className="ai-review-symbols-count">
              {" "}• <strong>{allDirtyNodes.length}</strong> {tp("ai_symbols_touched", allDirtyNodes.length)}
            </span>
          )}
        </span>
      </div>

      {agentAttention && (
        <div className="ai-review-attention">
          <span className="ai-attention-icon">🤖</span>
          <span className="ai-attention-msg">
            {agentAttention.message ?? `${agentAttention.agent} em ${agentAttention.file}`}
          </span>
        </div>
      )}

      {activeNodes.length > 0 && (
        <div className="ai-review-actions">
          {hasScopeChoice && (
            <button
              type="button"
              className={`btn btn-scope-toggle ${scope === "scoped" ? "active" : ""}`}
              onClick={toggleScope}
              title={scope === "scoped" ? t("ai_scope_local_title") : t("ai_scope_project_title")}
            >
              {scope === "scoped" ? t("ai_scope_local") : t("ai_scope_project")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ai-step"
            onClick={handlePrev}
            title={t("ai_prev_title")}
          >
            {t("ai_prev")}
          </button>
          <span
            className="ai-step-counter"
            title={scope === "scoped" && hasScopeChoice ? t("ai_scope_counter_title_local") : t("ai_scope_counter_title_project")}
          >
            {currentIndex + 1} / {activeNodes.length}
            {scope === "scoped" && hasScopeChoice && <span className="scope-tag"> {t("ai_scope_tag")}</span>}
          </span>
          <button
            type="button"
            className="btn btn-ai-step"
            onClick={handleNext}
            title={t("ai_next_title")}
          >
            {t("ai_next")}
          </button>
          <button
            type="button"
            className="btn btn-ai-expand-diff"
            onClick={() => useStore.getState().openCodeModal("diff")}
            title={t("ai_view_diff_title")}
          >
            {t("ai_view_diff")}
          </button>
        </div>
      )}
    </div>
  );
}
