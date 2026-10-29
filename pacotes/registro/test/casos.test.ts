import { describe, expect, it } from "vitest";
import {
  aplicar,
  desfazer,
  estadoDa,
  exportar,
  type Entrada,
  ofereceDesfazerNoRodape,
  pedirConfirmacao,
  podeConfirmar,
  podeDesfazer,
  refazer,
  regraDa,
  restaurar,
  rotuloDaLixeira,
  venceEm,
  vencidos,
  type Arquivos,
  type ItemNaLixeira,
} from "../src/index";
import { idsEsperados, lerCasos, type Caso } from "./ler-casos";

const desfazerCasos = lerCasos(
  import.meta.glob("../../../casos-de-prova/desfazer/*.json", { eager: true, import: "default" }),
  "CP-DES-",
);
const registroCasos = lerCasos(
  import.meta.glob("../../../casos-de-prova/registro/*.json", { eager: true, import: "default" }),
  "CP-REG-",
);

// A ação do caso, em forma curta (mover ou mudar), vira uma entrada do Registro
// com o antes e o depois de cada arquivo.
interface AcaoDoCaso {
  id: string;
  hora: string;
  autor: string;
  acao: Entrada["acao"];
  titulo: string;
  chave?: string;
  conversa?: string;
  mover?: [string, string][];
  mudar?: Record<string, string>;
}

function entradaDe(a: AcaoDoCaso, arquivos: Arquivos): Entrada {
  const mudancas: Entrada["mudancas"] = [];
  for (const [de, para] of a.mover ?? []) {
    mudancas.push({ caminho: de, antes: arquivos[de], depois: null });
    mudancas.push({ caminho: para, antes: arquivos[para] ?? null, depois: arquivos[de] });
  }
  for (const [caminho, depois] of Object.entries(a.mudar ?? {})) {
    mudancas.push({ caminho, antes: arquivos[caminho] ?? null, depois });
  }
  const { mover: _m, mudar: _u, ...resto } = a;
  return { ...resto, mudancas };
}

function montar(caso: Caso): { registro: Entrada[]; arquivos: Arquivos } {
  let arquivos: Arquivos = { ...caso.entrada.arquivos };
  const registro: Entrada[] = [];
  for (const a of caso.entrada.acoes as AcaoDoCaso[]) {
    const e = entradaDe(a, arquivos);
    arquivos = aplicar(arquivos, e);
    registro.push(e);
  }
  return { registro, arquivos };
}

function resumo(r: ReturnType<typeof podeDesfazer>) {
  return r.pode ? { pode: true } : { pode: false, aviso: r.aviso, porCausaDe: r.porCausaDe };
}

