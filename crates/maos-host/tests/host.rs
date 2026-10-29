//! O G2 e o G3 do lado de dentro, sem Flatpak: pseudoterminal de verdade com
//! terminal de controle, controle de tarefas e tamanho; achar um processo pela
//! marca e encerrar só ele; git do PATH; cofre que só diz presença.
#![cfg(target_os = "linux")]

use std::collections::BTreeMap;
use std::io::Read;
use std::os::unix::fs::PermissionsExt;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use maos_host::cofre::{self, Onde, Presenca};
use maos_host::git;
use maos_host::processos::{self, Sinal};
use maos_host::pty::{ambiente_final, Pedido, Pseudoterminal};

fn bash(colunas: u16, linhas: u16) -> (Pseudoterminal, Arc<Mutex<String>>) {
    let mut ambiente = BTreeMap::new();
    ambiente.insert("TERM".into(), "xterm-256color".into());
    ambiente.insert("PS1".into(), "$ ".into());
    ambiente.insert(processos::MARCA.into(), "ensaio-pty".into());
    let p = Pedido {
        programa: "bash".into(),
        args: vec!["--norc".into(), "--noprofile".into(), "-i".into()],
        pasta: std::env::temp_dir(),
        ambiente,
        tirar: vec!["CLAUDECODE".into(), "CLAUDE_CODE*".into()],
        colunas,
        linhas,
    };
    let t = Pseudoterminal::abrir(&p).expect("o bash abre num pseudoterminal");
    let saida = Arc::new(Mutex::new(String::new()));
    let mut leitor = t.leitor().unwrap();
    let s = saida.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        while let Ok(n) = leitor.read(&mut buf) {
            if n == 0 {
                break;
            }
            s.lock().unwrap().push_str(&String::from_utf8_lossy(&buf[..n]));
        }
    });
    (t, saida)
}

