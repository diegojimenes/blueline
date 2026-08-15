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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
