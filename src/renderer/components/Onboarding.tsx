import { useStore } from "../store";

export function Onboarding() {
  const loadDemo = useStore((s) => s.loadDemo);
  const openProjectDialog = useStore((s) => s.openProjectDialog);

  return (
    <div className="onboarding-layout">
      <div className="onboarding-sidebar">
        <div className="onboarding-brand">
          <span className="logo-icon">💠</span>
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
          <div className="recent-empty">
            <p>No recent projects found. Open a repository to get started.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
