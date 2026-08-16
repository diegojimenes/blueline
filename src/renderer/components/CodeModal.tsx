import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { canonicalPathOf, type SerializedNode } from "../../core";
import { useStore } from "../store";
import {
  highlightCodeLine,
  parseCleanDiff,
  type CleanDiffLine,
  type CodeToken,
} from "../utils/syntaxHighlighter";

export function CodeModal() {
  const open = useStore((s) => s.codeModalOpen);
  const initialTab = useStore((s) => s.codeModalInitialTab);
  const close = useStore((s) => s.closeCodeModal);
  const graph = useStore((s) => s.graph);
  const selected = useStore((s) => s.selected);
  const focus = useStore((s) => s.focus);
  const projectPath = useStore((s) => s.projectPath);
  const gitDirty = useStore((s) => s.gitDirty);

  const targetId = selected ?? focus;
  const node = targetId && graph ? graph.nodes.find((n) => n.id === targetId) : undefined;

  const file = node && "file" in node ? (node as Extract<SerializedNode, { file: string }>).file : null;
  const startLine = node && "startLine" in node ? (node as Extract<SerializedNode, { startLine: number }>).startLine : 1;

  const [tab, setTab] = useState<"code" | "diff" | "split">(initialTab ?? "diff");
  const [wordWrap, setWordWrap] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const codeScrollRef = useRef<HTMLDivElement | null>(null);
  const diffScrollRef = useRef<HTMLDivElement | null>(null);
  const focusedLineRef = useRef<HTMLDivElement | null>(null);

  // Sincroniza a aba inicial quando o modal abre
  useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  // Carrega código e git diff
  useEffect(() => {
    if (!open || !projectPath || !file) return;
    let cancelled = false;
    setSource(null);
    setDiffText(null);
    setError(false);

    invoke<string>("file_read", { projectPath, relPath: file })
      .then((content) => {
        if (!cancelled) setSource(content);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    invoke<string>("git_diff", { projectPath, relPath: file })
      .then((d) => {
        if (!cancelled) setDiffText(d);
      })
      .catch(() => {
        if (!cancelled) setDiffText("");
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectPath, file]);

  const parsedDiff = useMemo(() => {
    return parseCleanDiff(diffText ?? "");
  }, [diffText]);

  // Auto-scroll para a linha do símbolo quando o código carrega
  useEffect(() => {
    if (open && tab === "code" && source) {
      const timer = setTimeout(() => {
        focusedLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open, tab, source, startLine]);

  // Atalhos de teclado (Esc para fechar, 1/2/3 para trocar aba)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "1" && (e.altKey || e.metaKey)) {
        setTab("code");
      } else if (e.key === "2" && (e.altKey || e.metaKey)) {
        setTab("diff");
      } else if (e.key === "3" && (e.altKey || e.metaKey)) {
        setTab("split");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open || !node || !file) return null;

  const isDirty = gitDirty.includes(file);
  const hasDiff = parsedDiff.hunks.length > 0;
  const canonicalName = graph ? canonicalPathOf(graph, node.id) : node.name;

  const scrollToSymbol = () => {
    if (tab !== "code") {
      setTab("code");
    }
    setTimeout(() => {
      focusedLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="code-modal-backdrop" onClick={close} role="dialog" aria-modal="true">
      <div className="code-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header do Modal Expandido */}
        <header className="code-modal-header">
          <div className="code-modal-title-area">
            <div className="code-modal-identity">
              <span className={`symbol-badge badge-${node.kind}`}>
                {node.kind === "class" ? "🏛️ CLS" : node.kind === "method" ? "⚡ FN" : "📦 MOD"}
              </span>
              <h2 className="code-modal-name">{canonicalName}</h2>
              {isDirty && <span className="dirty-badge-pill">⚡ MODIFICADO</span>}
            </div>
            <div className="code-modal-meta">
              <span className="code-modal-filepath">{file}</span>
              <span className="code-modal-line">Linha {startLine}</span>
            </div>
          </div>

          {/* Abas de Visualização */}
          <div className="code-modal-tabs">
            <button
              type="button"
              className={`modal-tab-btn ${tab === "code" ? "active" : ""}`}
              onClick={() => setTab("code")}
            >
              📄 Código-Fonte Completo
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${tab === "diff" ? "active" : ""}`}
              onClick={() => setTab("diff")}
            >
              ⚡ Diff Unificado {hasDiff && <span className="tab-badge-dirty">●</span>}
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${tab === "split" ? "active" : ""}`}
              onClick={() => setTab("split")}
            >
              ☷ Split (Lado a Lado)
            </button>
          </div>

          {/* Ações e Fechar */}
          <div className="code-modal-actions">
            {hasDiff && (
              <div className="modal-diff-stats">
                <span className="add-count">+{parsedDiff.fileSummary.additions}</span>
                <span className="del-count">-{parsedDiff.fileSummary.deletions}</span>
              </div>
            )}
            <button
              type="button"
              className={`btn btn-wrap-toggle ${wordWrap ? "active" : ""}`}
              onClick={() => setWordWrap(!wordWrap)}
              title={wordWrap ? "Desativar quebra automática de linhas" : "Ativar quebra automática de linhas (Word-Wrap)"}
            >
              ↩ Wrap
            </button>
            <button
              type="button"
              className="btn btn-jump-symbol"
              onClick={scrollToSymbol}
              title={`Focar na linha ${startLine} do símbolo`}
            >
              🎯 Focar Símbolo (L{startLine})
            </button>
            <button
              type="button"
              className="btn btn-close-modal"
              onClick={close}
              aria-label="Fechar (Esc)"
              title="Fechar (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Corpo do Código / Diff */}
        <div className={`code-modal-body ${wordWrap ? "wrap-lines" : ""}`}>
          {error ? (
            <div className="code-modal-placeholder error">
              <span>⚠️ Não foi possível ler o arquivo no diretório do projeto.</span>
            </div>
          ) : tab === "code" ? (
            source === null ? (
              <div className="code-modal-placeholder">
                <span>Carregando código-fonte…</span>
              </div>
            ) : (
              <div className="modal-code-viewer" ref={codeScrollRef}>
                {source.split("\n").map((line, i) => {
                  const lineNum = i + 1;
                  const isHighlight = lineNum === startLine;
                  const tokens = highlightCodeLine(line);
                  return (
                    <div
                      key={i}
                      ref={isHighlight ? focusedLineRef : undefined}
                      className={`modal-code-row ${isHighlight ? "modal-line-focused" : ""}`}
                    >
                      <span className="modal-ln">{lineNum}</span>
                      <span className="modal-code-content">
                        <RenderTokens tokens={tokens} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          ) : tab === "diff" ? (
            !hasDiff ? (
              <div className="code-modal-placeholder clean">
                <span>✓ Nenhuma alteração pendente em relação ao HEAD do Git para este arquivo.</span>
              </div>
            ) : (
              <div className="modal-diff-viewer" ref={diffScrollRef}>
                {parsedDiff.hunks.map((hunk, hIdx) => (
                  <div key={hIdx} className="modal-diff-hunk">
                    <div className="modal-hunk-header">
                      <span className="hunk-badge">@@</span>
                      <span className="hunk-title">{hunk.header}</span>
                    </div>
                    <div className="modal-hunk-lines">
                      {hunk.lines.map((line, lIdx) => (
                        <ModalDiffLineRow key={lIdx} line={line} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Split View Side-by-Side */
            !hasDiff ? (
              <div className="code-modal-placeholder clean">
                <span>✓ Nenhuma alteração pendente em relação ao HEAD do Git para este arquivo.</span>
              </div>
            ) : (
              <div className="modal-split-viewer">
                {parsedDiff.hunks.map((hunk, hIdx) => (
                  <div key={hIdx} className="modal-split-hunk">
                    <div className="modal-hunk-header">
                      <span className="hunk-badge">@@</span>
                      <span className="hunk-title">{hunk.header}</span>
                    </div>
                    <div className="modal-split-table">
                      {hunk.lines.map((line, lIdx) => (
                        <div key={lIdx} className={`modal-split-row split-${line.type}`}>
                          <div className="modal-split-left">
                            <span className="modal-split-ln">{line.oldLineNumber ?? ""}</span>
                            <span className="modal-split-code">
                              {line.type === "del" ? (
                                <RenderWordChunks chunks={line.wordChunks} fallback={line.content} />
                              ) : line.type === "ctx" ? (
                                <RenderTokens tokens={highlightCodeLine(line.content)} />
                              ) : (
                                ""
                              )}
                            </span>
                          </div>
                          <div className="modal-split-right">
                            <span className="modal-split-ln">{line.newLineNumber ?? ""}</span>
                            <span className="modal-split-code">
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
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ModalDiffLineRow({ line }: { line: CleanDiffLine }) {
  const lineIndicator =
    line.type === "add"
      ? `+${line.newLineNumber}`
      : line.type === "del"
        ? `-${line.oldLineNumber}`
        : `${line.newLineNumber ?? ""}`;

  return (
    <div className={`modal-diff-row diff-${line.type}`}>
      <span className="modal-diff-ln">{lineIndicator}</span>
      <span className="modal-diff-code">
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
