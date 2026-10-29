// A lista de sessões (E4, VL01 e VL04) com a mão de ensaio.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Bancada } from "../src/bancada/bancada";
import { bancoNaMemoria } from "../src/bancada/banco";
import { ALTURA_DA_LINHA, detalheDaSessao } from "../src/bancada/lista/ListaDeSessoes";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio, repoNovo } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

const REPO = "/home/lia/Brain/repos/atelie-site";
const WT = `${REPO}/.worktrees/sessao-3-2026-10-28`;

async function bancadaCom(n: number, o: { comWorktree?: boolean } = {}) {
  const mao = maoDeEnsaio(
    o.comWorktree
      ? {
          repos: [
            repoNovo("atelie-site", {
              pasta: REPO,
              branches: {
                main: { commitsForaDaMain: 0, data: 1, assunto: "" },
                "sessao-3-2026-10-28": { commitsForaDaMain: 2, data: 2, assunto: "Peça de exemplo" },
              },
              worktrees: { [WT]: { head: "sessao-3-2026-10-28", mergeEmCurso: false, rastreadosMudados: 0, soltos: 0 } },
            }),
          ],
        }
      : {},
  );
  const banco = bancoNaMemoria();
  const bancada = new Bancada(mao, () => Date.parse("2026-10-28T12:00:00Z"), banco, (ms) => mao.ensaio.esperar(ms));
  for (let i = 1; i <= n; i++) {
    const comWt = o.comWorktree && i === 3;
    await bancada.abrir({
      programa: i % 3 === 0 ? "claude" : i % 3 === 1 ? "shell" : "codex",
      pasta: comWt ? WT : `/home/lia/Brain/repos/peca-${i}`,
      nome: `Peça ${i}`,
      worktree: comWt ? { repo: REPO, caminho: WT, branch: "sessao-3-2026-10-28" } : undefined,
    });
  }
  return { mao, bancada, banco };
}

