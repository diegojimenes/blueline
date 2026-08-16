import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  canonicalPathOf,
  couplingOf,
  domainOf,
  layerOf,
  moduleOfPath,
  type SerializedGraph,
  type SerializedNode,
} from "../../core";
import { lensColor } from "../palette";
import { useStore } from "../store";
import {
  highlightCodeLine,
  parseCleanDiff,
  type CleanDiffLine,
  type CodeToken,
} from "../utils/syntaxHighlighter";

export function Inspector() {
  const graph = useStore((s) => s.graph);
  const focus = useStore((s) => s.focus);
  const selected = useStore((s) => s.selected);
  const level = useStore((s) => s.level);
  const config = useStore((s) => s.config);
  const gitDirty = useStore((s) => s.gitDirty);
  const diffSummary = useStore((s) => s.diffSummary);
  const reviewedNodes = useStore((s) => s.reviewedNodes);
  const reviewScope = useStore((s) => s.reviewScope);
  const toggleReviewed = useStore((s) => s.toggleReviewed);
  const setReviewScope = useStore((s) => s.setReviewScope);
  const gotoId = useStore((s) => s.gotoId);
  const enterNode = useStore((s) => s.enterNode);

  const targetId = selected ?? focus;
  const node = targetId && graph ? graph.nodes.find((n) => n.id === targetId) : undefined;

  // Se estiver no nível de sistema ou nenhum nó selecionado, exibe o Dashboard Arquitetural
  if (!graph || !node || node.kind === "project") {
    return (
      <section className="panel panel-inspector" aria-label="Inspector">
        <div className="panel-title">
          <span>🏛️ Arquitetura & Sistema</span>
          <span className="badge badge-level">nível 1</span>
        </div>
        <div className="panel-body inspector-body">
          {graph ? (
            <SystemDashboard
              graph={graph}
              gitDirty={gitDirty}
              diffSummary={diffSummary}
              reviewedNodes={reviewedNodes}
              onSelectNode={enterNode}
            />
          ) : (
            <p className="placeholder">Abra um projeto para inspecionar métricas e arquitetura</p>
          )}
        </div>
      </section>
    );
  }

  const diffInfo = diffSummary?.symbols.get(node.id);
  const isDirty =
    Boolean(diffInfo) ||
    (node.kind === "module"
      ? gitDirty.some((f) => moduleOfPath(f, config) === node.path)
      : "file" in node && gitDirty.includes(node.file));

  const isReviewed = reviewedNodes.has(node.id);
  const isSecondary = "isSecondary" in node && Boolean(node.isSecondary);

  const coupling = couplingOf(graph, node);
  const layer = layerOf(node, config);
  const domain = domainOf(node, config);

  return (
    <section className="panel panel-inspector" aria-label="Inspector">
      <div className="panel-title">
        <div className="inspector-title-left">
          <span className={`symbol-badge badge-${node.kind}`}>{kindLabel(node.kind)}</span>
          <span className="inspector-kind-title">{node.name}</span>
          {isSecondary && (
            <span className="badge badge-secondary-class" title="Classe secundária declarada no mesmo arquivo">
              interna
            </span>
          )}
        </div>
        <span className="badge badge-level">nível {level}</span>
      </div>

      <div className="panel-body inspector-body">
        {/* Banner de Revisão / Modificação por IA / Git */}
        {isReviewed ? (
          <div className="ai-reviewed-banner">
            <div className="ai-reviewed-header">
              <span className="ai-reviewed-badge">✓ REVISADO NESTA SESSÃO</span>
              <button
                type="button"
                className="btn-review-toggle reviewed"
                onClick={() => toggleReviewed(node.id)}
              >
                Desmarcar
              </button>
            </div>
            <span className="ai-reviewed-desc">
              Este símbolo foi validado pelo desenvolvedor.
            </span>
          </div>
        ) : isDirty ? (
          <div className={`ai-dirty-banner ${diffInfo?.magnitude ? `mag-${diffInfo.magnitude}` : ""}`}>
            <div className="ai-dirty-header">
              <div className="ai-dirty-tags">
                <span className="ai-dirty-badge">⚡ MODIFICADO</span>
                {diffInfo && (
                  <span className={`badge-magnitude mag-${diffInfo.magnitude}`}>
                    {diffInfo.magnitude === "heavy"
                      ? "Crítico (>20L)"
                      : diffInfo.magnitude === "medium"
                        ? "Médio (6-20L)"
                        : "Leve (≤5L)"}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn-review-toggle"
                onClick={() => toggleReviewed(node.id)}
              >
                ✓ Marcar como Revisado
              </button>
            </div>
            <div className="ai-dirty-desc-row">
              <span className="ai-dirty-desc">
                {diffInfo
                  ? `+${diffInfo.additions} -${diffInfo.deletions} (${diffInfo.totalLinesChanged} linhas alteradas via AST)`
                  : "Arquivo com alterações em relação ao repositório base"}
              </span>
              <div className="review-scope-switch">
                <button
                  type="button"
                  className={`btn-scope ${reviewScope === "local" ? "active" : ""}`}
                  onClick={() => setReviewScope("local")}
                  title="Foco de revisão no nó local"
                >
                  Local
                </button>
                <button
                  type="button"
                  className={`btn-scope ${reviewScope === "project" ? "active" : ""}`}
                  onClick={() => setReviewScope("project")}
                  title="Visão de revisão do projeto todo"
                >
                  Projeto
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Card de Identidade do Símbolo */}
        <div className="symbol-identity-card">
          <div className="symbol-identity-header">
            <span className="symbol-canonical">{canonicalPathOf(graph, node.id)}</span>
          </div>

          <div className="symbol-meta-grid">
            <div className="meta-pill">
              <span className="meta-label">CAMADA</span>
              <span className="meta-value" style={{ color: lensColor(`layer:${layer}`) }}>
                {layer}
              </span>
            </div>
            <div className="meta-pill">
              <span className="meta-label">DOMÍNIO</span>
              <span className="meta-value" style={{ color: lensColor(`domain:${domain}`) }}>
                {domain}
              </span>
            </div>
            {("startLine" in node) && (
              <div className="meta-pill">
                <span className="meta-label">LINHA</span>
                <span className="meta-value mono">:L{node.startLine}{node.endLine ? `-L${node.endLine}` : ""}</span>
              </div>
            )}
            {node.kind === "module" && (
              <div className="meta-pill">
                <span className="meta-label">CLASSES</span>
                <span className="meta-value mono">{classesOf(graph, node).length}</span>
              </div>
            )}
          </div>

          {/* Medidor Visual de Acoplamento */}
          <div className="coupling-meter-container">
            <div className="coupling-meter-header">
              <span>Acoplamento Estrutural</span>
              <strong style={{ color: couplingColor(coupling) }}>{coupling} dependência{coupling === 1 ? "" : "s"}</strong>
            </div>
            <div className="coupling-progress-bar">
              <div
                className="coupling-progress-fill"
                style={{
                  width: `${Math.min(100, (coupling / 8) * 100)}%`,
                  backgroundColor: couplingColor(coupling),
                }}
              />
            </div>
          </div>
        </div>

        {/* Alerta de Impacto em Chamadores */}
        {(node.kind === "method" || node.kind === "local") && (
          <ImpactAlert node={node} graph={graph} isDirty={isDirty} />
        )}

        {/* Lista Visual de Chamadores e Chamadas */}
        {(node.kind === "method" || node.kind === "local") && (
          <CallCards node={node} graph={graph} onGoto={gotoId} />
        )}

        {/* Visualizador de Código-Fonte e Diff Formatado */}
        {isCodeNode(node) && <CodeAndDiffView file={node.file} startLine={node.startLine} />}
      </div>
    </section>
  );
}

function SystemDashboard({
  graph,
  gitDirty,
  diffSummary,
  reviewedNodes,
  onSelectNode,
}: {
  graph: SerializedGraph;
  gitDirty: string[];
  diffSummary?: import("../../core").ProjectDiffSummary | null;
  reviewedNodes?: Set<string>;
  onSelectNode: (id: string) => void;
}) {
  const config = useStore.getState().config;
  const modules = graph.nodes.filter((n) => n.kind === "module");
  const classes = graph.nodes.filter((n) => n.kind === "class");
  const methods = graph.nodes.filter((n) => n.kind === "method");

  // Classes / Símbolos estruturais afetados
  const dirtyClasses = useMemo(() => {
    return graph.nodes.filter(
      (n): n is Extract<typeof n, { kind: "class" }> =>
        n.kind === "class" && (gitDirty.includes(n.file) || Boolean(diffSummary?.symbols.has(n.id))),
    );
  }, [graph, gitDirty, diffSummary]);

  // Agrupamento de impacto por camada
  const layerImpact = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of dirtyClasses) {
      const layer = layerOf(c, config);
      counts[layer] = (counts[layer] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [dirtyClasses, config]);

  const reviewedCount = dirtyClasses.filter((c) => reviewedNodes?.has(c.id)).length;
  const reviewProgressPct =
    dirtyClasses.length > 0 ? Math.round((reviewedCount / dirtyClasses.length) * 100) : 100;

  return (
    <div className="system-dashboard">
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📦</span>
          <div className="stat-info">
            <span className="stat-value">{modules.length}</span>
            <span className="stat-label">Módulos</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏛️</span>
          <div className="stat-info">
            <span className="stat-value">{classes.length}</span>
            <span className="stat-label">Classes</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚡</span>
          <div className="stat-info">
            <span className="stat-value">{methods.length}</span>
            <span className="stat-label">Métodos</span>
          </div>
        </div>
      </div>

      {/* Barra de Progresso da Revisão de Código */}
      {dirtyClasses.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3>📋 Progresso de Revisão</h3>
            <span className="badge badge-emerald">
              {reviewedCount} de {dirtyClasses.length} validados ({reviewProgressPct}%)
            </span>
          </div>
          <div className="review-progress-track">
            <div
              className="review-progress-fill"
              style={{ width: `${reviewProgressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Mapa de Impacto por Camadas */}
      {layerImpact.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3>🌐 Impacto por Camada</h3>
            <span className="badge badge-amber">{layerImpact.length} camadas tocadas</span>
          </div>
          <div className="layer-impact-grid">
            {layerImpact.map(([layerName, count]) => (
              <div key={layerName} className="layer-impact-card">
                <span
                  className="layer-impact-dot"
                  style={{ backgroundColor: lensColor(`layer:${layerName}`) }}
                />
                <span className="layer-impact-name">{layerName}</span>
                <span className="layer-impact-count">{count} {count === 1 ? "classe" : "classes"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classes Estruturais Afetadas */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <h3>🏛️ Símbolos com Alterações</h3>
          <span className="badge badge-amber">{dirtyClasses.length} nós</span>
        </div>

        {dirtyClasses.length === 0 ? (
          <p className="placeholder-subtle">
            {gitDirty.length > 0
              ? `${gitDirty.length} arquivos não-estruturais modificados.`
              : "Nenhum nó de código modificado no momento."}
          </p>
        ) : (
          <div className="dirty-files-list">
            {dirtyClasses.map((cls) => {
              const layer = layerOf(cls, config);
              const isRev = reviewedNodes?.has(cls.id);
              const symDiff = diffSummary?.symbols.get(cls.id);
              const methodsCount = graph.nodes.filter(
                (m) => m.kind === "method" && m.owner === cls.id,
              ).length;
              return (
                <div
                  key={cls.id}
                  className={`dirty-file-item ${isRev ? "is-reviewed" : ""}`}
                  onClick={() => onSelectNode(cls.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="dirty-file-icon">{isRev ? "✓" : "🏛️"}</span>
                  <div className="dirty-file-info">
                    <span className="dirty-file-name">
                      {cls.name}
                      {cls.isSecondary && <span className="tag-secondary-mini">interna</span>}
                    </span>
                    <span className="dirty-file-path">
                      {cls.file.split("/").pop()} • {methodsCount} métodos
                      {symDiff && ` • +${symDiff.additions} -${symDiff.deletions}`}
                    </span>
                  </div>
                  <div className="dirty-badges-right">
                    {symDiff && (
                      <span className={`badge-magnitude mag-${symDiff.magnitude}`}>
                        {symDiff.magnitude}
                      </span>
                    )}
                    <span
                      className="dirty-layer-badge"
                      style={{
                        color: lensColor(`layer:${layer}`),
                        borderColor: lensColor(`layer:${layer}`),
                      }}
                    >
                      {layer}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Módulos do Sistema */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <h3>📦 Módulos do Projeto</h3>
        </div>
        <div className="modules-chips-grid">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              className="module-chip"
              onClick={() => onSelectNode(m.id)}
            >
              📦 {m.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImpactAlert({
  node,
  graph,
  isDirty,
}: {
  node: Extract<SerializedNode, { kind: "method" | "local" }>;
  graph: SerializedGraph;
  isDirty: boolean;
}) {
  const incoming = graph.edges.filter((e) => e.type === "call" && e.to === node.id);
  if (!isDirty && incoming.length === 0) return null;

  return (
    <div className={`impact-alert-box ${isDirty && incoming.length > 0 ? "impact-critical" : ""}`}>
      <span className="impact-icon">{isDirty && incoming.length > 0 ? "⚠️" : "ℹ️"}</span>
      <div className="impact-text">
        <strong>Radar de Impacto:</strong>{" "}
        {incoming.length > 0
          ? `${incoming.length} símbolo${incoming.length === 1 ? "" : "s"} depende${incoming.length === 1 ? "m" : "m"} diretamente desta função.`
          : "Nenhum chamador interno direto detectado."}
      </div>
    </div>
  );
}

function CallCards({
  node,
  graph,
  onGoto,
}: {
  node: Extract<SerializedNode, { kind: "method" | "local" }>;
  graph: SerializedGraph;
  onGoto: (id: string) => void;
}) {
  const out = graph.edges.filter((e) => e.type === "call" && e.from === node.id);
  const incoming = graph.edges.filter((e) => e.type === "call" && e.to === node.id);
  if (out.length === 0 && incoming.length === 0) return null;

  return (
    <div className="inspector-calls-container">
      {out.length > 0 && (
        <div className="calls-group">
          <div className="calls-group-title">
            <span>↓ Chama ({out.length})</span>
          </div>
          <div className="call-cards-list">
            {out.map((e) => (
              <button
                key={e.id}
                type="button"
                className="call-card-item out"
                onClick={() => onGoto(e.to)}
              >
                <span className="call-dir-arrow">→</span>
                <span className="call-card-name">{canonicalPathOf(graph, e.to)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="calls-group">
          <div className="calls-group-title">
            <span>↑ Chamado por ({incoming.length})</span>
          </div>
          <div className="call-cards-list">
            {incoming.map((e) => (
              <button
                key={e.id}
                type="button"
                className="call-card-item in"
                onClick={() => onGoto(e.from)}
              >
                <span className="call-dir-arrow">←</span>
                <span className="call-card-name">{canonicalPathOf(graph, e.from)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeAndDiffView({ file, startLine }: { file: string; startLine: number }) {
  const projectPath = useStore((s) => s.projectPath);
  const openCodeModal = useStore((s) => s.openCodeModal);
  const [tab, setTab] = useState<"code" | "diff" | "split">("diff");
  const [wordWrap, setWordWrap] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const focusedLineRef = useRef<HTMLDivElement | null>(null);
  const focusedDiffRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setDiffText(null);
    setError(false);
    if (!projectPath) return;

    invoke<string>("file_read", { projectPath, relPath: file })
      .then((content) => {
        if (!cancelled) setSource(content);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    invoke<string>("git_diff", { projectPath, relPath: file })
      .then((d) => {
        if (!cancelled) {
          setDiffText(d);
          if (d && d.trim().length > 0) {
            setTab("diff");
          } else {
            setTab("code");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiffText("");
          setTab("code");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath, file]);

  const parsedDiff = useMemo(() => {
    return parseCleanDiff(diffText ?? "");
  }, [diffText]);

  // Auto-scroll para a linha do símbolo selecionado
  useEffect(() => {
    if (tab === "code" && source) {
      const timer = setTimeout(() => {
        focusedLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [tab, source, startLine]);

  // Auto-scroll no diff quando relevante
  useEffect(() => {
    if (tab === "diff" && parsedDiff.hunks.length > 0) {
      const timer = setTimeout(() => {
        focusedDiffRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [tab, parsedDiff, startLine]);

  if (!projectPath || error) {
    return <p className="placeholder code-missing">Código-fonte não disponível no diretório</p>;
  }

  const hasDiff = parsedDiff.hunks.length > 0;

  return (
    <div className="inspector-code-section">
      {/* Abas Superiores */}
      <div className="inspector-tabs-header">
        <div className="tabs-left">
          <button
            type="button"
            className={`inspector-tab ${tab === "code" ? "active" : ""}`}
            onClick={() => setTab("code")}
          >
            📄 Código
          </button>
          <button
            type="button"
            className={`inspector-tab ${tab === "diff" ? "active" : ""}`}
            onClick={() => setTab("diff")}
          >
            ⚡ Diff {hasDiff && <span className="tab-badge-dirty">●</span>}
          </button>
          {hasDiff && (
            <button
              type="button"
              className={`inspector-tab ${tab === "split" ? "active" : ""}`}
              onClick={() => setTab("split")}
            >
              ☷ Split
            </button>
          )}
        </div>

        <div className="tabs-right-actions">
          {hasDiff && (
            <div className="diff-stats-pill">
              <span className="add-count">+{parsedDiff.fileSummary.additions}</span>
              <span className="del-count">-{parsedDiff.fileSummary.deletions}</span>
            </div>
          )}
          <button
            type="button"
            className={`btn-wrap-toggle ${wordWrap ? "active" : ""}`}
            onClick={() => setWordWrap(!wordWrap)}
            title={wordWrap ? "Desativar quebra automática de linhas" : "Ativar quebra automática de linhas (Word-Wrap)"}
            aria-label="Quebrar linhas"
          >
            ↩ Wrap
          </button>
          <button
            type="button"
            className="btn-expand-code"
            onClick={() => openCodeModal(tab)}
            title="Expandir código e diff em tela cheia (fora da lateral)"
            aria-label="Expandir código e diff"
          >
            ⤢ Expandir
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba */}
      <div className={`code-viewer-wrapper ${wordWrap ? "wrap-lines" : ""}`}>
        {tab === "code" ? (
          source === null ? (
            <p className="placeholder">Carregando código…</p>
          ) : (
            <div className="code-block-container">
              {source.split("\n").map((line, i) => {
                const isHighlight = i === startLine - 1;
                const tokens = highlightCodeLine(line);
                return (
                  <div
                    key={i}
                    ref={isHighlight ? focusedLineRef : undefined}
                    className={`code-line-row ${isHighlight ? "line-focused" : ""}`}
                  >
                    <span className="line-number">{i + 1}</span>
                    <span className="line-code">
                      <RenderTokens tokens={tokens} />
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "diff" ? (
          !hasDiff ? (
            <div className="diff-clean-placeholder">
              <span>✓ Sem alterações pendentes em relação ao HEAD</span>
            </div>
          ) : (
            <div className="diff-hunks-container">
              {parsedDiff.hunks.map((hunk, hIdx) => {
                // Verifica se este hunk contém ou está próximo da linha inicial do símbolo
                const isClosestHunk = hIdx === 0;
                return (
                  <div
                    key={hIdx}
                    ref={isClosestHunk ? focusedDiffRef : undefined}
                    className="diff-hunk-block"
                  >
                    <div className="diff-hunk-header">
                      <span className="hunk-badge">@@</span>
                      <span className="hunk-title">{hunk.header}</span>
                    </div>
                    <div className="diff-hunk-lines">
                      {hunk.lines.map((line, lIdx) => (
                        <DiffLineRow key={lIdx} line={line} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Split View */
          <div className="diff-split-container">
            {parsedDiff.hunks.map((hunk, hIdx) => (
              <div key={hIdx} className="diff-split-hunk">
                <div className="diff-hunk-header">
                  <span className="hunk-badge">@@</span>
                  <span className="hunk-title">{hunk.header}</span>
                </div>
                <div className="split-grid">
                  {hunk.lines.map((line, lIdx) => (
                    <div key={lIdx} className={`split-row split-${line.type}`}>
                      <div className="split-col-old">
                        <span className="split-ln">{line.oldLineNumber ?? ""}</span>
                        <span className="split-txt">
                          {line.type === "del" ? (
                            <RenderWordChunks chunks={line.wordChunks} fallback={line.content} />
                          ) : line.type === "ctx" ? (
                            <RenderTokens tokens={highlightCodeLine(line.content)} />
                          ) : (
                            ""
                          )}
                        </span>
                      </div>
                      <div className="split-col-new">
                        <span className="split-ln">{line.newLineNumber ?? ""}</span>
                        <span className="split-txt">
                          {line.type === "add" ? (
                            <RenderWordChunks chunks={line.wordChunks} fallback={line.content} />
                          ) : line.type === "ctx" ? (
                            <RenderTokens tokens={highlightCodeLine(line.content)} />
                          ) : (
                            ""
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffLineRow({ line }: { line: CleanDiffLine }) {
  const lineNum = line.type === "add" ? `+${line.newLineNumber}` : line.type === "del" ? `-${line.oldLineNumber}` : `${line.newLineNumber ?? ""}`;
  return (
    <div className={`diff-line-row diff-${line.type}`}>
      <span className="diff-ln-indicator">{lineNum}</span>
      <span className="diff-line-text">
        {line.wordChunks ? (
          <RenderWordChunks chunks={line.wordChunks} fallback={line.content} />
        ) : (
          <RenderTokens tokens={highlightCodeLine(line.content)} />
        )}
      </span>
    </div>
  );
}

function RenderTokens({ tokens }: { tokens: CodeToken[] }) {
  return (
    <>
      {tokens.map((t, idx) => (
        <span key={idx} className={`tok tok-${t.type}`}>
          {t.text}
        </span>
      ))}
    </>
  );
}

function RenderWordChunks({
  chunks,
  fallback,
}: {
  chunks?: { type: "same" | "add" | "del"; text: string }[];
  fallback: string;
}) {
  if (!chunks || chunks.length === 0) {
    return <RenderTokens tokens={highlightCodeLine(fallback)} />;
  }

  return (
    <>
      {chunks.map((c, idx) => (
        <span key={idx} className={`word-diff word-${c.type}`}>
          {c.text}
        </span>
      ))}
    </>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "module":
      return "MOD";
    case "class":
      return "CLS";
    case "method":
      return "FN";
    case "local":
      return "LOC";
    default:
      return "SYM";
  }
}

function couplingColor(coupling: number): string {
  if (coupling <= 1) return "#10b981"; // Emerald
  if (coupling <= 3) return "#06b6d4"; // Cyan
  if (coupling <= 5) return "#f59e0b"; // Amber
  return "#ef4444"; // Red
}

function classesOf(
  graph: SerializedGraph,
  node: Extract<SerializedNode, { kind: "module" }>,
): SerializedNode[] {
  return graph.nodes.filter(
    (n) => n.kind === "class" && moduleOfPath(n.file, useStore.getState().config) === node.path,
  );
}

function isCodeNode(node: SerializedNode): node is Extract<SerializedNode, { kind: "class" | "method" | "local" }> {
  return node.kind === "class" || node.kind === "method" || node.kind === "local";
}
