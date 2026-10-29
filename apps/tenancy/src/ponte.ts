// A ponte com o Tauri, só da janela local. Fora dele (navegador, testes), valores de exemplo.
import { invoke } from "@tauri-apps/api/core";

export interface Info {
  versao: string;
  flatpak: boolean;
  autoteste: boolean;
  tema: string | null;
}

export function noTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function info(): Promise<Info> {
  if (!noTauri()) {
    const q = new URLSearchParams(location.search);
    return { versao: "navegador", flatpak: false, autoteste: q.has("autoteste"), tema: q.get("tema") };
  }
  return invoke<Info>("info");
}

export async function imprimirESair(json: string): Promise<void> {
  if (!noTauri()) {
    console.log(json);
    return;
  }
  await invoke("imprimir_e_sair", { json });
}

/** Abre (ou traz para a frente) a janela `agentes`, que carrega a página do web. */
export async function abrirAgentes(endereco: string): Promise<void> {
  if (!noTauri()) {
    if (endereco) window.open(endereco, "agentes", "noopener");
    return;
  }
  await invoke("abrir_agentes", { endereco });
}

/** A janela `agentes` avisa a casca de cada navegação (para perceber o login do web). */
export async function ouvirNavegacaoDosAgentes(): Promise<void> {
  if (!noTauri()) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<string>("agentes:navegou", (e) => window.dispatchEvent(new CustomEvent("agentes:navegou", { detail: e.payload })));
  await listen("agentes:fechou", () => window.dispatchEvent(new CustomEvent("agentes:fechou")));
}
