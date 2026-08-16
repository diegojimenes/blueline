import { useStore } from "../store";

export function Onboarding() {
  const loadDemo = useStore((s) => s.loadDemo);
  const openProjectDialog = useStore((s) => s.openProjectDialog);

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <h1 className="onboarding-title">
          <span className="logo-icon">💠</span> BlueLine
        </h1>
        
        <p className="onboarding-subtitle">
          See what your AI coding agent is actually changing.
        </p>

        <div className="onboarding-aha-moment">
          <div className="aha-step">
            <span className="aha-icon">🤖</span>
            <span>Agent makes changes</span>
          </div>
          <div className="aha-arrow">→</div>
          <div className="aha-step">
            <span className="aha-icon">⚡</span>
            <span>BlueLine maps architecture</span>
          </div>
          <div className="aha-arrow">→</div>
          <div className="aha-step highlight">
            <span className="aha-icon">🎯</span>
            <span>You understand the impact</span>
          </div>
        </div>

        <div className="onboarding-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void openProjectDialog()}
          >
            📂 Open Repository
          </button>
          
          <button
            type="button"
            className="btn-secondary"
            onClick={loadDemo}
          >
            ✨ Try Demo Repository
          </button>
        </div>
      </div>
    </div>
  );
}
