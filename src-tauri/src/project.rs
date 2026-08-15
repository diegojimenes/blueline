use std::fs;
use std::path::Path;

/// Arquivos de origem do pipeline TS/JS (specs/04-analysis-pipeline.md).
pub fn is_source_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("ts") | Some("tsx") | Some("js") | Some("jsx")
    )
}

/// Diretórios ignorados (espelha `walk.ts` do núcleo).
pub const IGNORED_DIRS: [&str; 7] = ["node_modules", ".git", ".next", "dist", "build", "target", "coverage"];

/// Lista os arquivos TS/JS de um diretório, relativos ao root, normalizados
/// (forward slashes) e ordenados. O webview usa isto para o build inicial.
pub fn walk_source_files(root: &Path) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    visit(root, root, &mut out);
    out.sort();
    out
}

fn visit(dir: &Path, root: &Path, out: &mut Vec<String>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }
        if path.is_dir() {
            visit(&path, root, out);
        } else if is_source_file(&path) {
            if let Ok(rel) = path.strip_prefix(root) {
                out.push(rel.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn walk_ignora_dirs_e_filtra_extensao() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let src = root.join("src").join("pedidos");
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(root.join("node_modules").join("pkg")).unwrap();
        for f in ["a.ts", "b.tsx", "c.js", "d.txt", "e.css"] {
            let mut file = File::create(src.join(f)).unwrap();
            writeln!(file, "x").unwrap();
        }
        let mut ignored = File::create(root.join("node_modules/pkg").join("nope.ts")).unwrap();
        writeln!(ignored, "x").unwrap();

        let files = walk_source_files(root);
        assert_eq!(files, vec!["src/pedidos/a.ts", "src/pedidos/b.tsx", "src/pedidos/c.js"]);
    }
}
