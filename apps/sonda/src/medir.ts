// Medição de geometria: nada sai do lugar quando o estado muda, o foco entra ou o ponteiro passa.
// Cada região marcada com data-regiao é fotografada antes e depois; a diferença é o deslocamento.

export type Caixa = { nome: string; x: number; y: number; w: number; h: number };
export type Rolagem = { nome: string; x: number; y: number };
export type Retrato = { caixas: Caixa[]; rolagem: Rolagem[] };
export type Diferenca = { maior: number; mexeram: string[]; rolagemMudou: boolean };
export type Acao = { nome: string; fazer: () => void | Promise<void> };
export type ResultadoDaAcao = Diferenca & { nome: string };

const TOLERANCIA = 0.01;

export function retratar(raiz: ParentNode): Retrato {
  const caixas = Array.from(raiz.querySelectorAll<HTMLElement>("[data-regiao]")).map((el) => {
    const r = el.getBoundingClientRect();
    return { nome: el.dataset.regiao ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const rolagem = Array.from(raiz.querySelectorAll<HTMLElement>("[data-rolagem]")).map((el) => ({
    nome: el.dataset.rolagem ?? "",
    x: el.scrollLeft,
    y: el.scrollTop,
  }));
  return { caixas, rolagem };
}

export function comparar(antes: Retrato, depois: Retrato): Diferenca {
  const porNome = new Map(depois.caixas.map((c) => [c.nome, c]));
  let maior = 0;
  const mexeram: string[] = [];
  for (const a of antes.caixas) {
    const d = porNome.get(a.nome);
    const delta = d
      ? Math.max(Math.abs(a.x - d.x), Math.abs(a.y - d.y), Math.abs(a.w - d.w), Math.abs(a.h - d.h))
      : Math.max(a.w, a.h);
    if (delta > TOLERANCIA) {
      mexeram.push(a.nome);
      maior = Math.max(maior, Math.round(delta * 100) / 100);
    }
  }
  const rolagemDepois = new Map(depois.rolagem.map((r) => [r.nome, r]));
  const rolagemMudou = antes.rolagem.some((r) => {
    const d = rolagemDepois.get(r.nome);
    return !d || d.x !== r.x || d.y !== r.y;
  });
  return { maior, mexeram, rolagemMudou };
}

export function esperarQuadros(): Promise<void> {
  return new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(() => pronto())));
}

export async function medirAcoes(
  raiz: ParentNode,
  acoes: Acao[],
  esperar: () => Promise<void> = esperarQuadros,
): Promise<{ maior: number; acoes: ResultadoDaAcao[] }> {
  const base = retratar(raiz);
  const resultados: ResultadoDaAcao[] = [];
  for (const acao of acoes) {
    await acao.fazer();
    await esperar();
    resultados.push({ nome: acao.nome, ...comparar(base, retratar(raiz)) });
  }
  return { maior: Math.max(0, ...resultados.map((r) => r.maior)), acoes: resultados };
}

export function rolagemHorizontal(doc: Document): boolean {
  return doc.documentElement.scrollWidth > doc.documentElement.clientWidth;
}