describe("casos de prova do registro", () => {
  it("todos os casos da pasta estão aqui", () => {
    expect(desfazerCasos.map((c) => c.id)).toEqual(idsEsperados("CP-DES-", 4));
    expect(registroCasos.map((c) => c.id)).toEqual(idsEsperados("CP-REG-", 4));
  });

  const por = Object.fromEntries([...desfazerCasos, ...registroCasos].map((c) => [c.id, c]));

  it("CP-DES-01 reversível não confirma e o rodapé dura 10 s", () => {
    const c = por["CP-DES-01"];
    const inicial: Arquivos = c.entrada.arquivos;
    const e = entradaDe(c.entrada.acao, inicial);
    const depois = aplicar(inicial, e);
    expect(pedirConfirmacao(e.acao, 3).pergunta).toBe(c.esperado.pergunta);
    const registro = [e];
    expect(c.entrada.instantes.map((t: string) => ofereceDesfazerNoRodape(e, t))).toEqual(c.esperado.noRodape);
    expect(c.entrada.instantes.map(() => podeDesfazer(registro, e.id).pode)).toEqual(c.esperado.noRegistro);
    const volta = desfazer(registro, e.id, c.entrada.instantes[1], "Lia Pereira");
    expect(aplicar(depois, volta)).toEqual(inicial);
  });

  it("CP-DES-02 irreversível confirma com o alcance", () => {
    const c = por["CP-DES-02"];
    c.entrada.pedidos.forEach((p: { acao: Entrada["acao"]; quantos: number; digitado?: string[] }, i: number) => {
      const esperado = c.esperado.respostas[i];
      const conf = pedirConfirmacao(p.acao, p.quantos);
      expect(conf.pergunta).toBe(esperado.pergunta);
      if (!conf.pergunta) return;
      expect(conf.quantos).toBe(esperado.quantos);
      expect(conf.digitar).toBe(esperado.digitar);
      if (p.digitado) expect(p.digitado.map((d) => podeConfirmar(conf, d))).toEqual(esperado.confirma);
      expect(regraDa(p.acao).reversivel).toBe(esperado.desfazer);
    });
  });

  it("CP-DES-03 prazo de 30 dias pelo fuso", () => {
    const c = por["CP-DES-03"];
    const itens: ItemNaLixeira[] = c.entrada.itens;
    expect(venceEm(itens[0], c.fuso).toISOString()).toBe(c.esperado.venceEm);
    expect(c.entrada.instantes.map((t: string) => vencidos(itens, t, c.fuso).map((i) => i.id))).toEqual(c.esperado.vencidos);
    expect(c.entrada.instantes.map((t: string) => rotuloDaLixeira(itens[0], t, c.fuso))).toEqual(c.esperado.rotulos);
  });

  it("CP-DES-04 restaurar volta ao lugar", () => {
    const c = por["CP-DES-04"];
    const pastas = new Set<string>(c.entrada.pastas);
    const itens: ItemNaLixeira[] = c.entrada.itens;
    const restauros = itens.map((item) => {
      const r = restaurar(item, (p) => pastas.has(p));
      return r.tipo === "volta"
        ? { tipo: r.tipo, caminho: r.caminho, pausada: r.pausada, conteudoIgual: r.conteudo === item.conteudo }
        : { tipo: r.tipo, pasta: r.pasta };
    });
    expect(restauros).toEqual(c.esperado.restauros);
  });

  it("CP-REG-01 a mais nova primeiro no mesmo arquivo", () => {
    const c = por["CP-REG-01"];
    const { registro } = montar(c);
    expect({ a1: resumo(podeDesfazer(registro, "a1")), a2: resumo(podeDesfazer(registro, "a2")) }).toEqual(
      tirarIndefinidos(c.esperado.antes),
    );
    const depois = [...registro, desfazer(registro, "a2", c.relogio, "Lia Pereira")];
    expect({ a1: resumo(podeDesfazer(depois, "a1")) }).toEqual(c.esperado.depoisDeDesfazerA2);
  });

  it("CP-REG-02 arquivos diferentes não se prendem", () => {
    const c = por["CP-REG-02"];
    const { registro } = montar(c);
    expect({ a1: resumo(podeDesfazer(registro, "a1")), a2: resumo(podeDesfazer(registro, "a2")) }).toEqual(c.esperado.antes);
    const depois = [...registro, desfazer(registro, "a1", c.relogio, "Lia Pereira")];
    expect({ a2: resumo(podeDesfazer(depois, "a2")) }).toEqual(c.esperado.desfazerA1Primeiro);
  });

  it("CP-REG-03 a reversão também é registro", () => {
    const c = por["CP-REG-03"];
    const montado = montar(c);
    const d = c.entrada.desfazer;
    const reversao = desfazer(montado.registro, d.id, d.hora, d.autor);
    expect({ hora: reversao.hora, autor: reversao.autor, titulo: reversao.titulo, desfaz: reversao.desfaz }).toEqual(c.esperado.reversao);
    const registro = [...montado.registro, reversao];
    expect(registro.length).toBe(c.esperado.entradasDepoisDeDesfazer);
    let arquivos = aplicar(montado.arquivos, reversao);
    const nota = "Pessoal/Notas/2026-10-28.md";
    expect(arquivos[nota]).toBe(c.esperado.arquivoDepoisDeDesfazer);
    expect(estadoDa(registro, d.id)).toBe("desfeita");
    const r = refazer(registro, d.id, c.entrada.refazer.hora, c.entrada.refazer.autor);
    expect({ titulo: r.titulo, refaz: r.refaz }).toEqual(c.esperado.refazer);
    arquivos = aplicar(arquivos, r);
    expect(arquivos[nota]).toBe(c.esperado.arquivoDepoisDeRefazer);
    const final = [...registro, r];
    expect({ a1: estadoDa(final, "a1"), a2: estadoDa(final, "a2") }).toEqual(c.esperado.estados);
  });

  it("CP-REG-04 exportar sem segredo e sem conversa", () => {
    const c = por["CP-REG-04"];
    const { registro } = montar(c);
    const saidas = c.entrada.formatos.map((f: "md" | "csv") => exportar(registro, f, c.entrada.de, c.entrada.ate, c.fuso));
    expect(saidas.map((s: { caminho: string }) => s.caminho)).toEqual(c.esperado.caminhos);
    for (const s of saidas) {
      expect(s.linhas).toBe(c.esperado.linhas);
      for (const t of c.esperado.tem) expect(s.conteudo).toContain(t);
      for (const t of c.esperado.naoTem) expect(s.conteudo).not.toContain(t);
    }
  });
});

function tirarIndefinidos<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
