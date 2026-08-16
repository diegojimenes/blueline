//! PTY hospedado no backend (D2, specs/08-terminal.md).
//!
//! `portable-pty` cria um par master/slave; o slave roda `$SHELL` com cwd do
//! projeto e o master é lido numa thread que emite eventos `codeatlas:pty-output`
//! para o webview. Sem sidecar Node (regra de ouro 2).

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;

/// Evento de saída do PTY (uma fatia de bytes, possivelmente parcial em UTF-8).
#[derive(Clone, Serialize)]
pub struct PtyOutput {
    pub id: u64,
    pub data: String,
}

/// Evento de encerramento do PTY (EOF ou erro de leitura).
#[derive(Clone, Serialize)]
pub struct PtyExit {
    pub id: u64,
    pub code: i32,
}

struct Tty {
    id: u64,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    read_thread: std::thread::JoinHandle<()>,
}

impl Drop for Tty {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

#[derive(Default)]
pub struct TtyRegistry {
    inner: Mutex<HashMap<u64, TtyHandle>>,
}

impl TtyRegistry {
    pub fn insert(&self, handle: TtyHandle) {
        self.inner.lock().unwrap().insert(handle.id(), handle);
    }

    pub fn write(&self, id: u64, data: &str) -> Result<(), String> {
        self.inner
            .lock()
            .unwrap()
            .get_mut(&id)
            .ok_or_else(|| format!("pty {id} não encontrado"))?
            .write(data)
    }

    pub fn resize(&self, id: u64, cols: u16, rows: u16) -> Result<(), String> {
        self.inner
            .lock()
            .unwrap()
            .get_mut(&id)
            .ok_or_else(|| format!("pty {id} não encontrado"))?
            .resize(cols, rows)
    }

    /// Remove o PTY do registro; o `Drop` mata o processo filho.
    pub fn kill(&self, id: u64) -> Result<(), String> {
        self.inner
            .lock()
            .unwrap()
            .remove(&id)
            .map(|_| ())
            .ok_or_else(|| format!("pty {id} não encontrado"))
    }
}

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

/// Spawna um shell interativo dentro de um PTY. `on_output` recebe o id e as
/// fatias de saída decodificadas (UTF-8 incremental); `on_exit` o id e o código.
pub fn spawn_pty(
    cwd: &str,
    size: PtySize,
    on_output: impl Fn(u64, &str) + Send + 'static,
    on_exit: impl FnOnce(u64, i32) + Send + 'static,
) -> Result<TtyHandle, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("abrir pty: {e}"))?;

    let master = pair.master;
    let mut cmd = CommandBuilder::new(default_shell());
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn {e}"))?;
    drop(pair.slave);

    let mut reader = master
        .try_clone_reader()
        .map_err(|e| format!("clonar reader: {e}"))?;
    let writer = master
        .take_writer()
        .map_err(|e| format!("take writer: {e}"))?;

    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let read_thread = std::thread::spawn(move || {
        let mut carry: Vec<u8> = Vec::new();
        let mut buf = [0u8; 8192];
        let exit_code = -1;
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    carry.extend_from_slice(&buf[..n]);
                    match std::str::from_utf8(&carry) {
                        Ok(s) => {
                            on_output(id, s);
                            carry.clear();
                        }
                        Err(e) => {
                            let valid = e.valid_up_to();
                            if valid > 0 {
                                let s: String = String::from_utf8_lossy(&carry[..valid]).into_owned();
                                on_output(id, &s);
                                carry = carry[valid..].to_vec();
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("pty {id} read error: {e}");
                    break;
                }
            }
        }
        on_exit(id, exit_code);
    });

    Ok(TtyHandle {
        inner: Box::new(Tty {
            id,
            master,
            child,
            writer,
            read_thread,
        }),
    })
}

/// Handle opaco para o registry; expõe write/resize/kill.
pub struct TtyHandle {
    inner: Box<Tty>,
}

impl TtyHandle {
    pub fn id(&self) -> u64 {
        self.inner.id
    }

    pub fn write(&mut self, data: &str) -> Result<(), String> {
        self.inner
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("write pty: {e}"))
    }

    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), String> {
        self.inner
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("resize pty: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex as StdMutex};
    use std::time::Duration;

    struct Sink {
        output: StdMutex<String>,
        exit: StdMutex<Option<i32>>,
    }

    fn wait_until(sink: &Arc<Sink>, needle: &str, deadline: Duration) -> bool {
        let started = std::time::Instant::now();
        while started.elapsed() < deadline {
            let all = sink.output.lock().unwrap().clone();
            if all.contains(needle) {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        false
    }

    fn spawn_test_shell() -> (TtyHandle, Arc<Sink>) {
        let sink = Arc::new(Sink {
            output: StdMutex::new(String::new()),
            exit: StdMutex::new(None),
        });
        let s2 = Arc::clone(&sink);
        let s3 = Arc::clone(&sink);
        let handle = spawn_pty(
            "/tmp",
            PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 },
            move |_id, chunk| s2.output.lock().unwrap().push_str(chunk),
            move |_id, code| *s3.exit.lock().unwrap() = Some(code),
        )
        .expect("spawn");
        (handle, sink)
    }

    #[test]
    fn spawn_echoes_input() {
        let (mut handle, sink) = spawn_test_shell();
        handle.write("echo codeatlas-pty-ok\r").expect("write");
        assert!(
            wait_until(&sink, "codeatlas-pty-ok", Duration::from_secs(5)),
            "saída do shell deveria conter o echo, recebida: {:?}",
            sink.output.lock().unwrap()
        );
    }

    #[test]
    fn utf8_split_across_reads_is_not_corrupted() {
        let (mut handle, sink) = spawn_test_shell();
        // Sequência multibyte (ç) enviada em duas chamadas de write.
        handle.write("printf 'café'\r").expect("write");
        assert!(
            wait_until(&sink, "café", Duration::from_secs(5)),
            "UTF-8 multibyte deveria ser decodificado sem corrupção: {:?}",
            sink.output.lock().unwrap()
        );
    }

    #[test]
    fn exit_is_reported() {
        let (mut handle, sink) = spawn_test_shell();
        handle.write("exit\r").expect("write");
        let started = std::time::Instant::now();
        while started.elapsed() < Duration::from_secs(5) {
            if sink.exit.lock().unwrap().is_some() {
                return;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        panic!("on_exit não foi chamado após `exit`");
    }
}
