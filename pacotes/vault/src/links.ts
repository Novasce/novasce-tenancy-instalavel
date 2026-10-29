// Os links de uma nota: `[[alvo#seção|apelido]]`, `![[anexo]]` e `[texto](caminho.md)`. Contam só
// os do corpo, fora das propriedades, do bloco de código e do código em linha, como no Obsidian.

import { nome, type Arquivos } from "./arquivos";

export const WIKI = /(!?)\[\[([^[\]\n]+?)\]\]/gu;
export const MARKDOWN = /(!?)\[([^\]\n]*)\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/gu;
const CODIGO_EM_LINHA = /`[^`\n]*`/gu;

/** Quantas linhas as propriedades (`---` no topo) ocupam, com os dois `---`; 0 sem propriedades. */
export function linhasDasPropriedades(texto: string): number {
  if (!texto.startsWith("---")) return 0;
  const linhas = texto.split("\n").slice(0, 302);
  if (linhas[0].trim() !== "---") return 0;
  const fim = linhas.slice(1, 301).findIndex((l) => l.trim() === "---");
  return fim < 0 ? 0 : fim + 2;
}

/** A linha abre ou fecha um bloco de código: três crases depois dos espaços do começo. */
export function ehCerca(linha: string): boolean {
  return /^[ \t]*```/u.test(linha);
}

export function semMd(s: string): string {
  return s.toLowerCase().endsWith(".md") ? s.slice(0, -3) : s;
}

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Os trechos de código em linha da linha, para pular o link que cai dentro deles. */
export function trechosDeCodigo(linha: string): [number, number][] {
  return [...linha.matchAll(CODIGO_EM_LINHA)].map((m) => [m.index!, m.index! + m[0].length]);
}

function dentro(trechos: [number, number][], ini: number, fim: number): boolean {
  return trechos.some(([a, b]) => ini < b && a < fim);
}

/** "Proposta#Preço|a proposta" vira ["Proposta", "#Preço|a proposta"]: o alvo e o resto, cru. */
export function partirWiki(interno: string): [string, string] {
  const barra = interno.indexOf("|");
  const ateBarra = barra < 0 ? interno.length : barra;
  const m = interno.slice(0, ateBarra).search(/[#^]/u);
  const corte = m < 0 ? ateBarra : m;
  return [interno.slice(0, corte), interno.slice(corte)];
}

/** Os alvos de link do corpo da nota (sem seção, apelido nem `.md`). */
export function alvos(texto: string): string[] {
  const saida: string[] = [];
  const inicio = linhasDasPropriedades(texto);
  let emCodigo = false;
  texto.split("\n").forEach((l, i) => {
    if (i < inicio) return;
    if (ehCerca(l)) {
      emCodigo = !emCodigo;
      return;
    }
    if (emCodigo) return;
    const codigo = trechosDeCodigo(l);
    for (const m of l.matchAll(WIKI)) {
      if (dentro(codigo, m.index!, m.index! + m[0].length)) continue;
      const alvo = semMd(partirWiki(m[2])[0].trim());
      if (alvo) saida.push(alvo);
    }
    for (const m of l.matchAll(MARKDOWN)) {
      if (dentro(codigo, m.index!, m.index! + m[0].length) || m[3].includes("://")) continue;
      saida.push(semMd(decodificar(m[3])));
    }
  });
  return saida;
}

export interface NotaNoIndice {
  /** Relativo à raiz: "Notas/Plano.md". */
  caminho: string;
  /** Sem a extensão: "Plano". */
  nome: string;
  alvos: string[];
}

/** As notas e os canvas de um vault. Nome que começa com ponto fica de fora. */
export class Indice {
  readonly notas = new Map<string, NotaNoIndice>();
  private porCaminho = new Map<string, string>();
  private porNome = new Map<string, string[]>();

  constructor(arquivos: Arquivos, readonly raiz: string) {
    const andar = (rel: string) => {
      const abs = rel === "" ? raiz : `${raiz}/${rel}`;
      for (const n of arquivos.listar(abs)) {
        if (n.startsWith(".")) continue;
        const r = rel === "" ? n : `${rel}/${n}`;
        if (arquivos.ehPasta(`${raiz}/${r}`)) andar(r);
        else if (n.toLowerCase().endsWith(".md")) this.por(r, arquivos.ler(`${raiz}/${r}`) ?? "");
      }
    };
    andar("");
  }

  private por(caminho: string, texto: string) {
    const n = nome(caminho).slice(0, -3);
    this.notas.set(caminho, { caminho, nome: n, alvos: alvos(texto) });
    this.porCaminho.set(caminho.toLowerCase(), caminho);
    const k = n.toLowerCase();
    this.porNome.set(k, [...(this.porNome.get(k) ?? []), caminho]);
  }

  /** A nota de um alvo: pelo caminho, ou pelo nome (a mais rasa ganha). */
  resolver(alvo: string): NotaNoIndice | undefined {
    const a = alvo.trim().toLowerCase();
    if (!a) return undefined;
    const comMd = a.endsWith(".md") ? a : a + ".md";
    const exato = this.porCaminho.get(comMd);
    if (exato) return this.notas.get(exato);
    const n = nome(comMd).slice(0, -3);
    const candidatos = (this.porNome.get(n) ?? []).filter((c) => !a.includes("/") || c.toLowerCase().endsWith(comMd));
    const melhor = candidatos.sort((x, y) => x.split("/").length - y.split("/").length || (x < y ? -1 : x > y ? 1 : 0))[0];
    return melhor ? this.notas.get(melhor) : undefined;
  }
}
