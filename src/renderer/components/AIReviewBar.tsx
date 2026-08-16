import { useMemo, useState } from "react";
import { useStore } from "../store";

export function AIReviewBar() {
  const graph = useStore((s) => s.graph);
  const gitDirty = useStore((s) => s.gitDirty);
  const agentAttention = useStore((s) => s.agentAttention);
  const enterNode = useStore((s) => s.enterNode);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scope, setScope] = useState<"scoped" | "project">("scoped");
  const focus = useStore((s) => s.focus);
  const level = useStore((s) => s.level);

  // Símbolos afetados por arquivos em gitDirty
  const allDirtyNodes = useMemo(() => {
    if (!graph || gitDirty.length === 0) return [];
    return graph.nodes.filter(
      (n) => (n.kind === "class" || n.kind === "method") && "file" in n && gitDirty.includes(n.file),
    );
  }, [graph, gitDirty]);

  // Símbolos afetados dentro do foco/escopo atual
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
    <div className="ai-review-bar" role="region" aria-label="Revisão de Alterações de IA">
      <div className="ai-review-left">
        <span className="ai-review-badge">
          <span className="ai-pulse-dot" />
          ⚡ Modo Revisão IA
        </span>
        <span className="ai-review-summary">
          <strong>{gitDirty.length}</strong> arquivo{gitDirty.length === 1 ? "" : "s"} modificado{gitDirty.length === 1 ? "" : "s"}
          {allDirtyNodes.length > 0 && (
            <span className="ai-review-symbols-count">
              {" "}• <strong>{allDirtyNodes.length}</strong> símbolo{allDirtyNodes.length === 1 ? "" : "s"} tocado{allDirtyNodes.length === 1 ? "" : "s"}
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
              title={scope === "scoped" ? "Alternar para navegar no projeto inteiro" : "Alternar para navegar apenas no escopo atual"}
            >
              {scope === "scoped" ? "🎯 Neste Escopo" : "🌐 No Projeto"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ai-step"
            onClick={handlePrev}
            title="Navegar para o símbolo modificado anterior"
          >
            ◀ Anterior
          </button>
          <span className="ai-step-counter" title={scope === "scoped" && hasScopeChoice ? "Posição no escopo atual" : "Posição no projeto"}>
            {currentIndex + 1} / {activeNodes.length}
            {scope === "scoped" && hasScopeChoice && <span className="scope-tag"> local</span>}
          </span>
          <button
            type="button"
            className="btn btn-ai-step"
            onClick={handleNext}
            title="Navegar para o próximo símbolo modificado"
          >
            Próximo ▶
          </button>
          <button
            type="button"
            className="btn btn-ai-expand-diff"
            onClick={() => useStore.getState().openCodeModal("diff")}
            title="Abrir visualizador expandido de Diff e Código (tela cheia)"
          >
            ⤢ Ver Diff
          </button>
        </div>
      )}
    </div>
  );
}
