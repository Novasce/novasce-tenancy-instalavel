//! A janela `agentes`: a página do Tenancy web dentro do app (decisão 5), sem
//! nenhuma capacidade do Tauri. A navegação fica presa à origem do web; outra
//! origem abre no navegador do sistema (decisão 7), só se for http, https ou
//! mailto. `window.open` e `target="_blank"` para a própria origem abrem na
//! mesma janela; download só da origem do web. A janela `principal` recebe
//! só o caminho de cada navegação (nunca a busca, onde vai o código), para
//! perceber quando o web cai no login (UC34), e o aviso de que a janela fechou.

use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;

pub const ROTULO: &str = "agentes";

#[derive(Debug, PartialEq, Eq)]
pub enum Destino {
    Fica,
    Navegador,
}

pub fn mesma_origem(a: &Url, b: &Url) -> bool {
    a.origin() == b.origin()
}

/// A origem do próprio app (a página de ensaio): `tauri://localhost` ou `http(s)://tauri.localhost`.
pub fn origem_do_app(u: &Url) -> bool {
    u.scheme() == "tauri" || u.host_str() == Some("tauri.localhost")
}

/// Fica na janela só o que é da origem do web (ou do app, no ensaio); o resto vai ao navegador.
pub fn decidir(base: Option<&Url>, destino: &Url) -> Destino {
    if destino.scheme() == "about" {
        return Destino::Fica;
    }
    match base {
        Some(b) if mesma_origem(b, destino) => Destino::Fica,
        None if origem_do_app(destino) => Destino::Fica,
        _ => Destino::Navegador,
    }
}

/// O navegador do sistema só recebe endereço da web ou de e-mail; `file:` e esquemas próprios, nunca.
pub fn pode_ir_ao_navegador(u: &Url) -> bool {
    matches!(u.scheme(), "http" | "https" | "mailto")
}

fn ao_navegador(app: &AppHandle, destino: &Url) {
    if pode_ir_ao_navegador(destino) {
        let _ = app.opener().open_url(destino.as_str(), None::<&str>);
    }
}

