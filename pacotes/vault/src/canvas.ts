// O arquivo .canvas (JSON Canvas 1.0, o do Obsidian). Ler nunca inventa: o arquivo que não abre
// é erro, e quem chama não grava por cima dele. Gravar sai sempre igual para o mesmo canvas, com
// os mesmos bytes que o Mac: uma linha por nó e por aresta, tab, chaves na ordem da spec, sem `\/`.

export type ValorJSON = string | number | boolean | null | ValorJSON[] | { [k: string]: ValorJSON };
type Objeto = { [k: string]: ValorJSON };

export class ErroDoCanvas extends Error {
  constructor(readonly motivo: string) {
    super(`O canvas não abriu: ${motivo}.`);
  }
}

const CHAVES_DO_NO = ["id", "type", "x", "y", "width", "height", "color", "text", "file", "subpath", "url", "label", "background", "backgroundStyle"];
const OPCIONAIS_DO_NO = CHAVES_DO_NO.slice(6);
const CHAVES_DA_ARESTA = ["id", "fromNode", "fromSide", "fromEnd", "toNode", "toSide", "toEnd", "color", "label"];

/** Um nó ou uma aresta: as chaves conhecidas como vieram (texto, número ou null) e o resto em extras. */
export interface Peca {
  conhecidas: Objeto;
  extras: Objeto;
}

export interface Canvas {
  nos: Peca[];
  arestas: Peca[];
  extras: Objeto;
}

function ehObjeto(v: unknown): v is Objeto {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function separar(o: Objeto, chaves: string[]): Peca {
  const conhecidas: Objeto = {};
  const extras: Objeto = {};
  for (const [k, v] of Object.entries(o)) {
    if (!chaves.includes(k)) extras[k] = v;
    // Conhecida com outro tipo (número no lugar de texto) some, como no Mac; null volta null.
    else if (v === null || typeof v === "string" || typeof v === "number") conhecidas[k] = v;
  }
  return { conhecidas, extras };
}

function lerNo(v: ValorJSON): Peca {
  if (!ehObjeto(v)) throw new ErroDoCanvas("um nó não é um objeto");
  if (typeof v.id !== "string" || typeof v.type !== "string") throw new ErroDoCanvas('um nó sem "id" ou "type"');
  for (const k of ["x", "y", "width", "height"]) {
    if (typeof v[k] !== "number") throw new ErroDoCanvas(`um nó sem "${k}"`);
  }
  const p = separar(v, CHAVES_DO_NO);
  for (const k of OPCIONAIS_DO_NO) if (typeof p.conhecidas[k] === "number") delete p.conhecidas[k];
  return p;
}

function lerAresta(v: ValorJSON): Peca {
  if (!ehObjeto(v)) throw new ErroDoCanvas("uma aresta não é um objeto");
  if (typeof v.id !== "string" || typeof v.fromNode !== "string" || typeof v.toNode !== "string") {
    throw new ErroDoCanvas('uma aresta sem "id", "fromNode" ou "toNode"');
  }
  const p = separar(v, CHAVES_DA_ARESTA);
  for (const k of CHAVES_DA_ARESTA) if (typeof p.conhecidas[k] === "number") delete p.conhecidas[k];
  return p;
}

export function lerCanvas(texto: string): Canvas {
  // O Obsidian cria o arquivo novo vazio: é um canvas sem nada.
  if (texto.trim() === "") return { nos: [], arestas: [], extras: {} };
  let raiz: ValorJSON;
  try {
    raiz = JSON.parse(texto);
  } catch {
    throw new ErroDoCanvas("o arquivo não é JSON");
  }
  if (!ehObjeto(raiz)) throw new ErroDoCanvas("o arquivo não é um canvas");
  const c: Canvas = { nos: [], arestas: [], extras: {} };
  if ("nodes" in raiz) {
    if (!Array.isArray(raiz.nodes)) throw new ErroDoCanvas('"nodes" não é uma lista');
    c.nos = raiz.nodes.map(lerNo);
  }
  if ("edges" in raiz) {
    if (!Array.isArray(raiz.edges)) throw new ErroDoCanvas('"edges" não é uma lista');
    c.arestas = raiz.edges.map(lerAresta);
  }
  for (const [k, v] of Object.entries(raiz)) if (k !== "nodes" && k !== "edges") c.extras[k] = v;
  return c;
}

/** Aspas com os escapes que o formato pede, e nenhum a mais (sem `\/`). */
export function aspas(s: string): string {
  let r = '"';
  for (const ch of s) {
    const u = ch.codePointAt(0)!;
    if (ch === '"') r += '\\"';
    else if (ch === "\\") r += "\\\\";
    else if (ch === "\n") r += "\\n";
    else if (ch === "\r") r += "\\r";
    else if (ch === "\t") r += "\\t";
    else if (u === 0x08) r += "\\b";
    else if (u === 0x0c) r += "\\f";
    else if (u < 0x20) r += "\\u" + u.toString(16).padStart(4, "0");
    else r += ch;
  }
  return r + '"';
}

/** Inteiro sem ".0". */
export function numero(n: number): string {
  if (Number.isFinite(n) && Number.isInteger(n) && Math.abs(n) < 1e15) return String(n === 0 ? 0 : n);
  return Number.isFinite(n) ? String(n) : "0";
}

function ordenadas(o: Objeto): string[] {
  return Object.keys(o).sort();
}

/** Compacto, com as chaves em ordem: o mesmo valor grava sempre igual. */
export function json(v: ValorJSON): string {
  if (v === null) return "null";
  if (typeof v === "string") return aspas(v);
  if (typeof v === "number") return numero(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return "[" + v.map(json).join(",") + "]";
  return "{" + ordenadas(v).map((k) => aspas(k) + ":" + json(v[k])).join(",") + "}";
}

function linha(p: Peca, ordem: string[]): string {
  const pares = ordem.filter((k) => k in p.conhecidas).map((k) => aspas(k) + ":" + json(p.conhecidas[k]));
  for (const k of ordenadas(p.extras)) pares.push(aspas(k) + ":" + json(p.extras[k]));
  return "{" + pares.join(",") + "}";
}

function bloco(linhas: string[]): string {
  return linhas.length === 0 ? "[]" : "[\n" + linhas.map((l) => "\t\t" + l).join(",\n") + "\n\t]";
}

export function escreverCanvas(c: Canvas): string {
  let s = "{\n";
  s += '\t"nodes":' + bloco(c.nos.map((n) => linha(n, CHAVES_DO_NO)));
  s += ',\n\t"edges":' + bloco(c.arestas.map((a) => linha(a, CHAVES_DA_ARESTA)));
  for (const k of ordenadas(c.extras)) s += ",\n\t" + aspas(k) + ":" + json(c.extras[k]);
  return s + "\n}\n";
}

/**
 * O arquivo do nó, só quando ele fica dentro do vault. O canvas de um espaço vem do git de outra
 * pessoa: caminho absoluto, com `~`, com `..` ou nas formas do Windows não se lê, não se abre e não
 * se edita.
 */
export function arquivoNoVault(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (caminho.startsWith("/") || caminho.startsWith("~") || caminho.startsWith("\\")) return null;
  if (/^[A-Za-z]:/.test(caminho)) return null;
  if (caminho.split(/[/\\]/).includes("..")) return null;
  return caminho;
}
