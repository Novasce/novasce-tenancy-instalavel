import { describe, expect, it } from "vitest";
import {
  alvos,
  aoFechar,
  enderecoDoPR,
  decidirMescla,
  encerrar,
  estadoDaTela,
  lerTela,
  linhaDaAba,
  linhaDoOrfao,
  lerPedido,
  orfaos,
  perigoso,
  planoDeSinais,
  podeSempre,
  protegidos,
  sessaoJaAberta,
  TECLAS_DO_PEDIDO,
  trabalhoForaDaMain,
  type MaoDeProcessos,
  type Processo,
  type Sinal,
} from "../src/index";
import { idsEsperados, lerCasos, type Caso } from "./ler-casos";

const tela = lerCasos(import.meta.glob("../../../casos-de-prova/tela/*.json", { eager: true, import: "default" }), "CP-TEL-");
const git = lerCasos(import.meta.glob("../../../casos-de-prova/git/*.json", { eager: true, import: "default" }), "CP-GIT-");
const processos = lerCasos(import.meta.glob("../../../casos-de-prova/processos/*.json", { eager: true, import: "default" }), "CP-PRC-");
const telas = import.meta.glob<string>("../../../casos-de-prova/tela/*.txt", { eager: true, import: "default", query: "?raw" });
const por: Record<string, Caso> = Object.fromEntries([...tela, ...git, ...processos].map((c) => [c.id, c]));

function textoDa(nome: string): string {
  const achado = Object.entries(telas).find(([caminho]) => caminho.endsWith(`/${nome}`));
  if (!achado) throw new Error(`falta a tela ${nome}`);
  return achado[1];
}

interface LeituraDoCaso {
  tela: string;
  mudouHa: number;
  vistaHa: number;
  abertaHa: number;
  cpu: number;
}

function ler(caso: Caso, l: LeituraDoCaso) {
  const agora = Date.parse(caso.relogio);
  const leitura = lerTela(textoDa(l.tela));
  const estado = estadoDaTela(
    leitura,
    {
      mudouEm: agora - l.mudouHa * 1000,
      vistaEm: agora - l.vistaHa * 1000,
      abertaEm: agora - l.abertaHa * 1000,
      prontaEm: leitura.promptLivre ? agora - l.abertaHa * 1000 : null,
    },
    l.cpu,
    agora,
  );
  return { leitura, estado, linha: linhaDaAba(estado, leitura, agora) };
}

