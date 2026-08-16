import type { NodeId } from "./model/types";
import type { SerializedNode } from "./serialize";

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedNode {
  node: SerializedNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Índice espacial em grade 2D (Spatial Grid Hash) para culling
 * instantâneo O(1) de dezenas de milhares de nós no Canvas (M12).
 */
export class SpatialIndex {
  private cellSize: number;
  private grid: Map<string, PositionedNode[]> = new Map();

  constructor(cellSize: number = 250) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.grid.clear();
  }

  insert(node: PositionedNode): void {
    const minX = Math.floor(node.x / this.cellSize);
    const maxX = Math.floor((node.x + node.width) / this.cellSize);
    const minY = Math.floor(node.y / this.cellSize);
    const maxY = Math.floor((node.y + node.height) / this.cellSize);

    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const key = `${gx}:${gy}`;
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push(node);
      }
    }
  }

  insertAll(nodes: PositionedNode[]): void {
    this.clear();
    for (const node of nodes) {
      this.insert(node);
    }
  }

  query(viewport: ViewportRect): PositionedNode[] {
    const minX = Math.floor(viewport.x / this.cellSize);
    const maxX = Math.floor((viewport.x + viewport.width) / this.cellSize);
    const minY = Math.floor(viewport.y / this.cellSize);
    const maxY = Math.floor((viewport.y + viewport.height) / this.cellSize);

    const seen = new Set<NodeId>();
    const visible: PositionedNode[] = [];

    for (let gx = minX; gx <= maxX; gx++) {
      for (let gy = minY; gy <= maxY; gy++) {
        const cell = this.grid.get(`${gx}:${gy}`);
        if (!cell) continue;

        for (const item of cell) {
          if (seen.has(item.node.id)) continue;
          // Verifica interseção do retângulo
          if (
            item.x + item.width >= viewport.x &&
            item.x <= viewport.x + viewport.width &&
            item.y + item.height >= viewport.y &&
            item.y <= viewport.y + viewport.height
          ) {
            seen.add(item.node.id);
            visible.push(item);
          }
        }
      }
    }

    return visible;
  }
}
