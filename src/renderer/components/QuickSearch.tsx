import React, { useEffect, useMemo, useRef, useState } from "react";
import { fuzzySearch, type SearchResult } from "../../core/search";
import { useStore } from "../store";
import { useTranslation } from "../i18n";

export interface QuickSearchProps {
  open: boolean;
  onClose: () => void;
}

export function QuickSearch({ open, onClose }: QuickSearchProps) {
  const graph = useStore((s) => s.graph);
  const enterNode = useStore((s) => s.enterNode);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { t } = useTranslation();

  const results = useMemo(() => {
    if (!open || !graph) return [];
    return fuzzySearch(graph, query, { limit: 30 });
  }, [open, graph, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Rola o item ativo para visualização
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    if (typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleSelect = (item: SearchResult) => {
    enterNode(item.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="quick-search-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("search_aria")}
    >
      <div className="quick-search-modal">
        <div className="quick-search-header">
          <span className="quick-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            className="quick-search-input"
            placeholder={t("search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t("search_input_aria")}
          />
          <kbd className="quick-search-kbd">ESC</kbd>
        </div>

        <div className="quick-search-body">
          {results.length === 0 ? (
            <div className="quick-search-empty">
              {query ? t("search_not_found", { query }) : t("search_no_nodes")}
            </div>
          ) : (
            <ul ref={listRef} className="quick-search-list" role="listbox">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`quick-search-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className={`symbol-badge badge-${item.kind}`}>{badgeLabel(item.kind)}</span>
                    <div className="symbol-info">
                      <div className="symbol-name">{item.name}</div>
                      <div className="symbol-path">{item.canonicalPath}</div>
                    </div>
                    {item.startLine && <span className="symbol-line">L{item.startLine}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function badgeLabel(kind: SearchResult["kind"]): string {
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
