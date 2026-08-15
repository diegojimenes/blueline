import type { ProjectConfig } from "../../core";

/**
 * Config da demo embutida (simula um `codeatlas.json`). Regenerável junto com a
 * demo quando o modelo de config mudar.
 */
export const demoConfig: ProjectConfig = {
  layerPaths: {
    api: ["gateway"],
    domain: ["pedidos"],
    infra: ["auth"],
  },
  domainPaths: {
    borda: "gateway",
    vendas: "pedidos",
    identidade: "auth",
  },
};
