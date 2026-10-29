//! A tabela de processos do host por `/proc` e o sinal com conferência do início.
//!
//! O início de um processo é o boot (`btime` de `/proc/stat`) mais o campo 22 do
//! `stat` (em jiffies desde o boot), escrito como `<btime>+<jiffies>`. Pid igual
//! com início diferente é outro processo: não recebe sinal.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// A marca que o app põe em toda sessão. Do ambiente só ela é lida.
pub const MARCA: &str = "TENANCY_SESSAO";

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Processo {
    pub pid: i32,
    pub ppid: i32,
    pub pgid: i32,
    pub sid: i32,
    pub inicio: String,
    pub argv: Vec<String>,
    /// Só a marca da sessão; o resto do ambiente nunca sai daqui.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marca: Option<String>,
    /// Memória própria (Pss) em MB, de `smaps_rollup`; None sem permissão.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mb: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Sinal {
    #[serde(rename = "HUP")]
    Hup,
    #[serde(rename = "TERM")]
    Term,
    #[serde(rename = "KILL")]
    Kill,
}

impl Sinal {
    fn numero(self) -> i32 {
        match self {
            Sinal::Hup => libc::SIGHUP,
            Sinal::Term => libc::SIGTERM,
            Sinal::Kill => libc::SIGKILL,
        }
    }
}

/// Os campos do `/proc/<pid>/stat` que importam. O nome do programa fica entre
/// parênteses e pode ter espaço e parêntese: corta pelo último `)`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stat {
    pub ppid: i32,
    pub pgid: i32,
    pub sid: i32,
    pub jiffies: u64,
}

pub fn ler_stat(texto: &str) -> Option<Stat> {
    let fim = texto.rfind(')')?;
    let campos: Vec<&str> = texto[fim + 1..].split_whitespace().collect();
    // campos[0] é o estado (campo 3); ppid é o 4, pgrp o 5, session o 6, starttime o 22.
    Some(Stat {
        ppid: campos.get(1)?.parse().ok()?,
        pgid: campos.get(2)?.parse().ok()?,
        sid: campos.get(3)?.parse().ok()?,
        jiffies: campos.get(19)?.parse().ok()?,
    })
}

pub fn boot() -> Option<u64> {
    let stat = fs::read_to_string("/proc/stat").ok()?;
    stat.lines().find_map(|l| l.strip_prefix("btime ")).and_then(|v| v.trim().parse().ok())
}

pub fn inicio(btime: u64, jiffies: u64) -> String {
    format!("{btime}+{jiffies}")
}

/// O valor da marca num `environ` (pares `NOME=valor` separados por `\0`).
pub fn marca_do_ambiente(environ: &[u8]) -> Option<String> {
    let prefixo = format!("{MARCA}=");
    environ
        .split(|b| *b == 0)
        .find_map(|par| par.strip_prefix(prefixo.as_bytes()))
        .map(|v| String::from_utf8_lossy(v).into_owned())
}

pub fn argv_do_cmdline(cmdline: &[u8]) -> Vec<String> {
    cmdline
        .split(|b| *b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).into_owned())
        .collect()
}

/// `Pss:` de `smaps_rollup`, em MB.
pub fn mb_do_smaps(texto: &str) -> Option<f64> {
    let kb: f64 = texto.lines().find_map(|l| l.strip_prefix("Pss:"))?.trim().trim_end_matches("kB").trim().parse().ok()?;
    Some((kb / 1024.0 * 10.0).round() / 10.0)
}

fn ler_um(raiz: &Path, pid: i32, btime: u64) -> Option<Processo> {
    let dir = raiz.join(pid.to_string());
    let st = ler_stat(&fs::read_to_string(dir.join("stat")).ok()?)?;
    Some(Processo {
        pid,
        ppid: st.ppid,
        pgid: st.pgid,
        sid: st.sid,
        inicio: inicio(btime, st.jiffies),
        argv: fs::read(dir.join("cmdline")).map(|b| argv_do_cmdline(&b)).unwrap_or_default(),
        marca: fs::read(dir.join("environ")).ok().and_then(|b| marca_do_ambiente(&b)),
        mb: fs::read_to_string(dir.join("smaps_rollup")).ok().and_then(|t| mb_do_smaps(&t)),
    })
}