describe("casos de prova das sessões", () => {
  it("todos os casos das pastas estão aqui", () => {
    expect(tela.map((c) => c.id)).toEqual(idsEsperados("CP-TEL-", 6));
    expect(git.map((c) => c.id)).toEqual(idsEsperados("CP-GIT-", 9));
    expect(processos.map((c) => c.id)).toEqual(idsEsperados("CP-PRC-", 4));
  });

  for (const id of ["CP-TEL-01", "CP-TEL-02", "CP-TEL-03", "CP-TEL-04", "CP-TEL-06"]) {
    it(`${id} leitura da tela`, () => {
      const c = por[id];
      const lidas = c.entrada.leituras.map((l: LeituraDoCaso) => {
        const { leitura, estado, linha } = ler(c, l);
        return {
          caixa: leitura.caixa !== null,
          promptLivre: leitura.promptLivre,
          rodape: leitura.rodape,
          emSegundoPlano: leitura.emSegundoPlano,
          estado: estado.estado,
          linha,
        };
      });
      expect(lidas).toEqual(c.esperado.leituras);
    });
  }

  it("CP-TEL-05 pedido de permissão", () => {
    const c = por["CP-TEL-05"];
    const lidas = c.entrada.leituras.map((l: LeituraDoCaso) => {
      const { estado } = ler(c, l);
      const pedido = lerPedido(textoDa(l.tela));
      if (!pedido) throw new Error(`${l.tela}: pedido não lido`);
      return {
        estado: estado.estado,
        tipo: pedido.tipo,
        texto: pedido.texto,
        sempre: pedido.sempre,
        podeSempre: podeSempre(pedido),
        frase: pedido.frase,
      };
    });
    expect(lidas).toEqual(c.esperado.leituras);
    expect(TECLAS_DO_PEDIDO).toEqual(c.esperado.teclas);
    for (const cmd of c.entrada.perigosos) expect(perigoso(cmd), cmd).toBe(true);
    for (const cmd of c.entrada.seguros) expect(perigoso(cmd), cmd).toBe(false);
    expect(lerPedido(textoDa("CP-TEL-01.txt"))).toBeNull();
  });

  for (const id of ["CP-GIT-01", "CP-GIT-02"]) {
    it(`${id} segunda sessão na mesma pasta`, () => {
      const c = por[id];
      const respostas = c.entrada.pedidos.map((p: { pasta: string; temGit: boolean }) =>
        sessaoJaAberta({ ...p, abertas: c.entrada.abertas, espacos: c.entrada.espacos, home: c.entrada.home }),
      );
      expect(respostas).toEqual(c.esperado.respostas);
    });
  }

  for (const id of ["CP-GIT-03", "CP-GIT-04", "CP-GIT-05", "CP-GIT-08"]) {
    it(`${id} fechar a aba do worktree`, () => {
      const c = por[id];
      const destinos = c.entrada.fechamentos.map((f: Parameters<typeof aoFechar>[0]) =>
        aoFechar({ ...f, branch: c.entrada.branch, principal: c.entrada.principal }),
      );
      expect(destinos).toEqual(c.esperado.destinos);
    });
  }

  it("CP-GIT-06 mesclar", () => {
    const c = por["CP-GIT-06"];
    const decisoes = c.entrada.retratos.map((r: Parameters<typeof decidirMescla>[0]) => {
      const d = decidirMescla({ ...r, branch: c.entrada.branch });
      if (d.tipo !== "mesclar") return d;
      expect(d.git.slice(0, 2)).toEqual(["merge", "--no-ff"]);
      expect(d.git.at(-1)).toBe(c.entrada.branch);
      return { tipo: d.tipo, noFf: d.git.includes("--no-ff") && !d.git.includes("--ff"), push: d.git.includes("push") };
    });
    expect(decisoes).toEqual(c.esperado.decisoes);
  });

  it("CP-GIT-07 abrir PR", () => {
    const c = por["CP-GIT-07"];
    const enderecos = c.entrada.remotos.map((r: string) => enderecoDoPR(r, c.entrada.principal, c.entrada.branch));
    expect(enderecos).toEqual(c.esperado.enderecos);
    for (const e of enderecos) if (e) expect(e).not.toMatch(/@|credencial/);
  });

  it("CP-GIT-09 trabalho fora da main", () => {
    const c = por["CP-GIT-09"];
    const r = trabalhoForaDaMain(c.entrada.branches, c.entrada.abertas);
    expect({ lista: r.lista.map((b) => b.nome), rotulo: r.rotulo }).toEqual(c.esperado);
  });

  it("CP-PRC-01 alvos do encerramento", () => {
    const c = por["CP-PRC-01"];
    const lista = c.entrada.pedidos.map((p: { raiz: number; inicio: string }) =>
      alvos(p.raiz, p.inicio, c.entrada.tabela, new Set()).map((x) => x.pid),
    );
    expect(lista).toEqual(c.esperado.alvos);
  });

  it("CP-PRC-02 pedir, esperar e forçar", async () => {
    const c = por["CP-PRC-02"];
    for (const [n, cenario] of c.entrada.cenarios.entries()) {
      const mao = maoDeMentira(cenario.processos);
      const resultado = await encerrar(cenario.raizes, mao, { protegidos: new Set(), grupoDoApp: 50, pidDoApp: 50 });
      expect(mao.sinais).toEqual(c.esperado.cenarios[n].sinais);
      expect({ ...resultado, sobrou: resultado.sobrou.map((p) => p.pid) }).toEqual(c.esperado.cenarios[n].resultado);
    }
  });

  it("CP-PRC-03 órfãos", () => {
    const c = por["CP-PRC-03"];
    const agora = Date.parse(c.relogio);
    const achados = orfaos(c.entrada.tabela, new Set(), { marca: c.entrada.marca, pacoteDoApp: c.entrada.pacoteDoApp });
    const linhas = achados.map((o) => linhaDoOrfao(o, agora));
    expect(linhas).toEqual(c.esperado.linhas);
    for (const t of c.esperado.naoTem) for (const l of linhas) expect(l).not.toContain(t);
    // Achar órfão não manda sinal: a função não recebe mão nenhuma.
    expect(c.esperado.sinais).toEqual([]);
  });

  it("CP-PRC-04 o app nunca é alvo", () => {
    const c = por["CP-PRC-04"];
    const tabela: Processo[] = c.entrada.tabela;
    const prot = protegidos(c.entrada.app.pid, tabela);
    expect([...prot].sort((a, b) => a - b)).toEqual(c.esperado.protegidos);
    const lista = c.entrada.pedidos.map((p: { raiz: number; inicio: string }) => alvos(p.raiz, p.inicio, tabela, prot));
    expect(lista.map((l: Processo[]) => l.map((x) => x.pid))).toEqual(c.esperado.alvos);
    expect(planoDeSinais(lista[0], prot, c.entrada.app.pgid, c.entrada.app.pid)).toEqual(c.esperado.plano);
  });
});

// Mão de processos de mentira, com relógio próprio: cada processo pode ignorar
// sinais e nascer depois de um tempo.
interface ProcessoDeMentira extends Processo {
  ignora: Sinal[];
  nasceEm?: number;
}

function maoDeMentira(lista: ProcessoDeMentira[]): MaoDeProcessos & { sinais: { em: number; grupo?: number; pid?: number; sinal: Sinal }[] } {
  let agora = 0;
  const mortos = new Set<number>();
  const sinais: { em: number; grupo?: number; pid?: number; sinal: Sinal }[] = [];
  const vivos = () => lista.filter((p) => !mortos.has(p.pid) && (p.nasceEm ?? 0) <= agora);
  const receber = (p: ProcessoDeMentira, s: Sinal) => {
    if (s === "KILL" || !p.ignora.includes(s)) mortos.add(p.pid);
  };
  return {
    sinais,
    tabela: () => vivos().map(({ ignora: _i, nasceEm: _n, ...p }) => p),
    sinalAoGrupo(grupo, sinal) {
      sinais.push({ em: agora, grupo, sinal });
      for (const p of vivos().filter((x) => x.pgid === grupo)) receber(p, sinal);
    },
    sinalAoPid(pid, sinal) {
      sinais.push({ em: agora, pid, sinal });
      for (const p of vivos().filter((x) => x.pid === pid)) receber(p, sinal);
    },
    async esperar(ms) {
      agora += ms;
    },
  };
}
