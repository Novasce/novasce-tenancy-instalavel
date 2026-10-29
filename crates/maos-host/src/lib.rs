//! As mãos diretas do Tenancy no host Linux. É o código que roda no host: no
//! caminho C dentro do app, no caminho B dentro do ajudante e, no caminho A, só
//! a parte de processos, chamada pelo `flatpak-spawn --host` em modo linha de
//! comando (`maos-host tabela`, `maos-host sinal`).

pub mod cofre;
pub mod git;
pub mod processos;
pub mod pty;