async function montarBancada(bancada: Bancada) {
  return montar(<App mao={bancada.mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={bancada} criarTerminal={criarHeadless} />);
}

const linhas = (raiz: HTMLElement) => Array.from(raiz.querySelectorAll<HTMLElement>("[data-sessao]"));
const nomes = (raiz: HTMLElement) => linhas(raiz).map((l) => l.querySelector(".nome-da-sessao")?.textContent);

describe("lista de sessões (E4)", () => {
  it("a linha tem o ponto de 12 px, o nome e o programa; quem espera mostra sua vez", async () => {
    const { bancada } = await bancadaCom(3);
    const [, , claude] = bancada.sessoes();
    bancada.mudarEstado(claude.id, "terminou");
    m = await montarBancada(bancada);
    const [l1, , l3] = linhas(m.raiz);
    expect(l1.querySelector(".ponto")?.getAttribute("data-estado")).toBe("terminal");
    expect(l1.querySelector(".direita")?.textContent).toBe("shell");
    expect(l3.querySelector(".direita")?.textContent).toBe("sua vez");
    expect(l3.querySelector(".direita")?.className).toContain("ambar");
    expect(l3.getAttribute("title")).toBe("terminou há 0 s · espera você");
  });

  it("subir e descer pela tecla e pelo menu, gravado no banco", async () => {
    const { bancada, banco } = await bancadaCom(3);
    m = await montarBancada(bancada);
    const segunda = linhas(m.raiz)[1];
    await act(async () => {
      segunda.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", ctrlKey: true, altKey: true, bubbles: true }));
    });
    expect(nomes(m.raiz)).toEqual(["Peça 2", "Peça 1", "Peça 3"]);
    expect(banco.linhas.sort((a, b) => a.ordem - b.ordem).map((l) => l.nome)).toEqual(["Peça 2", "Peça 1", "Peça 3"]);
    await act(async () => {
      linhas(m!.raiz)[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    expect(m.botao("Subir a sessão").disabled).toBe(true);
    await m.clicar("Descer a sessão");
    expect(nomes(m.raiz)).toEqual(["Peça 1", "Peça 2", "Peça 3"]);
  });

  it("VL04: trinta sessões, buscar, recolher sem mudar a largura", async () => {
    const { bancada } = await bancadaCom(30);
    m = await montarBancada(bancada);
    expect(m.raiz.querySelector("[data-regiao=contagem]")?.textContent).toBe("30 sessões");
    const busca = m.raiz.querySelector<HTMLInputElement>("input[aria-label='Buscar sessão']")!;
    await m.digitar(busca, "peca 2");
    expect(nomes(m.raiz)).toEqual(["Peça 2", "Peça 20", "Peça 21", "Peça 22", "Peça 23", "Peça 24", "Peça 25", "Peça 26", "Peça 27", "Peça 28", "Peça 29"]);
    expect(m.raiz.querySelector("[data-regiao=contagem]")?.textContent).toBe("11 de 30");
    await m.digitar(busca, "");
    const largura = m.raiz.querySelector("[data-regiao=lateral]")?.getAttribute("data-largura");
    await m.clicar("Recolher as sessões");
    expect(linhas(m.raiz)).toHaveLength(0);
    expect(m.raiz.querySelector("[data-regiao=lateral]")?.getAttribute("data-largura")).toBe(largura);
    await m.clicar("Mostrar as sessões");
    expect(linhas(m.raiz).length).toBeGreaterThan(0);
  });

  it("VL04: encerrar várias; a de commit fora da principal fica aberta com a guarda; as fechadas reabrem", async () => {
    const { bancada, mao } = await bancadaCom(4, { comWorktree: true });
    m = await montarBancada(bancada);
    for (const i of [0, 1, 2]) {
      await act(async () => {
        linhas(m!.raiz)[i].dispatchEvent(new MouseEvent("click", { ctrlKey: true, bubbles: true }));
      });
    }
    expect(m.raiz.querySelector("[data-regiao=lote]")?.textContent).toContain("3 selecionadas");
    await m.clicar("Encerrar 3 sessões");
    const [s1, s2, s3] = bancada.sessoes();
    expect(s1.terminal).toBeNull();
    expect(s2.terminal).toBeNull();
    expect(s3.terminal).not.toBeNull();
    expect(s3.pendencia).toEqual({ tipo: "fora-da-main", frase: "sessao-3-2026-10-28 tem 2 commits fora da main. O que fazer com eles?", commits: 2, principal: "main", soltos: 0 });
    expect(linhas(m.raiz)[2].getAttribute("title")).toBe("2 commits fora da main · fechar?");
    expect(mao.ensaio.repos[REPO].branches["sessao-3-2026-10-28"]).toBeDefined();
    expect(linhas(m.raiz)[0].getAttribute("title")).toBe("encerrada · saiu com 129");
    await act(async () => {
      linhas(m!.raiz)[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    await m.clicar("Abrir de novo");
    expect(bancada.sessoes()[0].terminal).not.toBeNull();
  });

  it("trezentas sessões rolam dentro da região, desenhando só as linhas à vista", async () => {
    const { bancada } = await bancadaCom(300);
    m = await montarBancada(bancada);
    const regiao = m.raiz.querySelector<HTMLElement>("[data-rolagem=sessoes]")!;
    expect(regiao).not.toBeNull();
    expect(linhas(m.raiz).length).toBeLessThan(40);
    const trilho = regiao.querySelector<HTMLElement>(".trilho-da-lista")!;
    expect(trilho.style.height).toBe(`${300 * ALTURA_DA_LINHA}px`);
    regiao.scrollTop = 200 * ALTURA_DA_LINHA;
    await act(async () => {
      regiao.dispatchEvent(new Event("scroll"));
    });
    expect(nomes(m.raiz)[0]).toBe("Peça 201");
  });

  it("o detalhe segue a ordem do Mac", () => {
    const base = { id: "s1", nome: "x", nomeManual: false, pasta: "/home/lia/Brain", programa: "claude" as const, criadaEm: 0, ultimaVez: 0, ordem: 0, estadoDesde: 0 };
    const viva = { ...base, terminal: { id: "t", pid: 2, inicio: "1" } };
    const agora = 125_000;
    expect(detalheDaSessao({ ...viva, estado: "encerrando" }, agora)).toBe("encerrando…");
    expect(detalheDaSessao({ ...viva, estado: "pediu-permissao" }, agora)).toBe("pediu permissão há 2 min");
    expect(detalheDaSessao({ ...viva, estado: "sem-resposta" }, agora)).toBe("sem resposta há 2 min · a CLI não mostrou o prompt");
    expect(detalheDaSessao({ ...viva, estado: "abrindo" }, agora)).toBe("abrindo…");
    expect(detalheDaSessao({ ...viva, estado: "livre", ultimaFala: "Resuma as notas" }, agora)).toBe("“Resuma as notas”");
    expect(detalheDaSessao({ ...base, terminal: null, estado: "encerrada" }, agora)).toBe("encerrada");
    expect(detalheDaSessao({ ...viva, estado: "terminal", pendencia: { tipo: "sem-commit", soltos: 3 } }, agora)).toBe("3 sem commit · fechar?");
  });
});
