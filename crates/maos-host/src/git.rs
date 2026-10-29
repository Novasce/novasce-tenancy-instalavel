//! Git pelo `git` do PATH da pessoa, nunca por caminho fixo.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SaidaDoGit {
    pub codigo: i32,
    pub saida: String,
    pub erro: String,
}

pub fn rodar(pasta: &Path, args: &[&str]) -> SaidaDoGit {
    match Command::new("git").args(args).current_dir(pasta).env("GIT_TERMINAL_PROMPT", "0").output() {
        Ok(o) => SaidaDoGit {
            codigo: o.status.code().unwrap_or(-1),
            saida: String::from_utf8_lossy(&o.stdout).into_owned(),
            erro: String::from_utf8_lossy(&o.stderr).into_owned(),
        },
        Err(e) => SaidaDoGit { codigo: 127, saida: String::new(), erro: format!("git não encontrado no PATH: {e}") },
    }
}
