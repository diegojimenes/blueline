/**
 * Paleta da lente ativa (specs/06-lenses.md): mapeia a chave de cor
 * determinística do core para uma cor de tela. Nunca altera posições.
 */

const LAYER_COLORS: Record<string, string> = {
  api: "#ec4899",
  domain: "#10b981",
  application: "#6366f1",
  infra: "#8b5cf6",
  core: "#06b6d4",
  editor: "#f59e0b",
  ui: "#3b82f6",
  behaviors: "#14b8a6",
  lib: "#a855f7",
  hooks: "#eab308",
  sistema: "#6366f1",
};

const COUP_COLORS: Record<string, string> = {
  "0": "#64748b",
  "1": "#06b6d4",
  "2": "#f59e0b",
  "3": "#ef4444",
};

const PALETTE = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export function lensColor(key: string): string {
  if (key.startsWith("layer:")) {
    const name = key.slice(6).toLowerCase();
    return LAYER_COLORS[name] ?? hashColor(name);
  }
  if (key.startsWith("coup:")) {
    const val = key.slice(5);
    return COUP_COLORS[val] ?? (parseInt(val, 10) > 3 ? "#ef4444" : "#64748b");
  }
  if (key.startsWith("domain:")) return hashColor(key.slice(7));
  return "#64748b";
}

export function lensLabel(key: string): string {
  if (key.startsWith("layer:")) return key.slice(6);
  if (key.startsWith("coup:")) return `acoplamento ${key.slice(5)}`;
  if (key.startsWith("domain:")) return key.slice(7);
  return key;
}

export function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
