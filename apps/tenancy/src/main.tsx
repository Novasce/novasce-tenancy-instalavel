import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { rodarAutoteste } from "./autoteste/roteiro";
import { criarTerminalXterm } from "./bancada/terminal";
import { preferenciasDoNavegador } from "./casca/preferencias";
import { maoDoApp } from "./mao";
import { imprimirESair, info } from "./ponte";
import "./estilo.css";

async function iniciar() {
  const i = await info();
  if (i.autoteste) {
    const tema = i.tema === "escuro" ? "escuro" : "claro";
    document.documentElement.dataset.tema = tema;
    const saida = await rodarAutoteste({ criarTerminal: criarTerminalXterm, tema }).catch((e: unknown) => ({ erro: String(e) }));
    await imprimirESair(JSON.stringify(saida));
    return;
  }
  createRoot(document.getElementById("raiz")!).render(
    <StrictMode>
      <App mao={maoDoApp()} preferencias={preferenciasDoNavegador()} />
    </StrictMode>,
  );
}

void iniciar();
