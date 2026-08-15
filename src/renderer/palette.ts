/**
 * Paleta da lente ativa (specs/06-lenses.md): mapeia a chave de cor
 * determinística do core para uma cor de tela. Nunca altera posições.
 */

const LAYER_COLORS: Record<string, string> = {
  api: "#e06c75",
  domain: "#98c379",
  application: "#61afef",
  infra: "#c678dd",
  core: "#848b98",
  sistema: "#528bff",
};

const COUP_COLORS: Record<string, string> = {
  "0": "#848b98",
  "1": "#61afef",
  "2": "#d19a66",
  "3": "#e06c75",
};

const PALETTE = [
  "#61afef",
  "#98c379",
  "#e06c75",
  "#c678dd",
  "#d19a66",
  "#56b6c2",
  "#e5c07b",
];

export function lensColor(key: string): string {
  if (key.startsWith("layer:")) return LAYER_COLORS[key.slice(6)] ?? "#848b98";
  if (key.startsWith("coup:")) return COUP_COLORS[key.slice(5)] ?? "#848b98";
  if (key.startsWith("domain:")) return hashColor(key.slice(7));
  return "#848b98";
}

export function lensLabel(key: string): string {
  if (key.startsWith("layer:")) return key.slice(6);
  if (key.startsWith("coup:")) return `acoplamento ${key.slice(5)}`;
  if (key.startsWith("domain:")) return key.slice(7);
  return key;
}

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
