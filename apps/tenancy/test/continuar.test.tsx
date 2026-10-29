// Para continuar abre sessão (E7, RC01, VL09), pela tela, com os casos CP-CON.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Bancada } from "../src/bancada/bancada";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio, type MaoDeEnsaio, type OpcoesDoEnsaio } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

type Caso = { id: string; entrada: any; esperado: any };
const casos = import.meta.glob<Caso>("../../../casos-de-prova/continuar/*.json", { eager: true, import: "default" });
const por = (id: string) => Object.values(casos).find((c) => c.id === id)!;

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

const BRAIN = "/home/lia/Brain";
const A = `${BRAIN}/continuar/a-continuar`;
const C = `${BRAIN}/continuar/continuados`;

async function cena(o: OpcoesDoEnsaio = {}): Promise<{ mao: MaoDeEnsaio; bancada: Bancada; m: Montado }> {
  const mao = maoDeEnsaio(o);
  const bancada = new Bancada(mao, () => Date.parse("2026-10-28T12:00:00-03:00"));
  const montado = await montar(
    <App mao={mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={bancada} criarTerminal={criarHeadless} semRelogio />,
  );
  m = montado;
  await montado.clicar("Para continuar");
  return { mao, bancada, m: montado };
}

const cartoes = (raiz: HTMLElement) => Array.from(raiz.querySelectorAll<HTMLElement>("[data-pasta]")).map((c) => c.getAttribute("data-pasta"));
const cartao = (raiz: HTMLElement, nome: string) => raiz.querySelector<HTMLElement>(`[data-pasta$="/${nome}"]`)!;

async function clicarEm(c: HTMLElement, rotulo: string) {
  const b = Array.from(c.querySelectorAll("button")).find((x) => x.textContent === rotulo);
  if (!b) throw new Error(`sem ${rotulo}`);
  await act(async () => {
    b.click();
  });
  await m!.esperar();
}

describe("Para continuar (E7)", () => {
  it("CP-CON-01: a lista dos brains sem pasta repetida, continuados as 60 mais novas por brain", async () => {
    const caso = por("CP-CON-01");
    const { m } = await cena({ arquivos: caso.entrada.arquivos, links: caso.entrada.links, espacos: caso.entrada.brains.slice(1), soEstesArquivos: true });
    expect(cartoes(m.raiz)).toEqual(caso.esperado.aContinuar);
    await m.clicar("Continuados");
    expect(cartoes(m.raiz)).toHaveLength(caso.esperado.continuados.quantos);
    expect(cartoes(m.raiz).slice(0, caso.esperado.continuados.primeiros.length)).toEqual(caso.esperado.continuados.primeiros);
  });

  it("CP-CON-02, 03 e 09: o LEIA diz onde parou e o que espera, com \\r\\n como uma quebra só", async () => {
    const leia03 = por("CP-CON-03").entrada.leia;
    const leia09 = por("CP-CON-09").entrada.leia;
    const { m } = await cena({
      arquivos: {
        [`${A}/2026-10-28 Peça - três/LEIA.txt`]: leia03,
        [`${A}/2026-10-28 Peça - três/prompt.txt`]: "Siga.\n",
        [`${A}/2026-10-28 Peça - nove/LEIA.txt`]: leia09,
        [`${A}/2026-10-28 Peça - nove/prompt.txt`]: "Siga.\n",
      },
      soEstesArquivos: true,
    });
    const tres = cartao(m.raiz, "2026-10-28 Peça - três");
    expect(tres.querySelector("[data-regiao=onde-parou]")?.textContent).toBe(por("CP-CON-03").esperado.ondeParou.join(" "));
    expect(Array.from(tres.querySelectorAll("[data-regiao=espera] li")).map((l) => l.textContent)).toEqual(por("CP-CON-03").esperado.oQueEspera);
    const nove = cartao(m.raiz, "2026-10-28 Peça - nove");
    expect(nove.querySelector("[data-regiao=onde-parou]")?.textContent).toBe("O rascunho está pronto e falta a revisão.");
  });

  it("CP-CON-04 e 05: modelo e esforço do LEIA antes de abrir, conferidos no --help", async () => {
    const leia = por("CP-CON-04").entrada.leia;
    const { mao, m } = await cena({
      arquivos: { [`${A}/2026-10-28 Peça - quatro/LEIA.txt`]: leia, [`${A}/2026-10-28 Peça - quatro/prompt.txt`]: "Siga o passo.\n" },
      soEstesArquivos: true,
    });
    const c = cartao(m.raiz, "2026-10-28 Peça - quatro");
    expect(c.querySelector("[data-regiao=modelo]")?.textContent).toBe("Claude: Opus 5.5 · esforço alto");
    await clicarEm(c, "Abrir…");
    await clicarEm(c, "Abrir");
    const args = mao.ensaio.terminais()[0].pedido.args[2];
    expect(args).toContain("exec claude --model claude-opus-5-5 --effort high ");
    expect(args).toContain("já moveu esta pasta para continuar/continuados/2026-10-28 Peça - quatro/: o primeiro passo está feito.");
  });

  it("CP-CON-05: a CLI que não aceita o esforço abre no padrão e avisa", async () => {
    const leia = por("CP-CON-04").entrada.leia;
    const { mao, m } = await cena({
      arquivos: { [`${A}/2026-10-28 Peça - cinco/LEIA.txt`]: leia, [`${A}/2026-10-28 Peça - cinco/prompt.txt`]: "Siga.\n" },
      soEstesArquivos: true,
      clis: { codex: { versao: "codex 9", ajuda: "Usage: codex [options]\n  -m, --model <MODEL>\n" } },
    });
    const c = cartao(m.raiz, "2026-10-28 Peça - cinco");
    await clicarEm(c, "Abrir…");
    await clicarEm(c, "codex");
    await clicarEm(c, "Abrir");
    expect(mao.ensaio.terminais()[0].pedido.args[2]).toMatch(/^exec codex -m gpt-x '/);
    expect(m.raiz.querySelector("[data-regiao=recado]")?.textContent).toContain("O codex deste computador não aceita o esforço pela linha de comando: ficou o padrão dele.");
  });

  it("CP-CON-06: abrir move para continuados antes da CLI; CLI ausente não move e aponta a ficha", async () => {
    const { mao, m } = await cena();
    const c = cartao(m.raiz, "2026-10-28 Ateliê - peça A");
    await clicarEm(c, "Abrir…");
    await clicarEm(c, "agy");
    await clicarEm(c, "Abrir");
    expect(mao.ensaio.arquivos.existe(`${A}/2026-10-28 Ateliê - peça A`)).toBe(true);
    expect(m.raiz.querySelector("[data-regiao=recado]")?.textContent).toContain("O agy não está instalado neste computador");
    await clicarEm(cartao(m.raiz, "2026-10-28 Ateliê - peça A"), "Abrir…");
    await clicarEm(cartao(m.raiz, "2026-10-28 Ateliê - peça A"), "Abrir");
    expect(mao.ensaio.arquivos.existe(`${C}/2026-10-28 Ateliê - peça A/prompt.txt`)).toBe(true);
    expect(mao.ensaio.arquivos.existe(`${A}/2026-10-28 Ateliê - peça A`)).toBe(false);
    expect(m.raiz.querySelector("[data-pagina=bancada]")).not.toBeNull();
  });

  it("CP-CON-07: copiar não move; voltar de continuados com nome tomado ganha ' 2' e avisa a sessão aberta", async () => {
    const { mao, bancada, m } = await cena({
      arquivos: {
        [`${A}/2026-10-28 Produto A - passo 2/prompt.txt`]: "Outro.\n",
        [`${A}/2026-10-28 Produto A - passo 1/prompt.txt`]: "Siga o passo 1.\n",
        [`${C}/2026-10-28 Produto A - passo 2/prompt.txt`]: "Siga o passo 2.\n",
      },
      soEstesArquivos: true,
    });
    await clicarEm(cartao(m.raiz, "2026-10-28 Produto A - passo 1"), "Copiar prompt");
    expect(mao.ensaio.copiado).toBe("Siga o passo 1.\n");
    expect(mao.ensaio.arquivos.existe(`${A}/2026-10-28 Produto A - passo 1`)).toBe(true);

    await clicarEm(cartao(m.raiz, "2026-10-28 Produto A - passo 1"), "Abrir…");
    await clicarEm(cartao(m.raiz, "2026-10-28 Produto A - passo 1"), "Abrir");
    expect(bancada.abertas()).toHaveLength(1);
    await m.clicar("Para continuar");
    await m.clicar("Continuados");
    await clicarEm(cartao(m.raiz, "2026-10-28 Produto A - passo 2"), "Voltar para a-continuar");
    expect(mao.ensaio.arquivos.existe(`${A}/2026-10-28 Produto A - passo 2 2/prompt.txt`)).toBe(true);
    await clicarEm(cartao(m.raiz, "2026-10-28 Produto A - passo 1"), "Voltar para a-continuar");
    expect(m.raiz.querySelector("[data-regiao=recado]")?.textContent).toContain("segue aberta");
  });

  it("CP-CON-08: em-espera aparece à parte, com o LEIA, sem Abrir sessão", async () => {
    const caso = por("CP-CON-08");
    const { m } = await cena({ arquivos: caso.entrada.arquivos, links: caso.entrada.links, soEstesArquivos: true });
    await m.clicar("Em espera");
    const c = cartao(m.raiz, caso.esperado.emEspera[0].pasta.split("/").pop());
    expect(c.querySelector("[data-regiao=onde-parou]")?.textContent).toBe(caso.esperado.emEspera[0].ondeParou.join(" "));
    expect(Array.from(c.querySelectorAll("button")).map((b) => b.textContent)).not.toContain("Abrir…");
  });
});
