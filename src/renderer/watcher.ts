import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "./store";

interface FilesChangedPayload {
  paths: string[];
  mtime: number;
}

/**
 * Barramento do watcher (M5, specs/09-live-updates.md).
 *
 * O backend (Rust/notify) emite `codeatlas:files-changed` com batch já
 * debounced; aqui só repassamos ao store, que decide re-parse incremental.
 */
export async function setupWatcher(): Promise<UnlistenFn> {
  return listen<FilesChangedPayload>("codeatlas:files-changed", (event) => {
    void useStore.getState().applyExternalChanges(event.payload.paths);
  });
}
