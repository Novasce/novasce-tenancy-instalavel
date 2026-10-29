// Os comandos do app só valem com permissão: a janela `principal` recebe as
// dela na capacidade; a janela `agentes` (página do web) não recebe nenhuma.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["tipo_da_mao", "info", "imprimir_e_sair", "abrir_agentes"]),
    ))
    .expect("o build do Tenancy falhou");
}