/// A tabela inteira. Processo que some no meio da leitura fica de fora.
pub fn tabela() -> Vec<Processo> {
    let Some(btime) = boot() else { return Vec::new() };
    let raiz = Path::new("/proc");
    let Ok(entradas) = fs::read_dir(raiz) else { return Vec::new() };
    let mut lista: Vec<Processo> = entradas
        .filter_map(|e| e.ok()?.file_name().to_str()?.parse::<i32>().ok())
        .filter_map(|pid| ler_um(raiz, pid, btime))
        .collect();
    lista.sort_by_key(|p| p.pid);
    lista
}

/// O início atual de um pid, ou None se ele não existe mais.
pub fn inicio_de(pid: i32) -> Option<String> {
    let btime = boot()?;
    let st = ler_stat(&fs::read_to_string(format!("/proc/{pid}/stat")).ok()?)?;
    Some(inicio(btime, st.jiffies))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum Recusa {
    /// O pid não existe mais.
    Saiu,
    /// O pid existe com outro início: foi reaproveitado.
    OutroProcesso,
    /// Pid 0, 1 ou negativo: nunca.
    Proibido,
    Falhou(i32),
}

fn conferir(pid: i32, esperado: &str) -> Result<(), Recusa> {
    if pid <= 1 {
        return Err(Recusa::Proibido);
    }
    match inicio_de(pid) {
        None => Err(Recusa::Saiu),
        Some(i) if i != esperado => Err(Recusa::OutroProcesso),
        Some(_) => Ok(()),
    }
}

/// Sinal para um processo, só se ele ainda é o mesmo.
pub fn sinal(pid: i32, inicio: &str, s: Sinal) -> Result<(), Recusa> {
    conferir(pid, inicio)?;
    // SAFETY: kill(2) com pid positivo conferido acima; não toca memória.
    let r = unsafe { libc::kill(pid, s.numero()) };
    if r == 0 { Ok(()) } else { Err(Recusa::Falhou(std::io::Error::last_os_error().raw_os_error().unwrap_or(-1))) }
}

/// Sinal para o grupo de que o processo é líder, conferindo o líder.
pub fn sinal_ao_grupo(lider: i32, inicio: &str, s: Sinal) -> Result<(), Recusa> {
    conferir(lider, inicio)?;
    // SAFETY: killpg(2) com grupo positivo conferido acima.
    let r = unsafe { libc::killpg(lider, s.numero()) };
    if r == 0 { Ok(()) } else { Err(Recusa::Falhou(std::io::Error::last_os_error().raw_os_error().unwrap_or(-1))) }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn stat_com_parentese_e_espaco_no_nome() {
        let t = "4242 (meu (prog) x) S 10 4242 4242 34816 4242 4194560 1 0 0 0 0 0 0 0 20 0 1 0 987654 1000 100 0";
        assert_eq!(ler_stat(t), Some(Stat { ppid: 10, pgid: 4242, sid: 4242, jiffies: 987654 }));
    }

    #[test]
    fn so_a_marca_sai_do_ambiente() {
        let env = b"HOME=/home/lia\0CHAVE_DE_EXEMPLO=valor-de-exemplo\0TENANCY_SESSAO=s7\0";
        assert_eq!(marca_do_ambiente(env), Some("s7".into()));
        assert_eq!(marca_do_ambiente(b"HOME=/home/lia\0"), None);
    }

    #[test]
    fn memoria_pelo_pss() {
        assert_eq!(mb_do_smaps("Rss:  20480 kB\nPss:  10240 kB\n"), Some(10.0));
    }
}
