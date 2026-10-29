import { describe, expect, it } from "vitest";
import {
  ArquivosNaMemoria,
  PRAZO_DA_AJUDA_MS,
  abrirPasta,
  avisoDaAbertura,
  blocosDaMensagem,
  cobrar,
  conferirAjuda,
  copiarPrompt,
  desfazerDia,
  desfazerMover,
  diasUteis,
  enviei,
  hojeNoFuso,
  informarDia,
  juntar,
  lembrete,
  lerEnvio,
  lerLeia,
  listarParaContinuar,
  modeloDoLeia,
  ondeParou,
  opcoesDaCli,
  type Motor,
} from "../src/index";
import { idsEsperados, lerCasos, type Caso } from "./ler-casos";

const continuar = lerCasos(
  import.meta.glob("../../../casos-de-prova/continuar/*.json", { eager: true, import: "default" }),
  "CP-CON-",
);
const envios = lerCasos(
  import.meta.glob("../../../casos-de-prova/envios/*.json", { eager: true, import: "default" }),
  "CP-ENV-",
);

function caso(lista: Caso[], id: string): Caso {
  const c = lista.find((x) => x.id === id);
  if (!c) throw new Error(`falta o caso ${id}`);
  return c;
}

function prompt(p: string | { repetir: string; vezes: number }): string {
  return typeof p === "string" ? p : p.repetir.repeat(p.vezes);
}

const hoje = (c: Caso, relogio = c.relogio) => hojeNoFuso(relogio, c.fuso);

describe("casos de prova de pastas", () => {
  it("tem todos os casos de Para continuar e de Envios", () => {
    expect(continuar.map((c) => c.id)).toEqual(idsEsperados("CP-CON-", 8));
    expect(envios.map((c) => c.id)).toEqual(idsEsperados("CP-ENV-", 7));
  });
});

