mod git;
mod project;
mod ptys;
mod watcher;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use ptys::{PtyExit, PtyOutput, TtyRegistry};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
struct FilesChanged {
    paths: Vec<String>,
    mtime: u64,
}

#[derive(Serialize, Clone)]
struct ProjectFile {
    path: String,
    content: String,
}

struct AppState {
    ttys: TtyRegistry,
    watcher: Mutex<Option<watcher::BatchWatcher>>,
    git: Arc<dyn git::GitProvider>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            ttys: TtyRegistry::default(),
            watcher: Mutex::new(None),
            git: Arc::new(git::SystemGit),
        }
    }
}

/// Spawna `$SHELL` num PTY com cwd do projeto. Retorna o id do PTY.
#[tauri::command]
fn ptty_spawn(app: AppHandle, state: State<'_, AppState>, cwd: String) -> Result<u64, String> {
    let handle = ptys::spawn_pty(
        &cwd,
        portable_pty::PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 },
        {
            let app = app.clone();
            move |id, data| {
                let _ = app.emit("codeatlas:pty-output", PtyOutput { id, data: data.to_string() });
            }
        },
        {
            let app = app.clone();
            move |id, code| {
                let _ = app.emit("codeatlas:pty-exit", PtyExit { id, code });
            }
        },
    )?;
    let id = handle.id();
    state.ttys.insert(handle);
    Ok(id)
}

/// Escreve dados no master do PTY.
#[tauri::command]
fn ptty_write(state: State<'_, AppState>, id: u64, data: String) -> Result<(), String> {
    state.ttys.write(id, &data)
}

/// Redimensiona o PTY (cols x rows) para casar com o tamanho do xterm.
#[tauri::command]
fn ptty_resize(state: State<'_, AppState>, id: u64, cols: u16, rows: u16) -> Result<(), String> {
    state.ttys.resize(id, cols, rows)
}

/// Encerra o PTY e libera o recurso.
#[tauri::command]
fn ptty_kill(state: State<'_, AppState>, id: u64) -> Result<(), String> {
    state.ttys.kill(id)
}

/// Sobe o file watcher (debounce 150 ms) sobre um diretório do projeto.
#[tauri::command]
fn watch_start(app: AppHandle, state: State<'_, AppState>, project_path: String) -> Result<(), String> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(format!("diretório não encontrado: {project_path}"));
    }
    let mut guard = state.watcher.lock().unwrap();
    if guard.is_some() {
        return Err("watcher já ativo".into());
    }
    let sink = {
        let app = app.clone();
        move |paths: Vec<String>, mtime: u64| {
            let _ = app.emit("codeatlas:files-changed", FilesChanged { paths, mtime });
        }
    };
    let handle = watcher::start_batch_watcher(&root, sink)?;
    *guard = Some(handle);
    Ok(())
}

/// Para o file watcher.
#[tauri::command]
fn watch_stop(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(w) = state.watcher.lock().unwrap().take() {
        w.stop();
    }
    Ok(())
}

/// Arquivos com mudança real no repo (fonte de verdade: `git status --porcelain`).
/// Fora de repo git, não há diff — retorna vazio (watcher cobre via conteúdo).
#[tauri::command]
fn git_status(state: State<'_, AppState>, project_path: String) -> Result<Vec<String>, String> {
    let git = state.git.clone();
    let dir = Path::new(&project_path);
    if !git.is_repo(dir) {
        return Ok(Vec::new());
    }
    Ok(git.dirty_files(dir))
}

/// Lê o conteúdo atual de um arquivo relativo ao projeto (fase de re-parse).
#[tauri::command]
fn file_read(project_path: String, rel_path: String) -> Result<String, String> {
    let p = Path::new(&project_path).join(&rel_path);
    std::fs::read_to_string(&p).map_err(|e| format!("{rel_path}: {e}"))
}

/// Lista e lê todos os arquivos TS/JS do projeto (build inicial).
#[tauri::command]
fn read_project(project_path: String) -> Result<Vec<ProjectFile>, String> {
    let root = Path::new(&project_path);
    let rels = project::walk_source_files(root);
    let mut out = Vec::with_capacity(rels.len());
    for rel in rels {
        let content = std::fs::read_to_string(root.join(&rel)).map_err(|e| format!("{rel}: {e}"))?;
        out.push(ProjectFile { path: rel, content });
    }
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            ptty_spawn,
            ptty_write,
            ptty_resize,
            ptty_kill,
            watch_start,
            watch_stop,
            git_status,
            file_read,
            read_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
