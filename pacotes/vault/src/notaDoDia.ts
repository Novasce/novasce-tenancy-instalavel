// A nota do dia (`Diário/AAAA-MM-DD.md`) e o bloco que o app escreve nela, entre marcas que o
// Obsidian não mostra. O bloco é o que deixa desfazer tirar só o que o app escreveu.

import { nome, pai, type Arquivos } from "./arquivos";

function partes(instante: string, fuso: string): Record<string, string> {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(new Date(instante))) p[type] = value;
  const n = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" });
  p.iso = n.format(new Date(instante));
  return p;
}

/** "2026-10-23": o dia do instante no fuso da casa. */
export function diaDaCasa(instante: string, fuso: string): string {
  return partes(instante, fuso).iso;
}

export function caminhoDaNota(dia: string): string {
  return `Diário/${dia}.md`;
}

/** "# Sexta-feira, 23 de outubro". */
export function tituloDaNota(instante: string, fuso: string): string {
  const p = partes(instante, fuso);
  const s = `${p.weekday}, ${p.day} de ${p.month}`;
  return "# " + s.charAt(0).toUpperCase() + s.slice(1);
}

export const abre = (marca: string) => `<!-- jarvis:${marca} -->`;
export const fecha = (marca: string) => `<!-- /jarvis:${marca} -->`;

function semQuebras(s: string): string {
  return s.replace(/^[\r\n]+|[\r\n]+$/g, "");
}

export function embrulhar(conteudo: string, marca: string): string {
  return `${abre(marca)}\n${semQuebras(conteudo)}\n${fecha(marca)}\n`;
}

function achar(texto: string, marca: string): { inicio: number; fimDaMarca: number; dentro: [number, number] } | null {
  const a = texto.indexOf(abre(marca));
  if (a < 0) return null;
  const depoisDaAbertura = a + abre(marca).length;
  const f = texto.indexOf(fecha(marca), depoisDaAbertura);
  if (f < 0) return null;
  return { inicio: a, fimDaMarca: f + fecha(marca).length, dentro: [depoisDaAbertura, f] };
}

/** O conteúdo do bloco, sem espaços nem quebras nas pontas; nulo quando a marca não está lá. */
export function conteudoDoBloco(texto: string, marca: string): string | null {
  const b = achar(texto, marca);
  return b ? texto.slice(b.dentro[0], b.dentro[1]).trim() : null;
}

/** Troca o conteúdo de um bloco que já existe; nulo quando a marca não está lá. */
export function trocarBloco(texto: string, marca: string, conteudo: string): string | null {
  const b = achar(texto, marca);
  if (!b) return null;
  let fim = b.fimDaMarca;
  if (texto[fim] === "\n") fim++;
  return texto.slice(0, b.inicio) + embrulhar(conteudo, marca) + texto.slice(fim);
}

/** O texto sem o bloco e sem até duas quebras de linha que vinham depois dele. */
export function tirarBloco(texto: string, marca: string): string | null {
  const b = achar(texto, marca);
  if (!b) return null;
  let fim = b.fimDaMarca;
  if (texto[fim] === "\n") fim++;
  if (texto[fim] === "\n") fim++;
  return texto.slice(0, b.inicio) + texto.slice(fim);
}

/** Com CRLF a nota é tratada em LF e volta em CRLF; a nota nova nasce em LF. */
function comFimDeLinha(atual: string | null, mudar: (lf: string | null) => string): string {
  if (atual === null || !atual.includes("\r\n")) return mudar(atual);
  return mudar(atual.replace(/\r\n/g, "\n")).replace(/\n/g, "\r\n");
}

/** Põe o briefing logo depois do primeiro título `# `, ou troca o bloco que já estava. */
export function comBriefing(atual: string | null, briefing: string, titulo: string): string {
  return comFimDeLinha(atual, (lf) => {
    const base = lf ?? titulo + "\n\n";
    const trocado = trocarBloco(base, "briefing", briefing);
    if (trocado !== null) return trocado;
    const linhas = base.split("\n");
    const t = linhas.findIndex((l) => l.startsWith("# "));
    if (t >= 0) {
      const antes = linhas.slice(0, t + 1).join("\n");
      const depois = semQuebras(linhas.slice(t + 1).join("\n"));
      return antes + "\n\n" + embrulhar(briefing, "briefing") + (depois === "" ? "" : "\n" + depois + "\n");
    }
    return embrulhar(briefing, "briefing") + "\n" + base;
  });
}

export type Desfeito = { desfez: true; texto: string } | { desfez: false; aviso: string; texto: string };

/**
 * Desfaz o bloco que o app gravou. O que a pessoa escreveu dentro dele depois fica, e o aviso
 * diz por quê. O Mac guarda o SHA-256 do conteúdo; aqui guardamos o conteúdo, com o mesmo efeito.
 */
export function desfazerBloco(texto: string, marca: string, conteudoGravado: string): Desfeito {
  const agora = conteudoDoBloco(texto, marca);
  if (agora !== null && agora !== conteudoGravado.trim()) {
    return { desfez: false, aviso: "você escreveu dentro do bloco depois; tire à mão se quiser", texto };
  }
  const novo = tirarBloco(texto, marca);
  if (novo === null) return { desfez: false, aviso: "o bloco já saiu da nota", texto };
  return { desfez: true, texto: novo };
}

/** O caminho que existe no disco para este, comparando cada parte pela forma NFC. */
export function localizar(arquivos: Arquivos, caminho: string): string | null {
  if (arquivos.existe(caminho)) return caminho;
  const p = pai(caminho);
  if (p === caminho || p === "") return null;
  const pasta = localizar(arquivos, p);
  if (pasta === null) return null;
  const procurado = nome(caminho).normalize("NFC");
  const achado = arquivos.listar(pasta).find((n) => n.normalize("NFC") === procurado);
  return achado === undefined ? null : (pasta === "/" ? "" : pasta) + "/" + achado;
}

export function lerNota(arquivos: Arquivos, caminho: string): string | null {
  const real = localizar(arquivos, caminho);
  return real === null ? null : arquivos.ler(real);
}

/** Grava no arquivo que já existe com o mesmo nome em outra forma; nota nova nasce em NFC. */
export function gravarNota(arquivos: Arquivos, caminho: string, texto: string): void {
  const real = localizar(arquivos, caminho);
  if (real !== null) return arquivos.gravar(real, texto);
  const pasta = localizar(arquivos, pai(caminho)) ?? pai(caminho).normalize("NFC");
  arquivos.gravar(pasta + "/" + nome(caminho).normalize("NFC"), texto);
}
