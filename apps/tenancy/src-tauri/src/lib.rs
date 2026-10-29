//! O app Tenancy. A janela `principal` é a casca local; a mão do host do
//! caminho escolhido pelos portões entra na Parte F, em `mao`.

pub mod mao;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![mao::tipo_da_mao])
        .run(tauri::generate_context!())
        .expect("o Tenancy não abriu");
}
