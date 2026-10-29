// Guardas, encerrar, órfãos e retomar (E6: UC20, UC22, decisão 11), pela tela,
// com a mão de ensaio: os nove CP-GIT e os quatro CP-PRC chegam à pessoa.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Bancada } from "../src/bancada/bancada";
import { bancoNaMemoria, type LinhaDoBanco } from "../src/bancada/banco";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio, repoNovo, type MaoDeEnsaio, type OpcoesDoEnsaio } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

const REPO = "/home/lia/Brain/repos/atelie-site";
const AGORA = Date.parse("2026-10-28T12:00:00-03:00");

interface Cena {
  mao: MaoDeEnsaio;
  bancada: Bancada;
  m: Montado;
  relogio: { agora: number };
}

async function cena(o: OpcoesDoEnsaio & { banco?: LinhaDoBanco[]; agora?: number } = {}): Promise<Cena> {
  const mao = maoDeEnsaio(o);
  const relogio = { agora: o.agora ?? AGORA };
  const bancada = new Bancada(mao, () => relogio.agora, bancoNaMemoria(o.banco ?? []), (ms) => mao.ensaio.esperar(ms));
  const montado = await montar(
    <App mao={mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={bancada} criarTerminal={criarHeadless} semRelogio />,
  );
  m = montado;
  return { mao, bancada, m: montado, relogio };
}

async function clicarSessao(c: Cena, nome: string) {
  const linha = Array.from(c.m.raiz.querySelectorAll<HTMLElement>("[data-sessao]")).find((l) => l.querySelector(".nome-da-sessao")?.textContent === nome);
  if (!linha) throw new Error(`sem a sessão ${nome}`);
  await act(async () => {
    linha.click();
  });
  await c.m.esperar();
}

const faixa = (c: Cena, regiao: string) => c.m.raiz.querySelector(`[data-regiao=${regiao}]`)?.textContent ?? null;

async function abrir(c: Cena, ia: string, lugar: string) {
  await c.m.clicar("Nova sessão");
  await c.m.clicar(ia);
  await c.m.clicar(lugar);
  await c.m.clicar("Abrir");
}

describe("worktree ao abrir (CP-GIT-01, CP-GIT-02)", () => {
  it("segunda sessão num repo pergunta; worktree abre em .worktrees/sessao-N-dia com o exclude", async () => {
    const c = await cena();
    await abrir(c, "codex", "atelie-site");
    await abrir(c, "claude", "atelie-site");
    expect(faixa(c, "worktree")).toContain("repos/atelie-site tem um codex aberto há 0 s. Abrir a nova em worktree?");
    await c.m.clicar("worktree");
    const nova = c.bancada.sessoes()[1];
    expect(nova.pasta).toBe(`${REPO}/.worktrees/sessao-1-2026-10-28`);
    expect(nova.worktree).toEqual({ repo: REPO, caminho: `${REPO}/.worktrees/sessao-1-2026-10-28`, branch: "sessao-1-2026-10-28" });
    expect(nova.nome).toBe("repos/atelie-site · sessao-1-2026-10-28");
    expect(c.mao.ensaio.arquivos.ler(`${REPO}/.git/info/exclude`)).toContain(".worktrees/");
    expect(c.m.raiz.querySelector("[data-regiao=cabeca-da-sessao] .pilula")?.textContent).toBe("worktree");
  });

  it("mesma pasta abre ali; o brain nunca pergunta", async () => {
    const c = await cena({ repos: [repoNovo("Brain", { pasta: "/home/lia/Brain" }), repoNovo("atelie-site")] });
    await abrir(c, "claude", "Brain");
    await abrir(c, "claude", "Brain");
    expect(faixa(c, "worktree")).toBeNull();
    expect(c.bancada.sessoes()).toHaveLength(2);
    await abrir(c, "shell", "atelie-site");
    await abrir(c, "shell", "atelie-site");
    await c.m.clicar("mesma pasta");
    expect(c.bancada.sessoes()[3].pasta).toBe(REPO);
    expect(c.bancada.sessoes()[3].worktree).toBeUndefined();
  });
});

async function cenaComWorktree(commits: number, soltos = 0, headNaBranch = true) {
  const WT = `${REPO}/.worktrees/sessao-1-2026-10-28`;
  const c = await cena({
    repos: [
      repoNovo("atelie-site", {
        branches: {
          main: { commitsForaDaMain: 0, data: 1, assunto: "" },
          "sessao-1-2026-10-28": { commitsForaDaMain: commits, data: 1793260000, assunto: "Peça de exemplo B" },
        },
        worktrees: { [WT]: { head: headNaBranch ? "sessao-1-2026-10-28" : "outra", mergeEmCurso: false, rastreadosMudados: 0, soltos } },
      }),
    ],
  });
  const s = await c.bancada.abrir({ programa: "claude", pasta: WT, worktree: { repo: REPO, caminho: WT, branch: "sessao-1-2026-10-28" } });
  await act(async () => {
    c.bancada.avisar();
  });
  await clicarSessao(c, s.nome);
  return { c, s, WT };
}

describe("fechar o worktree (CP-GIT-03, 04, 05, 08)", () => {
  it("sem commit e nada solto: o agente pergunta, e worktree e branch saem", async () => {
    const { c } = await cenaComWorktree(0);
    await c.m.clicar("Fechar a sessão");
    expect(faixa(c, "faixa")).toContain("Encerrar o Claude desta aba?");
    expect(c.mao.ensaio.repos[REPO].branches["sessao-1-2026-10-28"]).toBeDefined();
    await c.m.clicar("encerrar");
    expect(c.mao.ensaio.repos[REPO].branches["sessao-1-2026-10-28"]).toBeUndefined();
    expect(c.bancada.sessoes()[0].terminal).toBeNull();
  });

  it("arquivo solto sem commit: faixa SEM COMMIT, nada some", async () => {
    const { c } = await cenaComWorktree(0, 2);
    await c.m.clicar("Fechar a sessão");
    expect(faixa(c, "faixa")).toContain("2 arquivos mudados em");
    expect(faixa(c, "faixa")).toContain("e nenhum commit. Fechar mesmo assim?");
    await c.m.clicar("fechar");
    expect(c.bancada.sessoes()[0].terminal).toBeNull();
    expect(c.mao.ensaio.repos[REPO].branches["sessao-1-2026-10-28"]).toBeDefined();
  });

  it("HEAD trocado à mão: nada é removido", async () => {
    const { c } = await cenaComWorktree(1, 0, false);
    await c.m.clicar("Fechar a sessão");
    expect(c.mao.ensaio.repos[REPO].branches["sessao-1-2026-10-28"]).toBeDefined();
  });

  it("com commit: FORA DA MAIN com abrir PR, mesclar, deixar e ficar; deixar nunca apaga a branch", async () => {
    const { c } = await cenaComWorktree(2);
    await c.m.clicar("Fechar a sessão");
    expect(faixa(c, "faixa")).toBe("fora da main2 commits fora da main · o Claude sai junto · sessao-1-2026-10-28abrir PRmesclardeixarficar");
    await c.m.clicar("ficar");
    expect(faixa(c, "faixa")).toBeNull();
    expect(c.bancada.sessoes()[0].terminal).not.toBeNull();
    await c.m.clicar("Fechar a sessão");
    await c.m.clicar("deixar");
    expect(c.bancada.sessoes()[0].terminal).toBeNull();
    expect(c.mao.ensaio.repos[REPO].branches["sessao-1-2026-10-28"]).toEqual(expect.objectContaining({ commitsForaDaMain: 2 }));
  });
});

describe("mesclar e abrir PR (CP-GIT-06, CP-GIT-07)", () => {
  it("mesclar com a pasta principal limpa: merge sem avanço rápido, com a marca, e o recado", async () => {
    const { c } = await cenaComWorktree(1);
    await c.m.clicar("Fechar a sessão");
    await c.m.clicar("mesclar");
    const merge = c.mao.ensaio.gits.find((g) => g.args[0] === "merge");
    expect(merge?.args).toEqual(["merge", "--no-ff", "-m", "Merge da sessao-1-2026-10-28 (sessão do Tenancy)", "sessao-1-2026-10-28"]);
    expect(c.mao.ensaio.gits.some((g) => g.args[0] === "push")).toBe(false);
    expect(faixa(c, "recado")).toContain("sessao-1-2026-10-28 mesclada na main de repos/atelie-site");
    expect(faixa(c, "recado")).toContain("Falta mandar para o GitHub.");
  });

  it("mesclar com a pasta principal em outra branch recusa e a branch fica", async () => {
    const { c } = await cenaComWorktree(1);
    c.mao.ensaio.repos[REPO].head = "outra";
    await c.m.clicar("Fechar a sessão");
    await c.m.clicar("mesclar");
    expect(faixa(c, "recado")).toContain("Não mesclou: a pasta principal de repos/atelie-site está em outra. A branch sessao-1-2026-10-28 ficou.");
    expect(c.mao.ensaio.gits.some((g) => g.args[0] === "merge")).toBe(false);
  });

  it("abrir PR manda a branch e abre a página de comparação, sem credencial", async () => {
    const { c } = await cenaComWorktree(1);
    await c.m.clicar("Fechar a sessão");
    await c.m.clicar("abrir PR");
    expect(c.mao.ensaio.gits.find((g) => g.args[0] === "push")?.args).toEqual(["push", "-u", "origin", "sessao-1-2026-10-28"]);
    expect(c.mao.ensaio.abertos).toEqual(["https://github.com/exemplo/atelie-site/compare/main...sessao-1-2026-10-28?expand=1"]);
    expect(faixa(c, "recado")).toContain("a página do PR abriu no navegador. O PR é você quem cria.");
    expect(c.mao.ensaio.repos[REPO].branches["sessao-1-2026-10-28"]).toBeDefined();
  });
});

describe("Trabalho fora da main (CP-GIT-09)", () => {
  it("lista as branches de sessão com commit e sem aba; mesclar pede o segundo clique", async () => {
    const c = await cena({
      repos: [
        repoNovo("atelie-site", {
          branches: {
            main: { commitsForaDaMain: 0, data: 1, assunto: "" },
            "sessao-1-2026-10-27": { commitsForaDaMain: 2, data: 1793180000, assunto: "Peça de exemplo A" },
            "sessao-3-2026-10-28": { commitsForaDaMain: 0, data: 1793270000, assunto: "" },
            "feat-x": { commitsForaDaMain: 4, data: 1793275000, assunto: "Fora do app" },
          },
        }),
      ],
      banco: [{ id: "s9", nome: "velha", nomeManual: false, pasta: REPO, programa: "claude", criadaEm: AGORA - 9 * 864e5, ultimaVez: AGORA - 8 * 864e5, ordem: 0, worktree: { repo: REPO, caminho: `${REPO}/.worktrees/sessao-1-2026-10-27`, branch: "sessao-1-2026-10-27" } }],
    });
    await c.m.clicar("Trabalho fora da main");
    const pagina = c.m.raiz.querySelector("[data-pagina=fora-da-main]")!;
    expect(pagina.textContent).toContain("Branches de sessão com commit que a main não tem. Nada aqui some sozinho.");
    const cartoes = Array.from(pagina.querySelectorAll("[data-branch]")).map((x) => x.getAttribute("data-branch"));
    expect(cartoes).toEqual(["sessao-1-2026-10-27"]);
    expect(pagina.textContent).toContain("2 commits");
    expect(pagina.textContent).toContain("Peça de exemplo A");
    expect(c.m.raiz.querySelector("[data-regiao=contador-fora-da-main]")?.textContent).toBe("1");
    await c.m.clicar("Mesclar na main");
    expect(c.mao.ensaio.gits.some((g) => g.args[0] === "merge")).toBe(false);
    expect(pagina.textContent).toContain("Mesclar sessao-1-2026-10-27 na main de repos/atelie-site?");
    await c.m.clicar("Mesclar");
    expect(c.mao.ensaio.gits.some((g) => g.args[0] === "merge")).toBe(true);
  });
});

describe("encerrar, sair e órfãos (CP-PRC-01 a 04)", () => {
  it("fechar um agente pergunta; encerrar manda HUP e TERM ao grupo e a linha fica encerrando", async () => {
    const c = await cena();
    await abrir(c, "claude", "atelie-site");
    await c.m.clicar("Fechar a sessão");
    expect(faixa(c, "faixa")).toContain("Encerrar o Claude desta aba?");
    await c.m.clicar("encerrar");
    const pid = c.mao.ensaio.terminais()[0].pid;
    expect(c.mao.ensaio.sinais.slice(0, 2)).toEqual([
      { em: 0, grupo: pid, sinal: "HUP" },
      { em: 0, grupo: pid, sinal: "TERM" },
    ]);
    expect(c.mao.ensaio.sinais.some((x) => x.pid === 50 || x.grupo === 50)).toBe(false);
    expect(c.bancada.sessoes()[0].estado).toBe("encerrada");
  });

  it("sair com agentes pergunta uma vez: Ficar não fecha nada", async () => {
    const c = await cena();
    await abrir(c, "claude", "atelie-site");
    await abrir(c, "codex", "atelie-api");
    await abrir(c, "claude", "cadernos");
    await act(async () => {
      window.dispatchEvent(new CustomEvent("tenancy:sair"));
    });
    expect(faixa(c, "sair")).toContain("Sair encerra 3 agentes: 2 Claude e 1 Codex.");
    expect(faixa(c, "sair")).toContain("Encerrar leva a sessão inteira de cada aba: a IA, os servidores dela e o shell.");
    await c.m.clicar("Ficar");
    expect(faixa(c, "sair")).toBeNull();
    expect(c.bancada.abertas()).toHaveLength(3);
    expect(c.mao.ensaio.saiu).toBe(false);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("tenancy:sair"));
    });
    await c.m.clicar("Encerrar e sair");
    expect(c.bancada.abertas()).toHaveLength(0);
    expect(c.mao.ensaio.saiu).toBe(true);
  });

  it("órfãos de uma abertura anterior: um por linha, sem argumentos; deixar não mexe", async () => {
    const caso = (await import("../../../casos-de-prova/processos/CP-PRC-03.json")).default as unknown as { relogio: string; entrada: { tabela: never[] } };
    const c = await cena({ processos: caso.entrada.tabela, agora: Date.parse(caso.relogio) });
    await c.m.esperar();
    const pe = faixa(c, "orfaos")!;
    expect(pe).toContain("seguem rodando sem aba, de uma abertura anterior do app");
    expect(pe).toContain("claude · há 3 h · 200 MB");
    expect(pe).not.toContain("valor-de-exemplo");
    expect(pe).not.toContain("--chave");
    await c.m.clicar("Deixar todos");
    expect(c.mao.ensaio.sinais).toEqual([]);
    expect(faixa(c, "orfaos")).toBeNull();
  });
});