describe("Para continuar", () => {
  it("CP-CON-01 lista sem repetir brain e corta os continuados em 60 por brain", () => {
    const c = caso(continuar, "CP-CON-01");
    const arquivos = new ArquivosNaMemoria(c.entrada.arquivos, c.entrada.links);
    const lista = listarParaContinuar(arquivos, c.entrada.brains, c.entrada.home);
    expect(lista.brains).toEqual(c.esperado.brains);
    expect(lista.aContinuar.map((p) => p.caminho)).toEqual(c.esperado.aContinuar);
    const cont = lista.continuados.map((p) => p.caminho);
    expect(cont).toHaveLength(c.esperado.continuados.quantos);
    expect(cont.slice(0, 3)).toEqual(c.esperado.continuados.primeiros);
    expect(cont.at(-1)).toBe(c.esperado.continuados.ultimo);
    for (const fora of c.esperado.continuados.fora) expect(cont).not.toContain(fora);
  });

  it("CP-CON-02 lê as seções do LEIA", () => {
    const c = caso(continuar, "CP-CON-02");
    const leia = lerLeia(c.entrada.leia);
    expect(leia.preambulo).toEqual(c.esperado.preambulo);
    expect(leia.secoes).toEqual(c.esperado.secoes);
  });

  it("CP-CON-03 lê onde parou e junta as esperas na ordem do arquivo", () => {
    const c = caso(continuar, "CP-CON-03");
    const leia = lerLeia(c.entrada.leia);
    expect(ondeParou(leia)).toEqual(c.esperado.ondeParou);
    expect(juntar(leia, "ESPERA")).toEqual(c.esperado.oQueEspera);
  });

  it("CP-CON-04 lê modelo e esforço por CLI e monta as opções", () => {
    const c = caso(continuar, "CP-CON-04");
    const leia = lerLeia(c.entrada.leia);
    for (const motor of c.entrada.motores as Motor[]) {
      const m = modeloDoLeia(leia, motor);
      const e = c.esperado[motor];
      expect(m).toEqual({ modelo: e.modelo, rotulo: e.rotulo, esforco: e.esforco });
      expect(opcoesDaCli(motor, m!, { modelo: true, esforco: true })).toEqual(e.opcoes);
    }
  });

  it("CP-CON-05 confere o --help com prazo de 5 s e avisa só pelo que foi pedido", async () => {
    const c = caso(continuar, "CP-CON-05");
    expect(PRAZO_DA_AJUDA_MS).toBe(c.esperado.prazoMs);
    expect(c.entrada.variantes).toHaveLength(c.esperado.variantes.length);
    for (const [i, v] of c.entrada.variantes.entries()) {
      const motor: Motor = v.motor ?? c.entrada.motor;
      const escolha = v.escolha ?? c.entrada.escolha;
      const pedidos: { comando: string[]; prazoMs: number }[] = [];
      const resultado = await conferirAjuda(motor, motor, async (comando, prazoMs) => {
        pedidos.push({ comando, prazoMs });
        return v.ajuda;
      });
      const e = c.esperado.variantes[i];
      expect(pedidos, e.nome).toEqual([{ comando: [motor, "--help"], prazoMs: c.entrada.prazoMs }]);
      expect(opcoesDaCli(motor, escolha, resultado), e.nome).toEqual(e.opcoes);
      expect(avisoDaAbertura(escolha, resultado), e.nome).toBe(e.aviso);
    }
  });

  it("CP-CON-06 abre só com prompt e CLI, move antes da CLI e devolve se a sessão falha", async () => {
    const c = caso(continuar, "CP-CON-06");
    for (const [i, v] of c.entrada.variantes.entries()) {
      const arquivos = new ArquivosNaMemoria({ [`${c.entrada.pasta}/prompt.txt`]: prompt(v.prompt) });
      const ordem: string[] = [];
      let enviado: string | undefined;
      const r = await abrirPasta(arquivos, {
        brain: c.entrada.brain,
        pasta: c.entrada.pasta,
        app: c.entrada.app,
        cliExiste: async () => v.cliExiste,
        iniciar: async (texto) => {
          ordem.push(arquivos.existe(`${c.entrada.pasta}/prompt.txt`) ? "cli-com-a-pasta-no-lugar" : "cli");
          enviado = texto;
          return v.sessaoAbre;
        },
      });
      const e = c.esperado.variantes[i];
      expect(r.abriu, e.nome).toBe(e.abriu);
      expect(r.motivo ?? undefined, e.nome).toBe(e.motivo);
      expect(r.pasta, e.nome).toBe(e.pasta);
      expect(arquivos.existe(`${e.pasta}/prompt.txt`), e.nome).toBe(true);
      if (e.ficha) expect(r.ficha).toBe(true);
      if (e.moveuAntesDaCli) expect(ordem).toEqual(["cli"]);
      if (e.promptEnviado) expect(enviado).toBe(e.promptEnviado);
    }
  });

  it("CP-CON-07 copia sem mover, desfaz para o caminho exato e não sobrescreve", async () => {
    const c = caso(continuar, "CP-CON-07");
    const arquivos = new ArquivosNaMemoria(c.entrada.arquivos);
    let ultima: { de: string; para: string } | undefined;
    for (const [i, passo] of c.entrada.passos.entries()) {
      const e = c.esperado.passos[i];
      if (passo.acao === "copiar") {
        expect(copiarPrompt(arquivos, passo.pasta)).toBe(e.copiado);
        expect(arquivos.existe(`${e.pasta}/prompt.txt`)).toBe(true);
      } else if (passo.acao === "abrir") {
        const r = await abrirPasta(arquivos, {
          brain: c.entrada.brain,
          pasta: passo.pasta,
          app: "Tenancy",
          cliExiste: async () => true,
          iniciar: async () => true,
        });
        expect(r.pasta).toBe(e.pasta);
        ultima = { de: passo.pasta, para: r.pasta };
      } else {
        desfazerMover(arquivos, ultima!.para, ultima!.de);
        expect(arquivos.existe(`${e.pasta}/prompt.txt`)).toBe(true);
      }
    }
    expect(arquivos.ler(`${c.esperado.passos[3].pasta}/prompt.txt`)).toBe("Siga o passo 2.\n");
    expect(arquivos.ler("/home/lia/Brain/continuar/continuados/2026-10-28 Produto A - passo 2/prompt.txt")).toBe(
      "Versão antiga.\n",
    );
  });

  it("CP-CON-08 mostra o em-espera à parte, sem abrir", () => {
    const c = caso(continuar, "CP-CON-08");
    const arquivos = new ArquivosNaMemoria(c.entrada.arquivos, c.entrada.links);
    const lista = listarParaContinuar(arquivos, c.entrada.brains, c.entrada.home);
    expect(lista.aContinuar.map((p) => p.caminho)).toEqual(c.esperado.aContinuar);
    expect(
      lista.emEspera.map((p) => ({ pasta: p.caminho, ondeParou: p.ondeParou, podeAbrir: p.podeAbrir })),
    ).toEqual(c.esperado.emEspera);
  });
});

