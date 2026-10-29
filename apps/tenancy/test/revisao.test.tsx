// Os achados da revisão do PR (E10), cada um com o teste que falhava antes.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Bancada, pedidoDeTerminal } from "../src/bancada/bancada";
import { bancoNaMemoria } from "../src/bancada/banco";
import { mesclar, perguntaDeWorktree } from "../src/bancada/guardas";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio, repoNovo } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

const REPO = "/home/lia/Brain/repos/atelie-site";
const relogio = { agora: Date.parse("2026-10-28T12:00:00-03:00") };

describe("revisão do PR", () => {
  it("comando livre roda inteiro no shell, sem exec na frente (ver o diff, ver os commits)", () => {
    const p = pedidoDeTerminal(
      { id: "s1", programa: "comando", pasta: REPO, comando: "git status; git --no-pager diff --stat; exec $SHELL -l" },
      { shell: "/bin/bash", lang: "pt_BR.UTF-8", escuro: false, colunas: 80, linhas: 24 },
    );
    expect(p.args).toEqual(["-l", "-c", "git status; git --no-pager diff --stat; exec $SHELL -l"]);
  });

  it("encerrar leva o painel dividido junto e libera dividir de novo", async () => {
    const mao = maoDeEnsaio();
    const b = new Bancada(mao, () => relogio.agora, undefined, (ms) => mao.ensaio.esperar(ms));
    const s = await b.abrir({ programa: "shell", pasta: "/home/lia/Brain" });
    await b.dividir(s.id);
    const extra = s.extra!;
    await b.encerrar([s.id]);
    expect(mao.ensaio.vivo(extra.id)).toBe(false);
    expect(b.sessao(s.id)!.extra).toBeFalsy();
  });

  it("merge com conflito desfaz o merge na pasta principal e diz que nada mudou", async () => {
    const mao = maoDeEnsaio({
      repos: [repoNovo("atelie-site", { branches: { main: { commitsForaDaMain: 0, data: 1, assunto: "" }, "sessao-1-2026-10-28": { commitsForaDaMain: 1, data: 2, assunto: "", conflito: true } } })],
    });
    const b = new Bancada(mao, () => relogio.agora);
    expect(await mesclar(b, REPO, "sessao-1-2026-10-28")).toBe(false);
    expect(mao.ensaio.gits.map((g) => g.args.join(" "))).toContain("merge --abort");
    expect(mao.ensaio.repos[REPO].mergeEmCurso).toBe(false);
    expect(b.recadoAtual?.texto).toBe("Não mesclou: o git recusou (conflito). Nada mudou na main; a branch sessao-1-2026-10-28 ficou.");
  });

  it("a sessão que não sobe sai da lista, com o recado, e a folha volta a abrir", async () => {
    const mao = maoDeEnsaio();
    const abrir = mao.terminal.abrir;
    mao.terminal.abrir = async () => {
      throw new Error("a pasta não existe");
    };
    const b = new Bancada(mao, () => relogio.agora);
    m = await montar(<App mao={mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={b} criarTerminal={criarHeadless} semRelogio />);
    await m.clicar("Nova sessão");
    await m.clicar("Abrir");
    expect(b.sessoes()).toHaveLength(0);
    expect(m.raiz.querySelector("[data-regiao=recado]")?.textContent).toContain("A sessão não abriu: a pasta não existe");
    expect(m.botao("Abrir").disabled).toBe(false);
    mao.terminal.abrir = abrir;
  });

  it("retomar conta de quando a sessão fechou, não de quando abriu", async () => {
    const mao = maoDeEnsaio();
    const banco = bancoNaMemoria();
    const b = new Bancada(mao, () => relogio.agora, banco, (ms) => mao.ensaio.esperar(ms));
    const s = await b.abrir({ programa: "claude", pasta: "/home/lia/Brain" });
    relogio.agora += 10 * 24 * 3600 * 1000;
    await b.encerrar([s.id]);
    relogio.agora += 4 * 60 * 1000;
    const depois = new Bancada(mao, () => relogio.agora, banco);
    await depois.restaurar();
    expect(depois.sessoes()[0].pendencia).toEqual({ tipo: "retomar", fechadaEm: relogio.agora - 4 * 60 * 1000 });
  });

  it("fechar pelo menu pergunta antes de encerrar um agente; durante o encerrando não fecha duas vezes", async () => {
    const mao = maoDeEnsaio();
    const b = new Bancada(mao, () => relogio.agora, undefined, (ms) => mao.ensaio.esperar(ms));
    const s = await b.abrir({ programa: "claude", pasta: "/home/lia/Brain" });
    m = await montar(<App mao={mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={b} criarTerminal={criarHeadless} semRelogio />);
    await act(async () => {
      m!.raiz.querySelector(`[data-sessao="${s.id}"]`)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    await m.clicar("Fechar a sessão");
    expect(b.sessao(s.id)!.terminal).not.toBeNull();
    expect(b.sessao(s.id)!.pendencia).toEqual({ tipo: "encerrar" });
    b.mudarEstado(s.id, "encerrando");
    await act(async () => {
      m!.raiz.querySelector(`[data-sessao="${s.id}"]`)!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    expect(m.botao("Fechar a sessão").disabled).toBe(true);
  });

  it("espaço registrado nunca pergunta worktree", async () => {
    const ESPACO = "/home/lia/Espaços/Ateliê de exemplo";
    const mao = maoDeEnsaio({ repos: [repoNovo("x", { pasta: ESPACO })], espacos: [ESPACO] });
    const b = new Bancada(mao, () => relogio.agora);
    await b.abrir({ programa: "claude", pasta: ESPACO });
    expect(await perguntaDeWorktree(b, ESPACO)).toBeNull();
  });

  it("a frase do fora da main usa a principal do repositório", async () => {
    const WT = `${REPO}/.worktrees/sessao-1-2026-10-28`;
    const mao = maoDeEnsaio({
      repos: [
        repoNovo("atelie-site", {
          principal: "master",
          head: "master",
          branches: { master: { commitsForaDaMain: 0, data: 1, assunto: "" }, "sessao-1-2026-10-28": { commitsForaDaMain: 1, data: 2, assunto: "" } },
          worktrees: { [WT]: { head: "sessao-1-2026-10-28", mergeEmCurso: false, rastreadosMudados: 0, soltos: 1 } },
        }),
      ],
    });
    const b = new Bancada(mao, () => relogio.agora);
    const s = await b.abrir({ programa: "shell", pasta: WT, worktree: { repo: REPO, caminho: WT, branch: "sessao-1-2026-10-28" } });
    await b.encerrar([s.id]);
    expect(b.sessao(s.id)!.pendencia).toEqual({ tipo: "fora-da-main", frase: "sessao-1-2026-10-28 tem 1 commit fora da master. O que fazer com ele?", commits: 1, principal: "master", soltos: 1 });
  });

  it("a janela dos agentes fechada: a casca oferece abrir de novo, com código novo; trazer não manda código", async () => {
    const mao = maoDeEnsaio();
    const abertas: string[] = [];
    m = await montar(
      <App mao={mao} preferencias={preferenciasNaMemoria()} criarTerminal={criarHeadless} semRelogio online={() => true} abrirJanelaDosAgentes={async (u) => void abertas.push(u)} />,
    );
    await m.clicar("Trazer a janela para a frente");
    expect(abertas).toEqual(["agentes-ensaio.html?codigo=codigo-de-ensaio", ""]);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("agentes:fechou"));
    });
    expect(m.textos()).toContain("A janela dos agentes foi fechada.");
    await m.clicar("Abrir os agentes");
    expect(abertas).toHaveLength(3);
    expect(abertas[2]).toContain("codigo=");
  });

  it("Sim, só agora não envia duas vezes e A pergunta mudou some depois de 4 s", async () => {
    const { FaixaDaSuaVez } = await import("../src/bancada/quem-espera");
    expect(FaixaDaSuaVez).toBeTypeOf("function");
    const src = await import("../src/bancada/quem-espera?raw");
    expect(String((src as { default: string }).default)).toContain("4_000");
  });

  it("nenhuma tela fala em parte do projeto", async () => {
    const src = await import("../src/App?raw");
    expect(String((src as { default: string }).default)).not.toContain("próxima parte");
  });
});
