import { describe, expect, it } from "vitest";
import {
  ACOES_QUE_APAGAM,
  TABELA_DE_TECLAS,
  abrirLista,
  acaoDaTecla,
  contagem,
  type Efeito,
  grupoDePrazo,
  janelaVisivel,
  type Item,
  type Lista,
  type MemoriaDeOrdem,
  pressionar,
  trocarFiltro,
  trocarOrdem,
  visiveis,
} from "../src/index";
import { idsEsperados, lerCasos, type Caso } from "./ler-casos";

const casos = lerCasos(
  import.meta.glob("../../../casos-de-prova/lista/*.json", { eager: true, import: "default" }),
  "CP-LST-",
);
const por: Record<string, Caso> = Object.fromEntries(casos.map((c) => [c.id, c]));

// Itens gerados pelo caso: "Peça de exemplo {n}", de 1 a quantos, ids p1, p2...
function itensDo(caso: Caso): Item[] {
  const g = caso.entrada.gerar;
  const gerados: Item[] = g
    ? Array.from({ length: g.quantos }, (_, i) => ({ id: `p${i + 1}`, titulo: g.titulo.replace("{n}", String(i + 1)), espaco: g.espaco }))
    : [];
  return [...gerados, ...(caso.entrada.itens ?? [])];
}

function abrir(caso: Caso, memoria: MemoriaDeOrdem = {}): Lista {
  return abrirLista({
    nome: caso.entrada.lista ?? "Lista de exemplo",
    itens: itensDo(caso),
    acesso: caso.entrada.acesso,
    relogio: caso.relogio,
    fuso: caso.fuso,
    ordem: caso.entrada.ordem,
    memoria,
  });
}

function teclar(lista: Lista, teclas: string[]): { lista: Lista; efeitos: Efeito[] } {
  const efeitos: Efeito[] = [];
  for (const t of teclas) {
    const r = pressionar(lista, t);
    lista = r.lista;
    if (r.efeito) efeitos.push(r.efeito);
  }
  return { lista, efeitos };
}

describe("casos de prova da lista", () => {
  it("todos os casos da pasta estão aqui", () => {
    expect(casos.map((c) => c.id)).toEqual(idsEsperados("CP-LST-", 5));
  });

  it("CP-LST-01 contagem do alcance", () => {
    const c = por["CP-LST-01"];
    const lista = abrir(c);
    expect(lista.itens.length).toBe(c.esperado.total);
    expect(contagem(lista)).toBe(c.esperado.contagem);
    const comBusca = { ...lista, busca: c.entrada.busca };
    expect(contagem(comBusca)).toBe(c.esperado.comBusca);
    expect(visiveis(comBusca).map((i) => i.id)).toEqual(c.esperado.achados);
  });

  it("CP-LST-02 seleção e lote", () => {
    const c = por["CP-LST-02"];
    const { efeitos } = teclar(abrir(c), c.entrada.teclas);
    expect(efeitos).toEqual(c.esperado.efeitos);
    const depois = teclar(abrir(c), c.entrada.depois.teclas).lista;
    expect(depois.selecao).toEqual(c.esperado.selecaoAntesDoFiltro);
    const filtrada = trocarFiltro(depois, c.entrada.depois.filtro);
    expect(filtrada.lista.selecao).toEqual(c.esperado.selecaoDepoisDoFiltro);
    expect(filtrada.aviso).toBe(c.esperado.aviso);
  });

  it("CP-LST-03 ordem por prazo, lembrada e estável", () => {
    const c = por["CP-LST-03"];
    const memoria: MemoriaDeOrdem = {};
    const lista = trocarOrdem(abrir(c, memoria), c.entrada.ordem, memoria);
    expect(visiveis(lista).map((i) => i.id)).toEqual(c.esperado.ordem);
    expect(visiveis(lista).map((i) => grupoDePrazo(i, c.relogio, c.fuso))).toEqual(c.esperado.grupos);
    // Reabrir com a memória gravada e com os itens em outra ordem de chegada.
    const gravada: MemoriaDeOrdem = JSON.parse(JSON.stringify(memoria));
    const reaberta = abrirLista({
      nome: c.entrada.lista,
      itens: [...itensDo(c)].reverse(),
      acesso: c.entrada.acesso,
      relogio: c.relogio,
      fuso: c.fuso,
      memoria: gravada,
    });
    expect({ ordem: reaberta.ordem, ids: visiveis(reaberta).map((i) => i.id) }).toEqual(c.esperado.aoReabrir);
  });

  it("CP-LST-04 teclado", () => {
    const c = por["CP-LST-04"];
    const acoes = c.entrada.teclas.map((t: string) => acaoDaTecla(t));
    expect(acoes).toEqual(c.esperado.acoes);
    const todas: string[] = Object.values(TABELA_DE_TECLAS);
    expect(todas.some((a) => ACOES_QUE_APAGAM.includes(a))).toBe(!c.esperado.nenhumaApaga);
  });

  it("CP-LST-05 janela visível", () => {
    const c = por["CP-LST-05"];
    const { alturaLinha, alturaRegiao, grupos, rolagens } = c.entrada;
    expect(rolagens.map((rolagem: number) => janelaVisivel({ alturaLinha, alturaRegiao, grupos, rolagem }))).toEqual(
      c.esperado.janelas,
    );
  });
});
