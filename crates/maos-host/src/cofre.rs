//! O cofre do login do OS: o Secret Service (`service=novasce`, conta
//! `tenancy-pessoa`) e, na falta dele, a reserva em arquivo 0600. Daqui só sai
//! presença para log e tela; o valor só serve à troca, do lado do host.

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

pub const SERVICO: &str = "novasce";
pub const CONTA: &str = "tenancy-pessoa";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Onde {
    Chaveiro,
    Reserva(PathBuf),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Presenca {
    Tem(Onde),
    NaoTem,
    /// A reserva existe com permissão aberta a outros: não é lida.
    ReservaAberta(PathBuf),
}

impl Presenca {
    /// O que pode ir para log: nunca o valor.
    pub fn para_log(&self) -> &'static str {
        match self {
            Presenca::Tem(Onde::Chaveiro) => "login no chaveiro",
            Presenca::Tem(Onde::Reserva(_)) => "login na reserva",
            Presenca::NaoTem => "sem login",
            Presenca::ReservaAberta(_) => "reserva com permissão aberta, ignorada",
        }
    }
}

/// O valor, só para a troca. Não implementa Debug nem Display.
pub struct Segredo(String);

impl Segredo {
    pub fn expor_para_a_troca(&self) -> &str {
        &self.0
    }
}

fn ler_reserva(caminho: &Path) -> Result<Option<Segredo>, Presenca> {
    let Ok(meta) = fs::metadata(caminho) else { return Ok(None) };
    if meta.permissions().mode() & 0o077 != 0 {
        return Err(Presenca::ReservaAberta(caminho.to_path_buf()));
    }
    let texto = fs::read_to_string(caminho).unwrap_or_default();
    let valor = texto.trim();
    Ok(if valor.is_empty() { None } else { Some(Segredo(valor.to_string())) })
}

fn ler_chaveiro() -> Option<Segredo> {
    let o = Command::new("secret-tool").args(["lookup", "service", SERVICO, "account", CONTA]).output().ok()?;
    if !o.status.success() {
        return None;
    }
    let valor = String::from_utf8(o.stdout).ok()?.trim().to_string();
    if valor.is_empty() { None } else { Some(Segredo(valor)) }
}

/// O caminho da reserva: `~/.local/state/novasce/tenancy-pessoa`.
pub fn reserva_padrao(home: &Path) -> PathBuf {
    home.join(".local/state/novasce").join(CONTA)
}

/// Lê o login: primeiro o chaveiro (se `usar_chaveiro`), depois a reserva.
pub fn ler(reserva: &Path, usar_chaveiro: bool) -> (Presenca, Option<Segredo>) {
    if usar_chaveiro {
        if let Some(s) = ler_chaveiro() {
            return (Presenca::Tem(Onde::Chaveiro), Some(s));
        }
    }
    match ler_reserva(reserva) {
        Ok(Some(s)) => (Presenca::Tem(Onde::Reserva(reserva.to_path_buf())), Some(s)),
        Ok(None) => (Presenca::NaoTem, None),
        Err(p) => (p, None),
    }
}