describe("retomar (decisão 11)", () => {
  const dia = 24 * 3600 * 1000;
  const linha = (id: string, programa: LinhaDoBanco["programa"], ha: number): LinhaDoBanco => ({
    id,
    nome: `Peça ${id}`,
    nomeManual: true,
    pasta: "/home/lia/Brain",
    programa,
    criadaEm: AGORA - ha - 1000,
    ultimaVez: AGORA - ha,
    ordem: Number(id.slice(1)),
  });

  it("só o shell sobe sozinho; Claude e Codex de até 7 dias oferecem retomar; agy e os velhos, abrir de novo", async () => {
    const c = await cena({
      banco: [linha("s1", "shell", 60_000), linha("s2", "claude", 4 * 60_000), linha("s3", "codex", 2 * dia), linha("s4", "agy", 60_000), linha("s5", "claude", 8 * dia)],
    });
    await c.m.esperar();
    const [s1, s2, s3, s4, s5] = c.bancada.sessoes();
    expect(s1.terminal).not.toBeNull();
    expect([s2, s3, s4, s5].every((s) => s.terminal === null)).toBe(true);
    await clicarSessao(c, "Peça s2");
    expect(faixa(c, "faixa")).toContain("claude · fechada há 4 min, quando o app fechou. Retomar devolve a conversa onde estava.");
    await clicarSessao(c, "Peça s4");
    expect(faixa(c, "faixa")).toContain("agy em Brain veio de volta. Abrir de novo?");
    await clicarSessao(c, "Peça s5");
    expect(faixa(c, "faixa")).toContain("claude em Brain veio de volta. Abrir de novo?");
    await clicarSessao(c, "Peça s2");
    await c.m.clicar("retomar onde parou");
    expect(c.mao.ensaio.terminais().at(-1)!.pedido.args).toEqual(["-l", "-c", "exec claude --continue"]);
    await clicarSessao(c, "Peça s3");
    await c.m.clicar("retomar onde parou");
    expect(c.mao.ensaio.terminais().at(-1)!.pedido.args).toEqual(["-l", "-c", "exec codex resume --last"]);
  });
});
