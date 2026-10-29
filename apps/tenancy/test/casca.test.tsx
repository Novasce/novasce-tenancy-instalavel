import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { ESTADOS_DA_TELA } from "../src/casca/estado";
import { maoDeEnsaio } from "../src/mao/ensaio";
import { Bancada } from "../src/bancada/bancada";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

function navegacao(raiz: HTMLElement): string[] {
  return Array.from(raiz.querySelectorAll("[data-regiao=navegacao] button")).map((b) => b.textContent?.trim() ?? "");
}

describe("casca do app (E1, IN04, UC53)", () => {
  it("de fábrica a navegação mostra Agentes e Ajustes, sem Bancada, e abre em Agentes", async () => {
    m = await montar(<App mao={maoDeEnsaio()} preferencias={preferenciasNaMemoria()} criarTerminal={criarHeadless} />);
    expect(navegacao(m.raiz)).toEqual(["Agentes", "Ajustes"]);
    expect(m.raiz.querySelector("[data-regiao=sessoes]")).toBeNull();
    expect(m.raiz.querySelector("[data-pagina]")?.getAttribute("data-pagina")).toBe("agentes");
    expect(m.raiz.querySelector("[data-regiao=lateral]")?.getAttribute("data-largura")).toBe("228");
  });

  it("nenhum item da 0.2 aparece, nem como em breve", async () => {
    m = await montar(<App mao={maoDeEnsaio()} preferencias={preferenciasNaMemoria({ modoAvancado: true })} criarTerminal={criarHeadless} />);
    for (const t of ["Início", "Mesa", "Rotinas", "Entrada", "Notas", "Em breve", "em breve"]) expect(m.textos()).not.toContain(t);
  });

  it("ligar o modo avançado em Ajustes mostra a Bancada e o bloco das sessões", async () => {
    const preferencias = preferenciasNaMemoria();
    m = await montar(<App mao={maoDeEnsaio()} preferencias={preferencias} criarTerminal={criarHeadless} />);
    await m.clicar("Ajustes");
    await m.clicar(/Modo avançado/);
    expect(navegacao(m.raiz)).toEqual(["Agentes", "Bancada", "Ajustes"]);
    expect(m.raiz.querySelector("[data-regiao=sessoes]")).not.toBeNull();
    expect(m.textos()).toContain("SESSÕES");
    expect(m.temBotao("Para continuar")).toBe(true);
    expect(m.temBotao("Trabalho fora da main")).toBe(true);
    expect(m.temBotao("Nova sessão")).toBe(true);
    expect(preferencias.ler().modoAvancado).toBe(true);
  });

  it("desligar com sessão aberta avisa e só esconde: nada é encerrado", async () => {
    const mao = maoDeEnsaio();
    const preferencias = preferenciasNaMemoria({ modoAvancado: true });
    const bancada = new Bancada(mao);
    const aberta = await bancada.abrir({ programa: "shell", pasta: "/home/lia/Brain" });
    m = await montar(<App mao={mao} preferencias={preferencias} bancada={bancada} criarTerminal={criarHeadless} />);
    await m.clicar("Ajustes");
    await m.clicar(/Modo avançado/);
    expect(m.textos()).toMatch(/continua aberta|continuam abertas/);
    expect(navegacao(m.raiz)).toEqual(["Agentes", "Bancada", "Ajustes"]);
    await m.clicar("Esconder a Bancada");
    expect(navegacao(m.raiz)).toEqual(["Agentes", "Ajustes"]);
    expect(mao.ensaio.sinais).toEqual([]);
    expect(mao.ensaio.vivo(aberta.terminal!.id)).toBe(true);
    expect(bancada.abertas().map((x) => x.id)).toEqual([aberta.id]);
    expect(preferencias.ler().modoAvancado).toBe(false);
  });

  it("os seis estados da tela saem de um componente só, na mesma área reservada", async () => {
    expect(ESTADOS_DA_TELA).toEqual(["carregando", "vazio", "erro", "sem-permissao", "offline", "desatualizado"]);
    const { EstadoDaTela } = await import("../src/casca/estado");
    for (const estado of ESTADOS_DA_TELA) {
      m = await montar(<EstadoDaTela estado={estado} titulo="Título de exemplo" texto="Texto de exemplo" />);
      const area = m.raiz.querySelector("[data-regiao=estado]");
      expect(area?.getAttribute("data-estado")).toBe(estado);
      expect(area?.className).toBe("estado-da-tela");
      m.desmontar();
      m = null;
    }
  });

  it("tema claro, escuro e sistema marcam a raiz do documento", async () => {
    const preferencias = preferenciasNaMemoria();
    m = await montar(<App mao={maoDeEnsaio()} preferencias={preferencias} criarTerminal={criarHeadless} />);
    expect(document.documentElement.dataset.tema).toBe("claro");
    await m.clicar("Ajustes");
    await m.clicar("Escuro");
    expect(document.documentElement.dataset.tema).toBe("escuro");
    await m.clicar("Sistema");
    expect(document.documentElement.dataset.tema).toBe("sistema");
    expect(preferencias.ler().tema).toBe("sistema");
  });
});
