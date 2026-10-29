//! O app Tenancy. A janela `principal` é a casca local; a mão do host do
//! caminho escolhido pelos portões entra na Parte F, em `mao`. Com
//! `--autoteste` o app roda o roteiro de geometria, imprime o JSON e fecha.

pub mod janela_web;
pub mod mao;

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct Info {
    versao: String,
    flatpak: bool,
    autoteste: bool,
    tema: Option<String>,
}

/// O valor de `--nome valor` nos argumentos.
pub fn argumento<I: IntoIterator<Item = String>>(args: I, nome: &str) -> Option<String> {
    let mut it = args.into_iter();
    while let Some(a) = it.next() {
        if a == nome {
            return it.next();
        }
    }
    None
}

pub fn tem_argumento<I: IntoIterator<Item = String>>(args: I, nome: &str) -> bool {
    args.into_iter().any(|a| a == nome)
}

/// `1024x728` em largura e altura.
pub fn tamanho(texto: &str) -> Option<(f64, f64)> {
    let (l, a) = texto.split_once('x')?;
    Some((l.parse().ok()?, a.parse().ok()?))
}

#[tauri::command]
fn info(app: tauri::AppHandle) -> Info {
    Info {
        versao: app.package_info().version.to_string(),
        flatpak: std::env::var_os("FLATPAK_ID").is_some(),
        autoteste: tem_argumento(std::env::args(), "--autoteste"),
        tema: argumento(std::env::args(), "--tema"),
    }
}

/// Só o autoteste usa: a saída do roteiro vai para a saída padrão e o app fecha.
#[tauri::command]
fn imprimir_e_sair(app: tauri::AppHandle, json: String) {
    if tem_argumento(std::env::args(), "--autoteste") {
        println!("{json}");
        app.exit(0);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(janela) = app.get_webview_window("principal") {
                if let Some((l, a)) = argumento(std::env::args(), "--janela").as_deref().and_then(tamanho) {
                    let _ = janela.set_size(tauri::LogicalSize::new(l, a));
                }
                if let Some(escala) = argumento(std::env::args(), "--escala").and_then(|e| e.parse::<f64>().ok()) {
                    let _ = janela.set_zoom(escala);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![mao::tipo_da_mao, info, imprimir_e_sair, janela_web::abrir_agentes])
        .run(tauri::generate_context!())
        .expect("o Tenancy não abriu");
}

#[cfg(test)]
mod testes {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn argumentos_do_autoteste() {
        let a = args(&["novasce-tenancy", "--autoteste", "--janela", "1024x728", "--tema", "escuro"]);
        assert!(tem_argumento(a.clone(), "--autoteste"));
        assert_eq!(argumento(a.clone(), "--janela").as_deref().and_then(tamanho), Some((1024.0, 728.0)));
        assert_eq!(argumento(a.clone(), "--tema").as_deref(), Some("escuro"));
        assert_eq!(argumento(a, "--escala"), None);
        assert!(!tem_argumento(args(&["novasce-tenancy", "--autoteste-x"]), "--autoteste"));
        assert_eq!(tamanho("1024"), None);
    }
}
