//! `maos-host` em modo linha de comando, para o caminho A (`flatpak-spawn
//! --host`): `tabela` imprime a tabela de processos em JSON; `sinal <pid>
//! <início> <HUP|TERM|KILL> [grupo]` manda um sinal conferindo o início.

use maos_host::processos::{self, Sinal};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let codigo = match args.first().map(String::as_str) {
        Some("tabela") => {
            println!("{}", serde_json::to_string(&processos::tabela()).unwrap_or_else(|_| "[]".into()));
            0
        }
        Some("sinal") if args.len() >= 4 => {
            let pid: i32 = args[1].parse().unwrap_or(0);
            let sinal: Option<Sinal> = serde_json::from_str(&format!("\"{}\"", args[3])).ok();
            match sinal {
                None => 2,
                Some(s) => {
                    let r = if args.get(4).map(String::as_str) == Some("grupo") {
                        processos::sinal_ao_grupo(pid, &args[2], s)
                    } else {
                        processos::sinal(pid, &args[2], s)
                    };
                    match r {
                        Ok(()) => 0,
                        Err(e) => {
                            eprintln!("{}", serde_json::to_string(&e).unwrap_or_default());
                            1
                        }
                    }
                }
            }
        }
        _ => {
            eprintln!("uso: maos-host tabela | maos-host sinal <pid> <início> <HUP|TERM|KILL> [grupo]");
            2
        }
    };
    std::process::exit(codigo);
}
