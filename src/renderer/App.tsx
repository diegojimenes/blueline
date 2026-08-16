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

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const projectPath = useStore((s) => s.projectPath);
  const openProjectDialog = useStore((s) => s.openProjectDialog);
  const restoreSession = useStore((s) => s.restoreSession);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Atalho global para busca de símbolos (M7: Ctrl+P / ⌘P / Ctrl+K)
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

  // Restaurar sessão salva (M6): tema/lente + reabre o último projeto.
  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Persistência imediata no fechamento da janela (M6).
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

  // Barramento do watcher (M5): um único listener por janela.
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
            Abrir
          </button>
        )}
        <button
          type="button"
          className="btn-open"
          onClick={() => setSearchOpen(true)}
          title="Buscar símbolos (Ctrl+P / ⌘P)"
          aria-label="Buscar símbolos"
        >
          🔍 Buscar
        </button>
        <span className="app-title">BlueLine</span>
        {projectPath && <span className="app-project">{projectPath}</span>}
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Alternar tema">
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