describe("Para continuar, fora dos casos", () => {
  it("sessão que falha com erro devolve a pasta; prompt só de espaços abre como no Mac", async () => {
    const pasta = "/home/lia/Brain/continuar/a-continuar/2026-10-28 Produto A - passo 1";
    const arquivos = new ArquivosNaMemoria({ [`${pasta}/prompt.txt`]: "Siga.\n" });
    const r = await abrirPasta(arquivos, {
      brain: "/home/lia/Brain",
      pasta,
      app: "Tenancy",
      cliExiste: async () => true,
      iniciar: async () => {
        throw new Error("a CLI caiu");
      },
    });
    expect(r).toMatchObject({ abriu: false, motivo: "sessao-falhou", pasta });
    expect(arquivos.existe(`${pasta}/prompt.txt`)).toBe(true);
    const cli = await abrirPasta(arquivos, {
      brain: "/home/lia/Brain",
      pasta,
      app: "Tenancy",
      cliExiste: async () => {
        throw new Error("sem shell");
      },
      iniciar: async () => true,
    });
    expect(cli).toMatchObject({ abriu: false, motivo: "cli-ausente", pasta });
    const espacos = new ArquivosNaMemoria({ [`${pasta}/prompt.txt`]: "   " });
    const r2 = await abrirPasta(espacos, { brain: "/home/lia/Brain", pasta, app: "Tenancy", cliExiste: async () => true, iniciar: async () => true });
    expect(r2.abriu).toBe(true);
  });

  it("prazo de cobrança nunca é menor que um dia útil", () => {
    expect(cobrar("aguardando-resposta", "2026-10-23", "2026-10-23", 0)).toBe(false);
    expect(cobrar("aguardando-resposta", "2026-10-23", "2026-10-26", 0)).toBe(true);
    expect(cobrar("aguardando-resposta", "2026-10-23", "2026-10-26", 2)).toBe(false);
  });
});

