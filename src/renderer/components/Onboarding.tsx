import { useEffect, useState } from "react";
import { useStore } from "../store";
import { getRecentProjects } from "../session";
import logoSrc from "../../../docs/images/logo.png";

export function Onboarding() {
  const loadDemo = useStore((s) => s.loadDemo);
  const openProjectDialog = useStore((s) => s.openProjectDialog);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecentProjects());
  }, []);

  return (
    <div className="onboarding-layout">
      <div className="onboarding-sidebar">
        <div className="onboarding-brand">
          <img src={logoSrc} alt="BlueLine" className="logo-image" style={{ width: 24, height: 24, borderRadius: 6, marginRight: 8 }} />
          <span className="logo-text">BlueLine</span>
        </div>
        <nav className="onboarding-nav">
          <button type="button" className="nav-item active">Projects</button>
          <button type="button" className="nav-item">Learn</button>
        </nav>
      </div>
      
      <div className="onboarding-main">
        <h1 className="welcome-title">Welcome to BlueLine</h1>
        <p className="welcome-subtitle">A live architectural map for AI-generated code.</p>
        
        <div className="welcome-actions">
          <button type="button" className="action-card" onClick={() => void openProjectDialog()}>
            <div className="action-icon">📂</div>
            <div className="action-text">
              <h3>Open Repository</h3>
              <p>Analyze a local project directory</p>
            </div>
          </button>
          
          <button type="button" className="action-card" onClick={loadDemo}>
            <div className="action-icon">✨</div>
            <div className="action-text">
              <h3>Try Demo Repository</h3>
              <p>Explore BlueLine's features</p>
            </div>
          </button>
        </div>
        
        <div className="welcome-recent">
          <h2>Recent Projects</h2>
          {recent.length === 0 ? (
            <div className="recent-empty">
              <p>No recent projects found. Open a repository to get started.</p>
            </div>
          ) : (
            <div className="recent-list">
              {recent.map((path) => (
                <button
                  key={path}
                  type="button"
                  className="recent-item"
                  onClick={() => void useStore.getState().openProject(path)}
                  title={path}
                >
                  <span className="recent-icon" style={{ opacity: 0.5 }}>📦</span>
                  <span className="recent-path" style={{ textAlign: "left", flex: 1, direction: "rtl", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    &lrm;{path}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
