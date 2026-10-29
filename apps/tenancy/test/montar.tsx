// Montagem pequena para os testes da tela, sem biblioteca: React no jsdom com act.
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Montado {
  raiz: HTMLElement;
  textos(): string;
  botao(nome: string | RegExp): HTMLButtonElement;
  temBotao(nome: string | RegExp): boolean;
  clicar(nome: string | RegExp): Promise<void>;
  digitar(campo: HTMLInputElement | HTMLTextAreaElement, valor: string): Promise<void>;
  esperar(): Promise<void>;
  desmontar(): void;
}

function bate(texto: string, nome: string | RegExp): boolean {
  const t = texto.replace(/\s+/g, " ").trim();
  return typeof nome === "string" ? t === nome : nome.test(t);
}

export async function montar(elemento: ReactElement): Promise<Montado> {
  const raiz = document.createElement("div");
  document.body.appendChild(raiz);
  let root: Root;
  await act(async () => {
    root = createRoot(raiz);
    root.render(elemento);
  });
  const botoes = () => Array.from(raiz.querySelectorAll<HTMLButtonElement>("button"));
  const rotulo = (b: HTMLButtonElement) => b.getAttribute("aria-label") ?? b.textContent ?? "";
  const m: Montado = {
    raiz,
    textos: () => raiz.textContent ?? "",
    botao(nome) {
      const b = botoes().find((x) => bate(rotulo(x), nome));
      if (!b) throw new Error(`sem o botão ${String(nome)}; há: ${botoes().map(rotulo).join(" | ")}`);
      return b;
    },
    temBotao: (nome) => botoes().some((x) => bate(rotulo(x), nome)),
    async clicar(nome) {
      const b = m.botao(nome);
      await act(async () => {
        b.click();
      });
      await m.esperar();
    },
    async digitar(campo, valor) {
      await act(async () => {
        const proto = Object.getPrototypeOf(campo);
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(campo, valor);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    async esperar() {
      for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
    },
    desmontar() {
      act(() => root.unmount());
      raiz.remove();
    },
  };
  await m.esperar();
  return m;
}
