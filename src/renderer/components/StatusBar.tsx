import { useStore } from "../store";

export function StatusBar() {
  const level = useStore((s) => s.level);
  const lens = useStore((s) => s.lens);
  const focus = useStore((s) => s.focus);
  return (
    <footer className="statusbar">
      <span className="status-segment">nível {level}</span>
      <span className="status-segment">lente {lens}</span>
      <span className="status-segment status-path">{focus ?? "—"}</span>
      <span className="status-segment">watcher: —</span>
    </footer>
  );
}