/// Abre a janela com o endereço da troca. Já aberta: vai ao endereço novo (um
/// código novo) ou, com endereço vazio, só vem para a frente.
#[tauri::command]
pub fn abrir_agentes(app: AppHandle, endereco: String) -> Result<(), String> {
    let externo = endereco.starts_with("https://") || endereco.starts_with("http://");
    if let Some(janela) = app.get_webview_window(ROTULO) {
        if externo {
            janela.navigate(Url::parse(&endereco).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        }
        let _ = janela.show();
        let _ = janela.set_focus();
        return Ok(());
    }
    if endereco.is_empty() {
        return Err("sem endereço para abrir os agentes".into());
    }
    let (url, base) = if externo {
        let u = Url::parse(&endereco).map_err(|e| e.to_string())?;
        (WebviewUrl::External(u.clone()), Some(u))
    } else {
        (WebviewUrl::App(endereco.into()), None)
    };
    let (navegou, nova, baixar) = (app.clone(), app.clone(), app.clone());
    let (base_nova, base_baixar) = (base.clone(), base.clone());
    let janela = WebviewWindowBuilder::new(&app, ROTULO, url)
        .title("Agentes · Tenancy")
        .inner_size(1264.0, 728.0)
        .min_inner_size(1024.0, 728.0)
        .on_navigation(move |destino| {
            let _ = navegou.emit_to("principal", "agentes:navegou", destino.path());
            match decidir(base.as_ref(), destino) {
                Destino::Fica => true,
                Destino::Navegador => {
                    ao_navegador(&navegou, destino);
                    false
                }
            }
        })
        .on_new_window(move |destino, _| {
            match decidir(base_nova.as_ref(), &destino) {
                Destino::Fica => {
                    if let Some(j) = nova.get_webview_window(ROTULO) {
                        let _ = j.navigate(destino);
                    }
                }
                Destino::Navegador => ao_navegador(&nova, &destino),
            }
            NewWindowResponse::Deny
        })
        .on_download(move |_, evento| match evento {
            DownloadEvent::Requested { url, .. } => match decidir(base_baixar.as_ref(), &url) {
                Destino::Fica => true,
                Destino::Navegador => {
                    ao_navegador(&baixar, &url);
                    false
                }
            },
            _ => true,
        })
        .build()
        .map_err(|e| e.to_string())?;
    let fechou = app.clone();
    janela.on_window_event(move |evento| {
        if let WindowEvent::Destroyed = evento {
            let _ = fechou.emit_to("principal", "agentes:fechou", ());
        }
    });
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::path::Path;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn navegacao_presa_a_origem_do_web() {
        let base = u("https://web.exemplo.invalid/entrar/app?codigo=x");
        assert_eq!(decidir(Some(&base), &u("https://web.exemplo.invalid/ia/agentes")), Destino::Fica);
        assert_eq!(decidir(Some(&base), &u("https://web.exemplo.invalid/ia/agentes/mapa")), Destino::Fica);
        assert_eq!(decidir(Some(&base), &u("https://console.exemplo.invalid/")), Destino::Navegador);
        assert_eq!(decidir(Some(&base), &u("http://web.exemplo.invalid/ia/agentes")), Destino::Navegador);
        assert_eq!(decidir(Some(&base), &u("https://web.exemplo.invalid:8443/")), Destino::Navegador);
        assert_eq!(decidir(Some(&base), &u("about:blank")), Destino::Fica);
    }

    #[test]
    fn no_ensaio_so_a_pagina_local_fica() {
        assert_eq!(decidir(None, &u("tauri://localhost/agentes-ensaio.html?codigo=x")), Destino::Fica);
        assert_eq!(decidir(None, &u("http://tauri.localhost/agentes-ensaio.html")), Destino::Fica);
        assert_eq!(decidir(None, &u("https://exemplo.invalid/")), Destino::Navegador);
    }

    #[test]
    fn navegador_so_para_web_e_email() {
        assert!(pode_ir_ao_navegador(&u("https://exemplo.invalid/")));
        assert!(pode_ir_ao_navegador(&u("mailto:alguem@exemplo.invalid")));
        assert!(!pode_ir_ao_navegador(&u("file:///etc/passwd")));
        assert!(!pode_ir_ao_navegador(&u("data:text/html,oi")));
        assert!(!pode_ir_ao_navegador(&u("esquema-proprio://abrir")));
    }

    /// A janela `agentes` não tem capacidade nenhuma, e nenhuma capacidade vale para página remota.
    #[test]
    fn agentes_sem_capacidade() {
        let pasta = Path::new(env!("CARGO_MANIFEST_DIR")).join("capabilities");
        let mut vistas = 0;
        for entrada in std::fs::read_dir(&pasta).unwrap() {
            let texto = std::fs::read_to_string(entrada.unwrap().path()).unwrap();
            let json: serde_json::Value = serde_json::from_str(&texto).unwrap();
            let janelas: Vec<String> = json["windows"].as_array().unwrap().iter().map(|j| j.as_str().unwrap().to_string()).collect();
            assert!(!janelas.iter().any(|j| j == ROTULO || j.contains('*')), "capacidade alcança a janela agentes: {janelas:?}");
            assert!(json.get("remote").is_none(), "capacidade para página remota");
            assert!(json.get("webviews").is_none(), "capacidade por webview");
            vistas += 1;
        }
        assert!(vistas >= 1);
    }

    /// Os comandos do app exigem permissão (manifesto no build.rs) e só a principal recebe.
    #[test]
    fn comandos_so_com_permissao() {
        let build = include_str!("../build.rs");
        for c in ["tipo_da_mao", "info", "imprimir_e_sair", "abrir_agentes"] {
            assert!(build.contains(&format!("\"{c}\"")), "comando sem permissão no manifesto: {c}");
        }
        let principal = include_str!("../capabilities/principal.json");
        assert!(principal.contains("\"allow-abrir-agentes\""));
        assert!(principal.contains("\"windows\": [\n    \"principal\"\n  ]"));
    }
}
