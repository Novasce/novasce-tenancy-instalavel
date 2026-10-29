//! A mão do host do lado do Rust. Na Parte E não há mão de verdade: a tela usa
//! a de ensaio. A Parte F liga aqui a do caminho (flatpak, ajudante ou direta),
//! sobre o crate `maos-host`.

/// Qual mão este app traz. Lido pela tela para mostrar o modo de ensaio.
#[tauri::command]
pub fn tipo_da_mao() -> &'static str {
    "ensaio"
}

#[cfg(test)]
mod testes {
    #[test]
    fn sem_mao_de_verdade_na_parte_e() {
        assert_eq!(super::tipo_da_mao(), "ensaio");
    }
}
