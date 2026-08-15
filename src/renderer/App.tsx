import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Canvas } from "./components/Canvas";
import { Explorer } from "./components/Explorer";
import { Inspector } from "./components/Inspector";
import { StatusBar } from "./components/StatusBar";
import { Terminal } from "./components/Terminal";
import { useStore } from "./store";
import { setupWatcher } from "./watcher";

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const projectPath = useStore((s) => s.projectPath);
  const graph = useStore((s) => s.graph);
  const loadDemo = useStore((s) => s.loadDemo);
  const openProjectDialog = useStore((s) => s.openProjectDialog);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Sem projeto real (M3/M5) ainda, a demo entra automaticamente para exercitar o M2.
  useEffect(() => {
    if (!graph) loadDemo();
  }, [graph, loadDemo]);

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
        <span className="app-title">CodeAtlas</span>
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
    </div>
  );
}
