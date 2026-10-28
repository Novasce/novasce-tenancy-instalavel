// Contraste de texto pela fórmula do WCAG, medido no motor que está desenhando a tela.
// Fundo semitransparente conta como o primeiro fundo opaco acima dele.

export type Cor = [number, number, number, number];

export function lerCor(css: string): Cor | null {
  const m = css.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+(\d*\.?\d+))?\s*\)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminancia([r, g, b]: [number, number, number] | Cor): number {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function razao(a: number, b: number): number {
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

function fundo(el: Element): Cor {
  for (let atual: Element | null = el; atual; atual = atual.parentElement) {
    const cor = lerCor(getComputedStyle(atual).backgroundColor);
    if (cor && cor[3] > 0) return cor;
  }
  return [255, 255, 255, 1];
}

export function contrastes(raiz: ParentNode): { nome: string; razao: number }[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>("[data-contraste]")).map((el) => {
    const texto = lerCor(getComputedStyle(el).color) ?? [0, 0, 0, 1];
    const r = razao(luminancia(texto), luminancia(fundo(el)));
    return { nome: el.dataset.contraste ?? "", razao: Math.round(r * 100) / 100 };
  });
}
