// A mão de ensaio passa os casos CP-TEL, CP-GIT e CP-PRC pelo pacote sessoes,
// sem DOM: a tela lida de um terminal (xterm headless), o git respondido pelo
// modelo do repositório e os sinais mandados pela tabela de processos dela.
import { Terminal } from "@xterm/headless";
import {
  aoFechar,
  decidirMescla,
  encerrar,
  enderecoDoPR,
  estadoDaTela,
  lerPedido,
  lerTela,
  linhaDaAba,
  linhaDoOrfao,
  orfaos,
  podeSempre,
  sessaoJaAberta,
  trabalhoForaDaMain,
} from "@novasce/sessoes";
import { describe, expect, it } from "vitest";
import { maoDeProcessosDe, protegidosDoHost } from "../src/bancada/processos";
import { branchesDeSessao, principalDe, remotoDe, retratoAoFechar, retratoDaMescla, temGit } from "../src/bancada/repos";
import { ultimasLinhas } from "../src/bancada/tela";
import { maoDeEnsaio, repoNovo, telaDeEnsaio, type ProcessoDeEnsaio } from "../src/mao/ensaio";
import type { MaoDoHost } from "../src/mao/tipos";

type Caso = { id: string; relogio: string; entrada: any; esperado: any };
const casos = import.meta.glob<Caso>("../../../casos-de-prova/{tela,git,processos}/*.json", { eager: true, import: "default" });
const por = (id: string): Caso => {
  const c = Object.values(casos).find((x) => x.id === id);
  if (!c) throw new Error(`falta o caso ${id}`);
  return c;
};

// A mão do host é a mesma interface nos três caminhos: a de ensaio a cumpre.
const _confere: MaoDoHost = maoDeEnsaio();
void _confere;

/** Abre a CLI no ensaio, desenha a tela do caso e lê como a Bancada lê. */
async function lerPeloTerminal(nome: string): Promise<string> {
  const mao = maoDeEnsaio();
  mao.ensaio.telaInicial = {};
  const termo = new Terminal({ cols: 120, rows: 40, allowProposedApi: true });
  const t = await mao.terminal.abrir({ programa: "/bin/bash", args: ["-l", "-c", "exec claude"], pasta: "/home/lia/Brain", ambiente: {}, tirar: [], colunas: 120, linhas: 40 });
  const chegou: Promise<void>[] = [];
  mao.terminal.aoReceber(t.id, (d) => chegou.push(new Promise((r) => termo.write(d, r))));
  mao.ensaio.mostrar(t.id, telaDeEnsaio(nome));
  await Promise.all(chegou);
  const texto = ultimasLinhas(termo, 24);
  termo.dispose();
  return texto;
}

describe("mão de ensaio: tela (CP-TEL)", () => {
  for (const id of ["CP-TEL-01", "CP-TEL-02", "CP-TEL-03", "CP-TEL-04", "CP-TEL-05", "CP-TEL-06"]) {
    it(`${id} pelo terminal`, async () => {
      const c = por(id);
      const agora = Date.parse(c.relogio);
      for (const [n, l] of c.entrada.leituras.entries()) {
        const texto = await lerPeloTerminal(l.tela);
        const leitura = lerTela(texto);
        const estado = estadoDaTela(
          leitura,
          {
            mudouEm: agora - l.mudouHa * 1000,
            vistaEm: agora - l.vistaHa * 1000,
            abertaEm: agora - l.abertaHa * 1000,
            prontaEm: l.prontaHa === null ? null : agora - l.prontaHa * 1000,
          },
          l.cpu,
          agora,
        );
        const esperado = c.esperado.leituras[n];
        expect(estado.estado, `${id} leitura ${n}`).toBe(esperado.estado);
        if ("linha" in esperado) expect(linhaDaAba(estado, leitura, agora)).toBe(esperado.linha);
        if ("promptLivre" in esperado) expect(leitura.promptLivre).toBe(esperado.promptLivre);
        if (id === "CP-TEL-05") {
          const pedido = lerPedido(texto);
          expect(pedido && { tipo: pedido.tipo, texto: pedido.texto, podeSempre: podeSempre(pedido) }).toEqual({
            tipo: esperado.tipo,
            texto: esperado.texto,
            podeSempre: esperado.podeSempre,
          });
        }
      }
    });
  }

  it("a sessão sobe com a marca e sem o ambiente do Claude de fora", async () => {
    const { Bancada } = await import("../src/bancada/bancada");
    const mao = maoDeEnsaio();
    const s = await new Bancada(mao).abrir({ programa: "claude", pasta: "/home/lia/Brain" });
    const p = mao.ensaio.terminais()[0].pedido;
    expect(p.args).toEqual(["-l", "-c", "exec claude"]);
    expect(p.ambiente).toMatchObject({ TERM: "xterm-256color", COLORTERM: "truecolor", TENANCY_SESSAO: s.id });
    expect(p.tirar).toEqual(["CLAUDECODE", "CLAUDE_CODE*"]);
  });
});

