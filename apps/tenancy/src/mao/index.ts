// Qual mão o app usa. Na Parte E só existe a de ensaio; a do caminho escolhido
// pelos portões (Flatpak, ajudante ou direta) entra na Parte F, aqui.
import { maoDeEnsaio } from "./ensaio";
import type { MaoDoHost } from "./tipos";
import { noTauri } from "../ponte";

export type { MaoDoHost } from "./tipos";

export function maoDoApp(): MaoDoHost {
  const mao = maoDeEnsaio();
  if (!noTauri()) return mao;
  // Na janela do app, fechar pela moldura pergunta antes (UC22) e sair fecha de verdade.
  void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
    void getCurrentWindow().onCloseRequested((e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("tenancy:sair"));
    });
  });
  return {
    ...mao,
    async sair() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().destroy();
    },
    async abrirNoNavegador(url) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    },
    async copiar(texto) {
      await navigator.clipboard.writeText(texto);
    },
  };
}
