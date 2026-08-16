use std::path::Path;
use std::process::Command;

/// Interface do provider de git (mockável em testes — specs/09, testes de backend).
pub trait GitProvider: Send + Sync {
    fn is_repo(&self, dir: &Path) -> bool;
    /// Arquivos com mudança real vs HEAD: staged/unstaged (M/A/D/R) + untracked (`??`).
    fn dirty_files(&self, dir: &Path) -> Vec<String>;
    /// Retorna o diff unificado do arquivo em relação a HEAD.
    fn diff_file(&self, dir: &Path, rel_path: &str) -> Result<String, String>;
}

pub struct SystemGit;

impl GitProvider for SystemGit {
    fn is_repo(&self, dir: &Path) -> bool {
        Command::new("git")
            .args(["rev-parse", "--is-inside-work-tree"])
            .current_dir(dir)
            .output()
            .map(|o| o.status.success() && std::str::from_utf8(&o.stdout).map(|s| s.trim() == "true").unwrap_or(false))
            .unwrap_or(false)
    }

    fn dirty_files(&self, dir: &Path) -> Vec<String> {
        let out = Command::new("git")
            .args(["status", "--porcelain", "--untracked-files=all"])
            .current_dir(dir)
            .output();
        let Ok(out) = out else { return Vec::new() };
        if !out.status.success() {
            return Vec::new();
        }
        String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(parse_porcelain)
            .collect()
    }

    fn diff_file(&self, dir: &Path, rel_path: &str) -> Result<String, String> {
        let out = Command::new("git")
            .args(["diff", "HEAD", "--", rel_path])
            .current_dir(dir)
            .output()
            .map_err(|e| e.to_string())?;

        let mut diff_str = String::from_utf8_lossy(&out.stdout).to_string();
        if diff_str.trim().is_empty() {
            // Se for arquivo untracked, gera diff a partir de /dev/null
            let out_untracked = Command::new("git")
                .args(["diff", "--no-index", "/dev/null", rel_path])
                .current_dir(dir)
                .output();
            if let Ok(uo) = out_untracked {
                diff_str = String::from_utf8_lossy(&uo.stdout).to_string();
            }
        }
        Ok(diff_str)
    }
}

/// Interpreta uma linha `git status --porcelain` (formato `XY path`).
/// Mudanças reais: X/Y em `MADR` ou untracked `??`. Rename vira `old -> new`.
fn parse_porcelain(line: &str) -> Option<String> {
    let line = line.strip_suffix('\r').unwrap_or(line);
    if line.len() < 3 {
        return None;
    }
    let status = &line[0..2];
    let path = line[3..].trim();
    if path.is_empty() {
        return None;
    }
    let changed = status.chars().any(|c| "MAD R?".contains(c) && c != ' ');
    changed.then(|| path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn porcelain_identifica_mudancas_reais() {
        assert_eq!(parse_porcelain(" M src/a.ts"), Some("src/a.ts".to_string()));
        assert_eq!(parse_porcelain("A  src/novo.ts"), Some("src/novo.ts".to_string()));
        assert_eq!(parse_porcelain("?? src/tmp.ts"), Some("src/tmp.ts".to_string()));
        assert_eq!(parse_porcelain("R  src/a.ts -> src/b.ts"), Some("src/a.ts -> src/b.ts".to_string()));
        assert_eq!(parse_porcelain("   src/sem-status.ts"), None);
    }

    #[test]
    fn system_git_detects_dirty_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        git(&root, &["init", "-q"]);
        git(&root, &["config", "user.email", "t@t"]);
        git(&root, &["config", "user.name", "t"]);
        let sub = root.join("src");
        fs::create_dir_all(&sub).unwrap();
        let mut f = fs::File::create(sub.join("a.ts")).unwrap();
        writeln!(f, "x").unwrap();
        git(&root, &["add", "-A"]);
        git(&root, &["commit", "-qm", "init"]);

        let git = SystemGit;
        assert!(git.is_repo(root));
        assert!(git.dirty_files(root).is_empty());

        let mut f = fs::OpenOptions::new().append(true).open(sub.join("a.ts")).unwrap();
        writeln!(f, "y").unwrap();
        fs::write(sub.join("novo.ts"), "z").unwrap();

        let dirty = git.dirty_files(root);
        assert!(dirty.iter().any(|p| p.ends_with("a.ts")));
        assert!(dirty.iter().any(|p| p.ends_with("novo.ts")));
        assert!(!git.is_repo(&dir.path().join("nao-existe")));
    }

    fn git(dir: &Path, args: &[&str]) {
        let out = Command::new("git").args(args).current_dir(dir).output().unwrap();
        assert!(out.status.success(), "git {args:?} falhou: {}", String::from_utf8_lossy(&out.stderr));
    }
}