describe("mão de ensaio: git (CP-GIT)", () => {
  const PASTA = "/home/lia/Brain/repos/atelie-site";
  const WT = `${PASTA}/.worktrees/sessao-2-2026-10-28`;

  it("CP-GIT-01 e 02 segunda sessão na mesma pasta, com o git respondido pela mão", async () => {
    for (const id of ["CP-GIT-01", "CP-GIT-02"]) {
      const c = por(id);
      const home = c.entrada.home;
      const repos = c.entrada.pedidos.filter((p: any) => p.temGit).map((p: any) => repoNovo("x", { pasta: p.pasta.replace(/^~/, home) }));
      const mao = maoDeEnsaio({ repos });
      const respostas = [];
      for (const p of c.entrada.pedidos) {
        const comGit = await temGit(mao, p.pasta.replace(/^~/, home));
        expect(comGit, `${id} ${p.pasta}`).toBe(p.temGit);
        respostas.push(sessaoJaAberta({ pasta: p.pasta, temGit: comGit, abertas: c.entrada.abertas, espacos: c.entrada.espacos, home }));
      }
      expect(respostas).toEqual(c.esperado.respostas);
    }
  });

  for (const id of ["CP-GIT-03", "CP-GIT-04", "CP-GIT-05", "CP-GIT-08"]) {
    it(`${id} fechar o worktree, com o retrato lido do git`, async () => {
      const c = por(id);
      const branch = c.entrada.branch ?? "sessao-2-2026-10-28";
      const destinos = [];
      for (const f of c.entrada.fechamentos) {
        const repo = repoNovo("atelie-site", {
          pasta: PASTA,
          principal: c.entrada.principal ?? "main",
          branches: {
            main: { commitsForaDaMain: 0, data: 1, assunto: "" },
            ...(f.commitsForaDaMain === null ? {} : { [branch]: { commitsForaDaMain: f.commitsForaDaMain, data: 2, assunto: "" } }),
          },
          worktrees: { [WT]: { head: f.headNaBranch ? branch : "outra", mergeEmCurso: false, rastreadosMudados: 0, soltos: f.soltos } },
        });
        const mao = maoDeEnsaio({ repos: [repo] });
        const r = await retratoAoFechar(mao, { repo: PASTA, caminho: WT, branch });
        expect(r).toEqual({ commitsForaDaMain: f.commitsForaDaMain, soltos: f.soltos, headNaBranch: f.headNaBranch });
        destinos.push(aoFechar({ ...r, branch: c.entrada.branch, principal: c.entrada.principal }));
      }
      expect(destinos).toEqual(c.esperado.destinos);
    });
  }

  it("CP-GIT-06 mesclar, com o retrato da pasta principal lido do git", async () => {
    const c = por("CP-GIT-06");
    const decisoes = [];
    for (const r of c.entrada.retratos) {
      const repo = repoNovo("atelie-site", {
        pasta: PASTA,
        principal: r.principal,
        head: r.headDaPastaPrincipal,
        mergeEmCurso: r.mergeEmCurso,
        rastreadosMudados: r.rastreadosMudados,
        soltos: 2,
        branches: { ...(r.principal ? { [r.principal]: { commitsForaDaMain: 0, data: 1, assunto: "" } } : {}), [c.entrada.branch]: { commitsForaDaMain: 1, data: 2, assunto: "" } },
      });
      const mao = maoDeEnsaio({ repos: [repo] });
      const retrato = await retratoDaMescla(mao, PASTA);
      expect(retrato).toEqual(r);
      const d = decidirMescla({ ...retrato, branch: c.entrada.branch });
      decisoes.push(d.tipo === "mesclar" ? { tipo: d.tipo, noFf: d.git.includes("--no-ff"), push: d.git.includes("push") } : d);
      if (d.tipo === "mesclar") {
        const s = await mao.git(PASTA, d.git);
        expect(s.codigo).toBe(0);
        expect(d.git).toContain(`Merge da ${c.entrada.branch} (sessão do Tenancy)`);
      }
    }
    expect(decisoes).toEqual(c.esperado.decisoes);
  });

  it("CP-GIT-07 abrir PR, com o remoto lido do git", async () => {
    const c = por("CP-GIT-07");
    const enderecos = [];
    for (const remoto of c.entrada.remotos) {
      const mao = maoDeEnsaio({ repos: [repoNovo("atelie-site", { pasta: PASTA, remoto })] });
      const lido = await remotoDe(mao, PASTA);
      expect(lido).toBe(remoto.trim());
      enderecos.push(enderecoDoPR(lido!, c.entrada.principal, c.entrada.branch));
    }
    expect(enderecos).toEqual(c.esperado.enderecos);
  });

  it("CP-GIT-09 trabalho fora da main, com as branches lidas do git", async () => {
    const c = por("CP-GIT-09");
    const branches: Record<string, { commitsForaDaMain: number; data: number; assunto: string }> = { main: { commitsForaDaMain: 0, data: 1, assunto: "" } };
    for (const b of c.entrada.branches) branches[b.nome] = { commitsForaDaMain: b.commitsForaDaMain, data: b.data, assunto: b.assunto };
    const mao = maoDeEnsaio({ repos: [repoNovo("atelie-site", { pasta: PASTA, branches })] });
    expect(await principalDe(mao, PASTA)).toBe("main");
    const lidas = await branchesDeSessao(mao, PASTA);
    const r = trabalhoForaDaMain(lidas, c.entrada.abertas);
    expect({ lista: r.lista.map((b) => b.nome), rotulo: r.rotulo }).toEqual(c.esperado);
  });
});

