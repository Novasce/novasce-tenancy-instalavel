// O terminal na tela é o xterm.js. A Bancada só usa esta parte dele, para o
// teste poder trocar pelo xterm headless (o mesmo buffer, sem DOM).
import * as xterm from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { BufferDeTerminal } from "./tela";

export interface Desligar {
  dispose(): void;
}

export interface TerminalDaTela extends BufferDeTerminal {
  readonly cols: number;
  readonly rows: number;
  /** Desenha dentro do elemento; o headless não desenha. */
  abrirEm(el: HTMLElement): void;
  write(dados: string, feito?: () => void): void;
  onData(f: (dados: string) => void): Desligar;
  onBell(f: () => void): Desligar;
  resize(colunas: number, linhas: number): void;
  /** Cola pelo caminho do terminal (bracketed paste quando o programa pediu). */
  paste(texto: string): void;
  focus(): void;
  dispose(): void;
}

export type CriarTerminal = (o: { escuro: boolean }) => TerminalDaTela;

/** O xterm.js de verdade, carregado só na janela do app. */
export const criarTerminalXterm: CriarTerminal = (o) => {
  const { Terminal } = xterm;
  const t = new Terminal({
    fontFamily: 'ui-monospace, "Noto Sans Mono", "DejaVu Sans Mono", monospace',
    fontSize: 13,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 10_000,
    theme: o.escuro ? { background: "#1e1e20", foreground: "#f2f2f4" } : { background: "#ffffff", foreground: "#1d1d1f" },
  });
  return Object.assign(t, {
    abrirEm: (el: HTMLElement) => t.open(el),
  }) as unknown as TerminalDaTela;
};
