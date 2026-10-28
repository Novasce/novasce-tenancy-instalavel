//! A sonda do Tenancy: só teste. Diz em que pacote e motor está rodando, mede a geometria
//! da tela e, com `--medir`, imprime o resultado na saída padrão e fecha.
use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

#[derive(Serialize)]
struct Info {
    versao: String,
    runtime: String,
    flatpak: bool,
    medir: bool,
}

/// `--medir` em qualquer posição dos argumentos.
pub fn pede_medicao<I: IntoIterator<Item = String>>(args: I) -> bool {
    args.into_iter().any(|a| a == "--medir")
}

/// O runtime do Flatpak, lido do `/.flatpak-info` (linha `runtime=`). Fora do Flatpak, vazio.
pub fn runtime_do_flatpak(info: &str) -> String {
    info.lines()
        .find_map(|l| l.strip_prefix("runtime="))
        .unwrap_or("")
        .trim()
        .to_string()
}

#[tauri::command]
fn info(app: tauri::AppHandle) -> Info {
    let flatpak_info = std::fs::read_to_string("/.flatpak-info").unwrap_or_default();
    Info {
        versao: app.package_info().version.to_string(),
        runtime: runtime_do_flatpak(&flatpak_info),
        flatpak: std::env::var_os("FLATPAK_ID").is_some(),
        medir: pede_medicao(std::env::args()),
    }
}

#[tauri::command]
fn imprimir_e_sair(app: tauri::AppHandle, json: String) {
    println!("{json}");
    app.exit(0);
}

fn bandeja(app: &tauri::App) -> tauri::Result<()> {
    let abrir = MenuItem::with_id(app, "abrir", "Abrir a sonda", true, None::<&str>)?;
    let sair = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &sair])?;
    let mut construtor = TrayIconBuilder::new()
        .tooltip("Sonda do Tenancy (teste)")
        .menu(&menu)
        .on_menu_event(|app, evento| match evento.id.as_ref() {
            "abrir" => {
                if let Some(janela) = app.get_webview_window("principal") {
                    let _ = janela.show();
                    let _ = janela.set_focus();
                }
            }
            "sair" => app.exit(0),
            _ => {}
        });
    if let Some(icone) = app.default_window_icon() {
        construtor = construtor.icon(icone.clone());
    }
    construtor.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if !pede_medicao(std::env::args()) {
                if let Err(erro) = bandeja(app) {
                    eprintln!("bandeja indisponível: {erro}");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![info, imprimir_e_sair])
        .run(tauri::generate_context!())
        .expect("a sonda não abriu");
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn medir_em_qualquer_posicao() {
        let args = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(pede_medicao(args(&["tenancy-sonda", "--medir"])));
        assert!(pede_medicao(args(&["tenancy-sonda", "--outro", "--medir"])));
        assert!(!pede_medicao(args(&["tenancy-sonda"])));
        assert!(!pede_medicao(args(&["tenancy-sonda", "--medir-tudo"])));
    }

    #[test]
    fn runtime_do_arquivo_do_flatpak() {
        let info = "[Application]\nname=com.novasce.TenancySonda\nruntime=runtime/org.gnome.Platform/x86_64/51\n";
        assert_eq!(runtime_do_flatpak(info), "runtime/org.gnome.Platform/x86_64/51");
        assert_eq!(runtime_do_flatpak(""), "");
    }
}