describe("mão de ensaio: processos (CP-PRC)", () => {
  it("CP-PRC-02 pedir, esperar e forçar pela tabela e pelos sinais da mão", async () => {
    const c = por("CP-PRC-02");
    for (const [n, cenario] of c.entrada.cenarios.entries()) {
      const mao = maoDeEnsaio({ processos: cenario.processos as ProcessoDeEnsaio[] });
      const resultado = await encerrar(cenario.raizes, maoDeProcessosDe(mao, (ms) => mao.ensaio.esperar(ms)), {
        protegidos: new Set(),
        grupoDoApp: 50,
        pidDoApp: 50,
      });
      expect(mao.ensaio.sinais).toEqual(c.esperado.cenarios[n].sinais);
      expect({ ...resultado, sobrou: resultado.sobrou.map((p) => p.pid) }).toEqual(c.esperado.cenarios[n].resultado);
    }
  });

  it("CP-PRC-03 órfãos pela tabela da mão", async () => {
    const c = por("CP-PRC-03");
    const mao = maoDeEnsaio({ processos: c.entrada.tabela });
    const tabela = (await mao.processos.tabela()).filter((p) => c.entrada.tabela.some((x: { pid: number }) => x.pid === p.pid));
    const linhas = orfaos(tabela, new Set(), { marca: c.entrada.marca, pacoteDoApp: c.entrada.pacoteDoApp }).map((o) => linhaDoOrfao(o, Date.parse(c.relogio)));
    expect(linhas).toEqual(c.esperado.linhas);
  });

  it("CP-PRC-04 o app e os pais nunca são alvo: o protegido sai da mão", async () => {
    const c = por("CP-PRC-04");
    const mao = maoDeEnsaio({ processos: c.entrada.tabela, soEstesProcessos: true, app: c.entrada.app });
    const prot = await protegidosDoHost(mao);
    expect([...prot].sort((a, b) => a - b)).toEqual(c.esperado.protegidos);
  });

  it("encerrar uma sessão aberta pela Bancada derruba só ela", async () => {
    const { Bancada } = await import("../src/bancada/bancada");
    const mao = maoDeEnsaio();
    const b = new Bancada(mao);
    const um = await b.abrir({ programa: "shell", pasta: "/home/lia/Brain" });
    const dois = await b.abrir({ programa: "claude", pasta: "/home/lia/Brain" });
    const [t1, t2] = [um.terminal!, dois.terminal!];
    const prot = await protegidosDoHost(mao);
    const app = await mao.processos.doApp();
    await encerrar([{ pid: t1.pid, inicio: t1.inicio }], maoDeProcessosDe(mao, (ms) => mao.ensaio.esperar(ms)), {
      protegidos: prot,
      grupoDoApp: app.pgid,
      pidDoApp: app.pid,
    });
    expect(mao.ensaio.vivo(t1.id)).toBe(false);
    expect(mao.ensaio.vivo(t2.id)).toBe(true);
    expect(b.abertas().map((s) => s.id)).toEqual([dois.id]);
  });
});

describe("mão de ensaio: cofre, arquivos e CLIs", () => {
  it("o cofre diz só se há login e troca por um código; o token nunca aparece", async () => {
    const mao = maoDeEnsaio();
    expect(await mao.cofre.temLogin()).toBe(true);
    const troca = await mao.cofre.trocar();
    expect(troca).toEqual({ codigo: "codigo-de-ensaio", validoAte: expect.any(String) });
    expect(JSON.stringify(troca)).not.toMatch(/nvos_u_/);
    mao.ensaio.login.tem = false;
    expect(await mao.cofre.trocar()).toEqual({ falha: "sem-login" });
  });

  it("brain, repos com .git e recentes da pessoa fictícia", async () => {
    const mao = maoDeEnsaio();
    expect(mao.arquivos.brain()).toBe("/home/lia/Brain");
    expect(await mao.arquivos.repos()).toEqual([
      "/home/lia/Brain/repos/atelie-api",
      "/home/lia/Brain/repos/atelie-site",
      "/home/lia/Brain/repos/cadernos",
    ]);
    expect(mao.arquivos.arquivos().listar("/home/lia/Brain/continuar/a-continuar").map((e) => e.nome)).toEqual(["2026-10-28 Ateliê - peça A"]);
  });

  it("CLI ausente responde 127; a que não responde esgota o prazo", async () => {
    const mao = maoDeEnsaio({ clis: { codex: "nao-responde" } });
    expect(await mao.cli.versao("agy")).toEqual({ codigo: 127, saida: "" });
    expect(await mao.cli.ajuda("codex")).toEqual({ esgotou: true });
    expect(await mao.cli.ajuda("claude")).toMatchObject({ codigo: 0 });
  });
});
