mod ptys;

use std::sync::{Arc, Mutex};

use ptys::{PtyExit, PtyOutput, TtyRegistry};
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
struct AppState {
    ttys: TtyRegistry,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            ptty_spawn,
            ptty_write,
            ptty_resize,
            ptty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
