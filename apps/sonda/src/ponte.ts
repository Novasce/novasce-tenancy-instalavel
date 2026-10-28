// A ponte com o Tauri. Fora dele (navegador, testes), devolve valores de exemplo.
import { invoke } from "@tauri-apps/api/core";

export type Info = { versao: string; runtime: string; flatpak: boolean; medir: boolean };

export const REPOSITORIO = "https://github.com/Novasce/novasce-tenancy-instalavel";

function noTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function info(): Promise<Info> {
  if (!noTauri()) return { versao: "navegador", runtime: "", flatpak: false, medir: false };
  return invoke<Info>("info");
}

export async function imprimirESair(json: string): Promise<void> {
  if (!noTauri()) {
    console.log(json);
    return;
  }
  await invoke("imprimir_e_sair", { json });
}

export async function abrirRepositorio(): Promise<void> {
  if (!noTauri()) {
    window.open(REPOSITORIO, "_blank", "noopener");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(REPOSITORIO);
}
