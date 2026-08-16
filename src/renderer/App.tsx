import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Canvas } from "./components/Canvas";
import { CodeModal } from "./components/CodeModal";
import { Explorer } from "./components/Explorer";
import { Inspector } from "./components/Inspector";
import { QuickSearch } from "./components/QuickSearch";
import { StatusBar } from "./components/StatusBar";
import { Terminal } from "./components/Terminal";
import { flushSession, useStore } from "./store";
import { setupWatcher } from "./watcher";
import { useTranslation } from "./i18n";

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const projectPath = useStore((s) => s.projectPath);
  const openProjectDialog = useStore((s) => s.openProjectDialog);
  const restoreSession = useStore((s) => s.restoreSession);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Global shortcut for symbol search (M7: Ctrl+P / ⌘P / Ctrl+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P" || e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Restore saved session (M6): theme/lens + reopen last project.
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Immediate persistence on window close (M6).
  useEffect(() => {
    const onUnload = () => {
      flushSession();
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  // Watcher bus (M5): single listener per window.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    setupWatcher().then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        {isTauri() && (
          <button type="button" className="btn-open" onClick={() => void openProjectDialog()}>
            {t("btn_open")}
          </button>
        )}
        <button
          type="button"
          className="btn-open"
          onClick={() => setSearchOpen(true)}
          title={t("btn_search_title")}
          aria-label={t("btn_search_aria")}
        >
          🔍 {t("btn_search")}
        </button>
        <span className="app-title">BlueLine</span>
        {projectPath && <span className="app-project">{projectPath}</span>}
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={t("btn_toggle_theme_aria")}>
          {theme === "dark" ? "☀" : "◐"}
        </button>
      </header>
      <Explorer />
      <Canvas />
      <Inspector />
      <Terminal />
      <StatusBar />
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CodeModal />
    </div>
  );
}
