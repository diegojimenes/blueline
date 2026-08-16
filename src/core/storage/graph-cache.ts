import type { SerializedGraph } from "../serialize";

export interface GraphCacheStorage {
  get(projectPath: string): Promise<SerializedGraph | null>;
  set(projectPath: string, graph: SerializedGraph): Promise<void>;
  delete(projectPath: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Cache persistente em memória e fallback de storage assíncrono para grafos grandes (M12).
 * Evita reprecisar re-parsear dezenas de milhares de arquivos no boot.
 */
export class MemoryGraphCache implements GraphCacheStorage {
  private cache = new Map<string, SerializedGraph>();

  async get(projectPath: string): Promise<SerializedGraph | null> {
    return this.cache.get(projectPath) ?? null;
  }

  async set(projectPath: string, graph: SerializedGraph): Promise<void> {
    this.cache.set(projectPath, graph);
  }

  async delete(projectPath: string): Promise<void> {
    this.cache.delete(projectPath);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}
