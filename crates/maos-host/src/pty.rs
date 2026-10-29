//! Pseudoterminal com `portable-pty`: a sessão nasce com terminal de controle,
//! o que dá controle de tarefas (Ctrl+Z, `fg`) e o tamanho que acompanha a tela.

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::path::PathBuf;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};

/// O pedido de terminal, igual ao `PedidoDeTerminal` da tela.
#[derive(Debug, Clone)]
pub struct Pedido {
    pub programa: String,
    pub args: Vec<String>,
    pub pasta: PathBuf,
    pub ambiente: BTreeMap<String, String>,
    /// Nomes que saem do ambiente; terminado em `*` vale como prefixo.
    pub tirar: Vec<String>,
    pub colunas: u16,
    pub linhas: u16,
}

pub struct Pseudoterminal {
    mestre: Box<dyn MasterPty + Send>,
    escritor: Box<dyn Write + Send>,
    filho: Box<dyn Child + Send + Sync>,
}

/// O ambiente do host menos o que o pedido tira, mais o que ele põe.
pub fn ambiente_final(
    host: impl IntoIterator<Item = (String, String)>,
    tirar: &[String],
    por: &BTreeMap<String, String>,
) -> BTreeMap<String, String> {
    let sai = |nome: &str| {
        tirar.iter().any(|t| match t.strip_suffix('*') {
            Some(prefixo) => nome.starts_with(prefixo),
            None => nome == t,
        })
    };
    let mut fim: BTreeMap<String, String> = host.into_iter().filter(|(k, _)| !sai(k)).collect();
    for (k, v) in por {
        fim.insert(k.clone(), v.clone());
    }
    fim
}

impl Pseudoterminal {
    pub fn abrir(p: &Pedido) -> Result<Self, String> {
        let sistema = native_pty_system();
        let par = sistema
            .openpty(PtySize { rows: p.linhas, cols: p.colunas, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| format!("o pseudoterminal não abriu: {e}"))?;
        let mut cmd = CommandBuilder::new(&p.programa);
        cmd.args(&p.args);
        cmd.cwd(&p.pasta);
        cmd.env_clear();
        for (k, v) in ambiente_final(std::env::vars(), &p.tirar, &p.ambiente) {
            cmd.env(k, v);
        }
        let filho = par.slave.spawn_command(cmd).map_err(|e| format!("o programa não subiu: {e}"))?;
        drop(par.slave);
        let escritor = par.master.take_writer().map_err(|e| format!("sem escrita no terminal: {e}"))?;
        Ok(Self { mestre: par.master, escritor, filho })
    }

    pub fn pid(&self) -> Option<u32> {
        self.filho.process_id()
    }

    pub fn escrever(&mut self, dados: &[u8]) -> Result<(), String> {
        self.escritor.write_all(dados).and_then(|_| self.escritor.flush()).map_err(|e| e.to_string())
    }

    pub fn redimensionar(&self, colunas: u16, linhas: u16) -> Result<(), String> {
        self.mestre
            .resize(PtySize { rows: linhas, cols: colunas, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())
    }

    /// O fluxo de saída. Cada chamada dá um leitor novo sobre o mesmo terminal.
    pub fn leitor(&self) -> Result<Box<dyn Read + Send>, String> {
        self.mestre.try_clone_reader().map_err(|e| e.to_string())
    }

    /// Espera a saída e devolve o código.
    pub fn esperar(&mut self) -> Result<u32, String> {
        self.filho.wait().map(|s| s.exit_code()).map_err(|e| e.to_string())
    }

    pub fn ja_saiu(&mut self) -> Option<u32> {
        self.filho.try_wait().ok().flatten().map(|s| s.exit_code())
    }
}