describe("Envios", () => {
  it("CP-ENV-01 lê a pasta e os anexos", () => {
    const c = caso(envios, "CP-ENV-01");
    const e = lerEnvio(new ArquivosNaMemoria(c.entrada.arquivos), c.entrada.pasta);
    expect({
      estado: e.estado,
      pessoa: e.pessoa,
      assunto: e.assunto,
      data: e.data,
      anexos: e.anexos,
      paraQuem: e.paraQuem,
      porOnde: e.porOnde,
      temMensagem: e.temMensagem,
      enviadaEm: e.enviadaEm,
    }).toEqual(c.esperado);
  });

  it("CP-ENV-02 decide se espera resposta", () => {
    const c = caso(envios, "CP-ENV-02");
    for (const [i, v] of c.entrada.variantes.entries()) {
      const pasta = "/home/lia/Brain/envios/a-enviar/2026-10-28 Lia Pereira - aviso";
      const e = lerEnvio(new ArquivosNaMemoria({ [`${pasta}/LEIA.txt`]: v.leia }), pasta);
      const { nome, ...esperado } = c.esperado.variantes[i];
      expect({ disseOQueVolta: e.disseOQueVolta, esperaResposta: e.esperaResposta }, nome).toEqual(esperado);
    }
  });

  it("CP-ENV-03 Enviei grava o dia, move e desfaz a data se mover falhar", () => {
    const c = caso(envios, "CP-ENV-03");
    for (const [i, v] of c.entrada.variantes.entries()) {
      const arquivos = new ArquivosNaMemoria(v.arquivos, {}, { falhaAoMover: v.falhaAoMover });
      const e = c.esperado.variantes[i];
      if (e.erro) {
        expect(() => enviei(arquivos, c.entrada.pasta, hoje(c)), e.nome).toThrow();
        expect(arquivos.existe(`${c.entrada.pasta}/enviado-em.txt`)).toBe(false);
        expect(arquivos.existe(`${c.entrada.pasta}/LEIA.txt`)).toBe(true);
        continue;
      }
      const r = enviei(arquivos, c.entrada.pasta, hoje(c));
      expect(r.pergunta, e.nome).toBe(false);
      expect(r.pasta, e.nome).toBe(e.pasta);
      expect(r.gravouAData, e.nome).toBe(e.gravouAData);
      expect(arquivos.ler(`${e.pasta}/enviado-em.txt`), e.nome).toBe(e.enviadoEm);
    }
  });

  it("CP-ENV-04 LEIA calado pergunta, e a resposta decide", () => {
    const c = caso(envios, "CP-ENV-04");
    for (const [i, v] of c.entrada.variantes.entries()) {
      const arquivos = new ArquivosNaMemoria(c.entrada.arquivos);
      const r = enviei(arquivos, c.entrada.pasta, hoje(c), v.resposta ?? undefined);
      const e = c.esperado.variantes[i];
      expect(r.pergunta, e.nome).toBe(e.pergunta);
      expect(r.pasta, e.nome).toBe(e.pasta);
      expect(arquivos.existe(`${e.pasta}/LEIA.txt`), e.nome).toBe(true);
    }
  });

  it("CP-ENV-05 informa o dia do envio e desfaz só esse arquivo", () => {
    const c = caso(envios, "CP-ENV-05");
    for (const [i, v] of c.entrada.variantes.entries()) {
      const arquivos = new ArquivosNaMemoria(v.arquivos);
      const antes = arquivos.todos();
      const r = informarDia(arquivos, v.pasta, v.dia, hoje(c));
      const e = c.esperado.variantes[i];
      if (e.recusa) {
        expect(r, e.nome).toEqual({ recusa: e.recusa });
        expect(arquivos.todos(), e.nome).toEqual(antes);
        continue;
      }
      expect(r).toEqual({ gravou: e.gravou });
      expect(arquivos.ler(e.gravou)).toBe(e.conteudo);
      if (v.desfazer) {
        desfazerDia(arquivos, e.gravou);
        expect(Object.keys(arquivos.todos())).toEqual(e.depoisDeDesfazer);
      }
    }
  });

  it("CP-ENV-06 separa a mensagem por bloco", () => {
    const c = caso(envios, "CP-ENV-06");
    for (const [i, v] of c.entrada.variantes.entries()) {
      expect(blocosDaMensagem(v.mensagem), v.nome).toEqual(c.esperado.variantes[i].blocos);
    }
  });

  it("CP-ENV-07 cobra depois de três dias úteis, com o lembrete sem travessão", () => {
    const c = caso(envios, "CP-ENV-07");
    const enviadaEm = c.entrada.arquivos["enviado-em.txt"].trim();
    expect(diasUteis(enviadaEm, hoje(c))).toBe(c.esperado.diasUteis);
    expect(cobrar("aguardando-resposta", enviadaEm, hoje(c), c.entrada.prazo)).toBe(c.esperado.cobrar);
    for (const d of c.entrada.outrosDias) {
      expect(diasUteis(enviadaEm, hoje(c, d.relogio))).toBe(d.diasUteis);
      expect(cobrar("aguardando-resposta", enviadaEm, hoje(c, d.relogio), c.entrada.prazo)).toBe(d.cobrar);
    }
    expect(cobrar("aguardando-resposta", null, hoje(c), c.entrada.prazo)).toBe(false);
    expect(cobrar("enviados", enviadaEm, hoje(c), c.entrada.prazo)).toBe(false);
    const texto = lembrete(c.entrada.pessoa, enviadaEm);
    expect(texto).toBe(c.esperado.lembrete);
    expect(texto).not.toMatch(/[—–]/);
  });
});
