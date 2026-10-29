import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { maoDoApp } from "./mao";
import { preferenciasDoNavegador } from "./casca/preferencias";
import "./estilo.css";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App mao={maoDoApp()} preferencias={preferenciasDoNavegador()} />
  </StrictMode>,
);
