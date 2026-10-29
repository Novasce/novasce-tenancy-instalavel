// Atualizar sem fechar (UC50) e o roteiro do autoteste (E9).
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { roteiroDoAutoteste, rodarAutoteste } from "../src/autoteste/roteiro";
import { Bancada } from "../src/bancada/bancada";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio, repoNovo } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

describe("atualizar sem fechar (UC50)", () => {
  it("a versão nova diz quantas sessões terminam e o que tem mudança não gravada; Depois não fecha nada", async () => {
    const REPO = "/home/lia/Brain/repos/atelie-site";
    const mao = maoDeEnsaio({ repos: [repoNovo("atelie-site", { soltos: 2 }), repoNovo("atelie-api")] });
    const bancada = new Bancada(mao, () => Date.parse("2026-10-28T12:00:00-03:00"));
    await bancada.abrir({ programa: "claude", pasta: REPO });
    await bancada.abrir({ programa: "shell", pasta: "/home/lia/Brain/repos/atelie-api" });
    m = await montar(<App mao={mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={bancada} criarTerminal={criarHeadless} semRelogio />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("tenancy:versao-nova"));
    });
    await m.esperar();
    const faixa = m.raiz.querySelector("[data-regiao=atualizar]")?.textContent ?? "";
    expect(faixa).toContain("Há uma versão nova pronta. Reabrir encerra 2 sessões.");
    expect(faixa).toContain("Mudança não gravada em repos/atelie-site.");
    expect(faixa).not.toMatch(/\d+\.\d+/);
    await m.clicar("Depois");
    expect(m.raiz.querySelector("[data-regiao=atualizar]")).toBeNull();
    expect(bancada.abertas()).toHaveLength(2);
    expect(mao.ensaio.saiu).toBe(false);
  });

  it("no caminho da imagem do sistema, vale depois de reiniciar o computador", async () => {
    const mao = maoDeEnsaio();
    m = await montar(<App mao={mao} preferencias={preferenciasNaMemoria()} criarTerminal={criarHeadless} semRelogio />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("tenancy:versao-nova", { detail: { aoReiniciar: true } }));
    });
    await m.esperar();
    expect(m.raiz.querySelector("[data-regiao=atualizar]")?.textContent).toContain("A versão nova vale quando o computador reiniciar.");
    expect(m.temBotao("Encerrar e reabrir")).toBe(false);
  });
});

describe("autoteste de geometria (E9)", () => {
  it("o roteiro cobre todas as telas e estados da 0.1, as quatro medidas e os dois temas", () => {
    const r = roteiroDoAutoteste();
    expect(r.janelas).toEqual([
      { largura: 1024, altura: 728 },
      { largura: 1264, altura: 728 },
    ]);
    expect(r.escalas).toEqual([1, 1.25]);
    expect(r.temas).toEqual(["claro", "escuro"]);
    for (const p of ["agentes", "ajustes", "bancada", "nova-sessao", "para-continuar", "fora-da-main"]) expect(r.paginas).toContain(p);
    for (const e of ["abrindo", "trabalhando", "livre", "pediu-permissao", "terminou", "parada", "sem-resposta", "encerrada"]) expect(r.estados).toContain(e);
    for (const e of ["carregando", "vazio", "erro", "sem-permissao", "offline", "desatualizado"]) expect(r.estadosDaTela).toContain(e);
    expect(r.sessoesNaLista).toBe(300);
    expect(r.linhasNoTerminal).toBe(10_000);
  });

  it("roda no jsdom com a mão de ensaio e devolve o JSON com cada ação medida", async () => {
    const saida = await rodarAutoteste({ criarTerminal: criarHeadless, esperar: async () => {}, tema: "claro" });
    expect(saida.mao).toBe("ensaio");
    expect(saida.acoes.length).toBe(31);
    for (const nome of ["pagina: bancada", "estado: pediu-permissao", "troca de sessão", "foco: Nova sessão", "lista: 300 sessões", "estado da tela: offline"]) {
      expect(saida.acoes.map((a: { nome: string }) => a.nome)).toContain(nome);
    }
    expect(saida.lista300.linhasDesenhadas).toBeLessThan(60);
    expect(saida.terminal10k.linhas).toBe(10_000);
    expect(typeof saida.terminal10k.ms).toBe("number");
    expect(saida.maiorDeslocamento).toBe(0);
  });
});
