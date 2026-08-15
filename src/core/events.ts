/**
 * Barramento de eventos tipado (specs/10-events-and-api.md).
 *
 * Todo evento é uma estrutura de dados simples e serializável. O núcleo emite
 * deltas (nunca estado completo), exceto `project:loaded`.
 */

import type { CodeGraph, HistoryEntry, LensId, ModelDelta, NavigationState } from "./model/types";

export type CoreEvent =
  | { type: "project:loaded"; graph: CodeGraph; snapshotRev: number }
  | { type: "model:changed"; delta: ModelDelta; snapshotRev: number }
  | { type: "navigation:changed"; state: NavigationState }
  | { type: "history:appended"; entry: HistoryEntry }
  | { type: "lens:changed"; lens: LensId }
  | { type: "parse:progress"; parsed: number; total: number };

export type BackendEvent =
  | { type: "files:changed"; paths: string[]; mtime: number }
  | { type: "ptty:data"; data: string }
  | { type: "ptty:exit"; code: number | null }
  | { type: "git:status"; dirty: string[] };