fn esperar_por(saida: &Arc<Mutex<String>>, marca: &str) -> String {
    let fim = Instant::now() + Duration::from_secs(10);
    loop {
        let texto = saida.lock().unwrap().clone();
        if texto.contains(marca) {
            return texto;
        }
        assert!(Instant::now() < fim, "não apareceu {marca:?} em 10 s; saída: {texto:?}");
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn bash_tem_tty_e_controle_de_tarefas() {
    let (mut t, saida) = bash(80, 24);
    t.escrever(b"tty; echo F-$((1+1))\n").unwrap();
    let texto = esperar_por(&saida, "F-2");
    assert!(texto.contains("/dev/pts/"), "sem tty: {texto:?}");
    t.escrever(b"case $- in *m*) echo MONITOR-SIM;; *) echo MONITOR-NAO;; esac\n").unwrap();
    let texto = esperar_por(&saida, "MONITOR-");
    assert!(texto.contains("MONITOR-SIM"), "sem controle de tarefas: {texto:?}");
    t.escrever(b"exit\n").unwrap();
    assert_eq!(t.esperar().unwrap(), 0);
}

#[test]
fn tamanho_acompanha_depois_de_redimensionar() {
    let (mut t, saida) = bash(80, 24);
    t.escrever(b"echo T1-$(stty size)\n").unwrap();
    assert!(esperar_por(&saida, "T1-24 80").contains("T1-24 80"));
    t.redimensionar(132, 40).unwrap();
    t.escrever(b"echo T2-$(stty size)\n").unwrap();
    assert!(esperar_por(&saida, "T2-40 132").contains("T2-40 132"));
    t.escrever(b"exit\n").unwrap();
    t.esperar().unwrap();
}

#[test]
fn o_ambiente_do_claude_de_fora_nao_entra() {
    let host = vec![
        ("HOME".to_string(), "/home/lia".to_string()),
        ("CLAUDECODE".to_string(), "1".to_string()),
        ("CLAUDE_CODE_ENTRYPOINT".to_string(), "cli".to_string()),
    ];
    let mut por = BTreeMap::new();
    por.insert("TENANCY_SESSAO".to_string(), "s1".to_string());
    let fim = ambiente_final(host, &["CLAUDECODE".into(), "CLAUDE_CODE*".into()], &por);
    assert_eq!(fim.keys().cloned().collect::<Vec<_>>(), vec!["HOME", "TENANCY_SESSAO"]);
}

#[test]
fn acha_o_sleep_marcado_e_encerra_so_ele() {
    let mut marcado = Command::new("sleep").arg("60").env(processos::MARCA, "ensaio-sleep").stdout(Stdio::null()).spawn().unwrap();
    let mut outro = Command::new("sleep").arg("60").env_remove(processos::MARCA).stdout(Stdio::null()).spawn().unwrap();
    std::thread::sleep(Duration::from_millis(200));
    let tabela = processos::tabela();
    let achados: Vec<_> = tabela.iter().filter(|p| p.marca.as_deref() == Some("ensaio-sleep")).collect();
    assert_eq!(achados.len(), 1, "um só processo com a marca");
    let alvo = achados[0];
    assert_eq!(alvo.pid as u32, marcado.id());
    assert_eq!(alvo.argv, vec!["sleep", "60"]);
    let json = serde_json::to_string(&tabela).unwrap();
    assert!(!json.contains("HOME="), "o ambiente não sai na tabela");

    // Início errado: é outro processo, não recebe.
    assert_eq!(processos::sinal(alvo.pid, "0+0", Sinal::Term), Err(processos::Recusa::OutroProcesso));
    assert!(marcado.try_wait().unwrap().is_none());
    assert_eq!(processos::sinal(1, "0+0", Sinal::Term), Err(processos::Recusa::Proibido));

    processos::sinal(alvo.pid, &alvo.inicio, Sinal::Term).unwrap();
    let fim = Instant::now() + Duration::from_secs(3);
    while marcado.try_wait().unwrap().is_none() {
        assert!(Instant::now() < fim, "o marcado não saiu com TERM");
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(outro.try_wait().unwrap().is_none(), "o outro sleep continua");
    assert_eq!(processos::sinal(alvo.pid, &alvo.inicio, Sinal::Term), Err(processos::Recusa::Saiu));
    outro.kill().unwrap();
    outro.wait().unwrap();
}

#[test]
fn sinal_ao_grupo_da_sessao_do_pseudoterminal() {
    let (mut t, saida) = bash(80, 24);
    let pid = t.pid().unwrap() as i32;
    t.escrever(b"sleep 60 & echo FILHO-$!\n").unwrap();
    esperar_por(&saida, "FILHO-");
    let inicio = processos::inicio_de(pid).unwrap();
    let tabela = processos::tabela();
    let raiz = tabela.iter().find(|p| p.pid == pid).unwrap();
    assert_eq!(raiz.sid, pid, "o bash é líder da sessão: tem terminal de controle");
    assert_eq!(raiz.marca.as_deref(), Some("ensaio-pty"));
    processos::sinal_ao_grupo(pid, &inicio, Sinal::Hup).unwrap();
    processos::sinal_ao_grupo(pid, &inicio, Sinal::Kill).ok();
    t.esperar().unwrap();
}

#[test]
fn git_do_path() {
    let dir = tempfile::tempdir().unwrap();
    assert_ne!(git::rodar(dir.path(), &["rev-parse", "--show-toplevel"]).codigo, 0);
    assert_eq!(git::rodar(dir.path(), &["init", "-q", "-b", "main"]).codigo, 0);
    let s = git::rodar(dir.path(), &["rev-parse", "--show-toplevel"]);
    assert_eq!(s.codigo, 0);
    assert!(s.saida.trim().ends_with(dir.path().file_name().unwrap().to_str().unwrap()));
}

#[test]
fn cofre_le_a_reserva_0600_e_recusa_a_aberta() {
    let dir = tempfile::tempdir().unwrap();
    let reserva = cofre::reserva_padrao(dir.path());
    let (p, s) = cofre::ler(&reserva, false);
    assert_eq!(p, Presenca::NaoTem);
    assert!(s.is_none());

    std::fs::create_dir_all(reserva.parent().unwrap()).unwrap();
    std::fs::write(&reserva, "valor-de-exemplo\n").unwrap();
    std::fs::set_permissions(&reserva, std::fs::Permissions::from_mode(0o644)).unwrap();
    let (p, s) = cofre::ler(&reserva, false);
    assert!(matches!(p, Presenca::ReservaAberta(_)));
    assert!(s.is_none());

    std::fs::set_permissions(&reserva, std::fs::Permissions::from_mode(0o600)).unwrap();
    let (p, s) = cofre::ler(&reserva, false);
    assert_eq!(p, Presenca::Tem(Onde::Reserva(reserva.clone())));
    assert_eq!(s.unwrap().expor_para_a_troca(), "valor-de-exemplo");
    assert!(!p.para_log().contains("valor"));
}
