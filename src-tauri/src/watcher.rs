use std::collections::HashSet;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::project::is_source_file;

/// Janela de debounce: rajadas (agentes escrevem em bursts) são agregadas
/// num único batch `files:changed` (specs/09-live-updates.md).
const DEBOUNCE: Duration = Duration::from_millis(150);
const POLL: Duration = Duration::from_millis(30);

/// Watcher com debounce que entrega lotes de caminhos relativos.
pub struct BatchWatcher {
    _watcher: RecommendedWatcher,
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl BatchWatcher {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

impl Drop for BatchWatcher {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

/// Sobe o watcher sobre `root`; `sink(batch, mtime)` é chamado a cada batch
/// quieto por >= DEBOUNCE. `mtime` é um timestamp de envio (ms desde a época).
pub fn start_batch_watcher<F>(root: &Path, sink: F) -> Result<BatchWatcher, String>
where
    F: Fn(Vec<String>, u64) + Send + 'static,
{
    let root = root.to_path_buf();
    let pending: Arc<Mutex<HashSet<String>>> = Arc::new(Mutex::new(HashSet::new()));
    let last: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));
    let stop = Arc::new(AtomicBool::new(false));

    let events = {
        let pending = Arc::clone(&pending);
        let last = Arc::clone(&last);
        let root_for_closure = root.clone();
        move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            if !is_relevant(&event.kind) {
                return;
            }
            let mut added = false;
            let mut lock = pending.lock().unwrap();
            for path in event.paths {
                if !is_source_file(&path) {
                    continue;
                }
                let Ok(rel) = path.strip_prefix(&root_for_closure) else { continue };
                if lock.insert(rel.to_string_lossy().replace('\\', "/")) {
                    added = true;
                }
            }
            if added {
                *last.lock().unwrap() = Some(Instant::now());
            }
        }
    };

    let mut watcher = RecommendedWatcher::new(events, Config::default()).map_err(|e| e.to_string())?;
    watcher.watch(&root, RecursiveMode::Recursive).map_err(|e| e.to_string())?;

    let thread = {
        let pending = Arc::clone(&pending);
        let last = Arc::clone(&last);
        let stop = Arc::clone(&stop);
        std::thread::spawn(move || loop {
            std::thread::sleep(POLL);
            if stop.load(Ordering::Relaxed) {
                break;
            }
            let ready = last
                .lock()
                .unwrap()
                .map(|t| t.elapsed() >= DEBOUNCE)
                .unwrap_or(false);
            if !ready {
                continue;
            }
            let batch: Vec<String> = {
                let mut lock = pending.lock().unwrap();
                if lock.is_empty() {
                    continue;
                }
                let mut items: Vec<String> = lock.drain().collect();
                items.sort();
                items
            };
            let mtime = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            sink(batch, mtime);
        })
    };

    Ok(BatchWatcher { _watcher: watcher, stop, thread: Some(thread) })
}

fn is_relevant(kind: &EventKind) -> bool {
    use notify::event::ModifyKind;
    matches!(
        kind,
        EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(ModifyKind::Data(_)) | EventKind::Modify(ModifyKind::Name(_))
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc;
    use std::time::Duration;

    fn wait_for<T: Clone>(rx: &mpsc::Receiver<T>, timeout: Duration) -> Option<T> {
        let deadline = Instant::now() + timeout;
        loop {
            match rx.try_recv() {
                Ok(v) => return Some(v),
                Err(_) if Instant::now() >= deadline => return None,
                Err(_) => std::thread::sleep(Duration::from_millis(25)),
            }
        }
    }

    #[test]
    fn emite_batch_com_debounce_apos_escrita() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("src");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("existe.ts"), "// x").unwrap();
        std::thread::sleep(Duration::from_millis(250)); // deixa o inicial assentar

        let (tx, rx) = mpsc::channel::<(Vec<String>, u64)>();
        let watcher = start_batch_watcher(dir.path(), move |paths, mtime| {
            let _ = tx.send((paths, mtime));
        })
        .expect("watcher sobe");

        fs::write(sub.join("novo.ts"), "export const a = 1;").unwrap();
        let batch = wait_for(&rx, Duration::from_secs(3)).expect("batch emitido");
        assert_eq!(batch.0, vec!["src/novo.ts".to_string()]);
        assert!(batch.1 > 0);

        watcher.stop();
    }

    #[test]
    fn ignora_arquivos_nao_fonte() {
        let dir = tempfile::tempdir().unwrap();
        std::thread::sleep(Duration::from_millis(250));

        let (tx, rx) = mpsc::channel::<(Vec<String>, u64)>();
        let watcher = start_batch_watcher(dir.path(), move |paths, mtime| {
            let _ = tx.send((paths, mtime));
        })
        .expect("watcher sobe");

        fs::write(dir.path().join("nota.txt"), "nada").unwrap();
        fs::write(dir.path().join(".gitignore"), "x").unwrap();
        assert_eq!(wait_for(&rx, Duration::from_millis(500)), None);

        watcher.stop();
    }
}
