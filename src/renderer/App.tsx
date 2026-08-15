import { useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { Explorer } from "./components/Explorer";
import { Inspector } from "./components/Inspector";
import { StatusBar } from "./components/StatusBar";
import { Terminal } from "./components/Terminal";
import { useStore } from "./store";

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const projectPath = useStore((s) => s.projectPath);
  const graph = useStore((s) => s.graph);
  const loadDemo = useStore((s) => s.loadDemo);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Sem projeto real (M3/M5) ainda, a demo entra automaticamente para exercitar o M2.
  useEffect(() => {
    if (!graph) loadDemo();
  }, [graph, loadDemo]);

  return (
    <div className="app">
      <header className="app-header">
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
