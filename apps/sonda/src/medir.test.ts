import { describe, expect, it } from "vitest";
import { comparar, medirAcoes, retratar, rolagemHorizontal, type Retrato } from "./medir";

function caixa(el: HTMLElement, x: number, y: number, w: number, h: number) {
  el.getBoundingClientRect = () => ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect;
}

function regiao(nome: string, x: number, y: number, w: number, h: number): HTMLElement {
  const el = document.createElement("div");
  el.dataset.regiao = nome;
  caixa(el, x, y, w, h);
  return el;
}

describe("retratar", () => {
  it("lê a caixa de cada região e a rolagem de cada área rolável", () => {
    const raiz = document.createElement("div");
    raiz.append(regiao("mesa", 0, 0, 800, 600), regiao("briefing", 800, 0, 300, 600));
    const rolavel = document.createElement("div");
    rolavel.dataset.rolagem = "missoes";
    rolavel.scrollTop = 0;
    raiz.append(rolavel);
    const r = retratar(raiz);
    expect(r.caixas).toEqual([
      { nome: "mesa", x: 0, y: 0, w: 800, h: 600 },
      { nome: "briefing", x: 800, y: 0, w: 300, h: 600 },
    ]);
    expect(r.rolagem).toEqual([{ nome: "missoes", x: 0, y: 0 }]);
  });
});

describe("comparar", () => {
  const base: Retrato = { caixas: [{ nome: "mesa", x: 0, y: 0, w: 800, h: 600 }], rolagem: [{ nome: "missoes", x: 0, y: 120 }] };

  it("nada mudou: deslocamento 0", () => {
    expect(comparar(base, structuredClone(base))).toEqual({ maior: 0, mexeram: [], rolagemMudou: false });
  });

  it("uma região que cresce 4 px dá 4", () => {
    const depois = structuredClone(base);
    depois.caixas[0].h = 604;
    expect(comparar(base, depois)).toEqual({ maior: 4, mexeram: ["mesa"], rolagemMudou: false });
  });

  it("região que some conta como deslocamento do seu maior lado", () => {
    expect(comparar(base, { caixas: [], rolagem: base.rolagem })).toEqual({ maior: 800, mexeram: ["mesa"], rolagemMudou: false });
  });

  it("rolagem que muda é registrada à parte", () => {
    const depois = structuredClone(base);
    depois.rolagem[0].y = 0;
    expect(comparar(base, depois).rolagemMudou).toBe(true);
  });

  it("diferença abaixo de um centésimo de pixel não conta", () => {
    const depois = structuredClone(base);
    depois.caixas[0].x = 0.004;
    expect(comparar(base, depois).maior).toBe(0);
  });
});

describe("medirAcoes", () => {
  it("compara cada ação com o retrato de antes e devolve o maior", async () => {
    const raiz = document.createElement("div");
    const mesa = regiao("mesa", 0, 0, 800, 600);
    raiz.append(mesa);
    const resultado = await medirAcoes(
      raiz,
      [
        { nome: "estado: vazio", fazer: () => undefined },
        { nome: "estado: erro", fazer: () => caixa(mesa, 0, 2, 800, 600) },
      ],
      async () => undefined,
    );
    expect(resultado.acoes).toEqual([
      { nome: "estado: vazio", maior: 0, mexeram: [], rolagemMudou: false },
      { nome: "estado: erro", maior: 2, mexeram: ["mesa"], rolagemMudou: false },
    ]);
    expect(resultado.maior).toBe(2);
  });
});

describe("rolagemHorizontal", () => {
  it("só quando o conteúdo é mais largo que a janela", () => {
    const doc = { documentElement: { scrollWidth: 1264, clientWidth: 1264 } } as unknown as Document;
    expect(rolagemHorizontal(doc)).toBe(false);
    const largo = { documentElement: { scrollWidth: 1300, clientWidth: 1264 } } as unknown as Document;
    expect(rolagemHorizontal(largo)).toBe(true);
  });
});
