// Renomear e mover no vault levando os links junto (contrato 3). O link pelo nome muda quando o
// nome muda; o link com caminho e o de Markdown mudam quando o caminho muda. A troca vale no
// espaço da nota e nos vizinhos (o Pessoal) que apontam para ela. Mover entre espaços não existe:
// é o pacote. Desfazer só mexe no que ainda está como o app deixou.

import { nome, pai, type Arquivos } from "./arquivos";
import { Indice, MARKDOWN, WIKI, ehCerca, linhasDasPropriedades, partirWiki, semMd, trechosDeCodigo } from "./links";

export class ErroNoVault extends Error {}

export interface TextoMudado {
  raiz: string;
  /** Relativo à raiz, onde a nota está depois da mudança. */
  caminho: string;
  antes: string;
  depois: string;
}

export interface MudancaNoVault {
  raiz: string;
  de: string;
  para: string;
  textos: TextoMudado[];
  /** Quantas notas tiveram o link trocado, fora a própria. */
  religadas: number;
}

/** Tira do nome o que o Obsidian não aceita e junta os espaços. */
export function nomeLimpo(n: string): string {
  const limpo = n.split(/[/:\\[\]#^|]/u).join(" ").split(" ").filter((s) => s !== "").join(" ");
  return limpo === "" ? "Sem título" : [...limpo].slice(0, 120).join("");
}

function semExtensao(n: string): string {
  const i = n.lastIndexOf(".");
  return i <= 0 ? n : n.slice(0, i);
}

function extensao(n: string): string {
  const i = n.lastIndexOf(".");
  return i <= 0 ? "" : n.slice(i + 1);
}

export function renomear(arquivos: Arquivos, raiz: string, caminho: string, novoNome: string, vizinhos: string[] = []): MudancaNoVault {
  const ehPasta = arquivos.ehPasta(`${raiz}/${caminho}`);
  const limpo = nomeLimpo(novoNome);
  if (limpo.startsWith(".")) {
    throw new ErroNoVault(`O nome não pode começar com ponto: ${ehPasta ? "a pasta" : "a nota"} sumiria das listas.`);
  }
  const p = pai(caminho);
  const ext = extensao(nome(caminho));
  const novo = (p === "" ? "" : p + "/") + limpo + (ehPasta ? "" : "." + (ext === "" ? "md" : ext));
  if (novo === caminho) throw new ErroNoVault("O nome é o mesmo.");
  return mudar(arquivos, raiz, caminho, novo, ehPasta, vizinhos);
}

export function mover(arquivos: Arquivos, raiz: string, caminho: string, destino: string, vizinhos: string[] = []): MudancaNoVault {
  const ehPasta = arquivos.ehPasta(`${raiz}/${caminho}`);
  const partes = destino.split("/").filter((s) => s !== "").map(nomeLimpo);
  const ruim = partes.find((s) => s.startsWith("."));
  if (ruim !== undefined) {
    throw new ErroNoVault(`Pasta não começa com ponto (${ruim}): a nota sairia do espaço ou sumiria das listas.`);
  }
  const pasta = partes.join("/");
  if (ehPasta && (pasta.toLowerCase() === caminho.toLowerCase() || pasta.toLowerCase().startsWith(caminho.toLowerCase() + "/"))) {
    throw new ErroNoVault("Uma pasta não vai para dentro dela mesma.");
  }
  const novo = (pasta === "" ? "" : pasta + "/") + nome(caminho);
  if (novo === caminho) throw new ErroNoVault("Já está nessa pasta.");
  return mudar(arquivos, raiz, caminho, novo, ehPasta, vizinhos);
}

/**
 * Volta os textos que ainda estão como o app deixou e devolve a nota (ou a pasta) ao lugar.
 * Devolve as notas que ficaram como estavam porque mudaram depois.
 */
export function desfazer(arquivos: Arquivos, m: MudancaNoVault): string[] {
  if (!arquivos.existe(`${m.raiz}/${m.para}`)) throw new ErroNoVault(`${nome(m.para)} não está mais lá.`);
  if (m.de.toLowerCase() !== m.para.toLowerCase() && arquivos.existe(`${m.raiz}/${m.de}`)) {
    throw new ErroNoVault(`Já existe outra com o nome de antes: ${nome(m.de)}.`);
  }
  const ficaram = trocarTextos(arquivos, m.textos, "depois", "antes");
  try {
    arquivos.mover(`${m.raiz}/${m.para}`, `${m.raiz}/${m.de}`);
  } catch (e) {
    // O disco não deixou: os textos voltam ao que estavam, e nada fica pela metade.
    trocarTextos(arquivos, m.textos, "antes", "depois");
    throw e;
  }
  return ficaram;
}

export function refazer(arquivos: Arquivos, m: MudancaNoVault): string[] {
  if (!arquivos.existe(`${m.raiz}/${m.de}`)) throw new ErroNoVault(`${nome(m.de)} não está mais lá.`);
  if (m.de.toLowerCase() !== m.para.toLowerCase() && arquivos.existe(`${m.raiz}/${m.para}`)) {
    throw new ErroNoVault(`Já existe outra com esse nome: ${nome(m.para)}.`);
  }
  arquivos.mover(`${m.raiz}/${m.de}`, `${m.raiz}/${m.para}`);
  return trocarTextos(arquivos, m.textos, "antes", "depois");
}

function trocarTextos(arquivos: Arquivos, textos: TextoMudado[], de: "antes" | "depois", para: "antes" | "depois"): string[] {
  const ficaram: string[] = [];
  for (const t of textos) {
    // Antes de desfazer, a nota está no caminho de depois; depois de desfazer, no de antes. O
    // texto se confere onde ele está agora.
    const completo = `${t.raiz}/${t.caminho}`;
    if (arquivos.ler(completo) !== t[de]) {
      ficaram.push(t.caminho);
      continue;
    }
    arquivos.gravar(completo, t[para]);
  }
  return ficaram;
}

function mudar(arquivos: Arquivos, raiz: string, de: string, para: string, ehPasta: boolean, vizinhos: string[]): MudancaNoVault {
  if (!arquivos.existe(`${raiz}/${de}`)) throw new ErroNoVault(`${nome(de)} não está mais lá.`);
  if (para.split("/").includes("..")) throw new ErroNoVault("Esse destino fica fora do espaço.");
  const soACaixa = de.toLowerCase() === para.toLowerCase();
  if (!soACaixa && arquivos.existe(`${raiz}/${para}`)) {
    const oQue = ehPasta ? "uma pasta" : para.endsWith(".canvas") ? "um canvas" : "uma nota";
    throw new ErroNoVault(`Já existe ${oQue} com esse nome: ${nome(para)}.`);
  }
  const indice = new Indice(arquivos, raiz);
  const mapa = new Map<string, string>();
  if (ehPasta) {
    for (const c of indice.notas.keys()) if (c.startsWith(de + "/")) mapa.set(c, para + c.slice(de.length));
  } else {
    mapa.set(de, para);
  }
  const muda = (alvo: string) => {
    const n = indice.resolver(alvo);
    return n !== undefined && mapa.has(n.caminho);
  };
  const alvoNovo = (alvo: string, markdown: boolean): string | null => {
    const velho = indice.resolver(alvo)?.caminho;
    const novo = velho === undefined ? undefined : mapa.get(velho);
    if (velho === undefined || novo === undefined) return null;
    if (markdown || alvo.includes("/")) return semMd(novo);
    const nomeVelho = semExtensao(nome(velho));
    const nomeNovo = semExtensao(nome(novo));
    if (nomeVelho.toLowerCase() === nomeNovo.toLowerCase()) return null;
    const outra = [...indice.notas.values()].some((n) => n.nome.toLowerCase() === nomeNovo.toLowerCase() && !mapa.has(n.caminho));
    return outra ? semMd(novo) : nomeNovo;
  };

  const textos: TextoMudado[] = [];
  for (const n of indice.notas.values()) {
    const ehAPropria = !ehPasta && n.caminho === de;
    if (!(n.alvos.some(muda) || ehAPropria)) continue;
    const texto = arquivos.ler(`${raiz}/${n.caminho}`);
    if (texto === null) continue;
    let novo = trocarLinks(texto, alvoNovo) ?? texto;
    if (ehAPropria) novo = tituloNovo(novo, de, para);
    if (novo !== texto) textos.push({ raiz, caminho: mapa.get(n.caminho) ?? n.caminho, antes: texto, depois: novo });
  }
  // O vizinho (o Pessoal) que acha esta nota pelos links, quando ele mesmo não tem uma igual.
  for (const v of vizinhos) {
    if (v === raiz) continue;
    const dele = new Indice(arquivos, v);
    const deFora = (alvo: string, markdown: boolean) => (dele.resolver(alvo) === undefined ? alvoNovo(alvo, markdown) : null);
    for (const n of dele.notas.values()) {
      if (!n.alvos.some((a) => dele.resolver(a) === undefined && muda(a))) continue;
      const texto = arquivos.ler(`${v}/${n.caminho}`);
      const novo = texto === null ? null : trocarLinks(texto, deFora);
      if (texto !== null && novo !== null && novo !== texto) textos.push({ raiz: v, caminho: n.caminho, antes: texto, depois: novo });
    }
  }

  arquivos.mover(`${raiz}/${de}`, `${raiz}/${para}`);
  for (const t of textos) arquivos.gravar(`${t.raiz}/${t.caminho}`, t.depois);
  textos.sort((a, b) => (a.raiz + "\0" + a.caminho < b.raiz + "\0" + b.caminho ? -1 : 1));
  const religadas = textos.filter((t) => !(t.raiz === raiz && t.caminho === para)).length;
  return { raiz, de, para, textos, religadas };
}

/** O primeiro título da nota, quando ele é o nome velho, vira o nome novo. */
export function tituloNovo(texto: string, de: string, para: string): string {
  const velho = semExtensao(nome(de));
  const novo = semExtensao(nome(para));
  if (velho === novo) return texto;
  const linhas = texto.split("\n");
  const inicio = linhasDasPropriedades(texto);
  const i = linhas.findIndex((l, j) => j >= inicio && l.startsWith("# "));
  if (i < 0) return texto;
  const cr = linhas[i].endsWith("\r") ? "\r" : "";
  if (linhas[i].slice(2).trim() !== velho) return texto;
  linhas[i] = "# " + novo + cr;
  return linhas.join("\n");
}

/** Troca os links que `alvoNovo` disser, fora das propriedades e do código. Seção, apelido e `!` ficam. Nulo quando nada mudou. */
export function trocarLinks(texto: string, alvoNovo: (alvo: string, markdown: boolean) => string | null): string | null {
  const inicio = linhasDasPropriedades(texto);
  const linhas = texto.split("\n");
  let emCodigo = false;
  let mudou = false;
  for (let i = inicio; i < linhas.length; i++) {
    const l = linhas[i];
    if (ehCerca(l)) {
      emCodigo = !emCodigo;
      continue;
    }
    if (emCodigo) continue;
    const codigo = trechosDeCodigo(l);
    const noCodigo = (a: number, b: number) => codigo.some(([x, y]) => a < y && x < b);
    const trocas: [number, number, string][] = [];
    for (const m of l.matchAll(WIKI)) {
      if (noCodigo(m.index!, m.index! + m[0].length)) continue;
      const interno = m[2];
      const [alvoCru, resto] = partirWiki(interno);
      const alvo = semMd(alvoCru.trim());
      const novo = alvo === "" ? null : alvoNovo(alvo, false);
      if (novo === null) continue;
      const comMd = alvoCru.trim().toLowerCase().endsWith(".md");
      const ini = m.index! + m[1].length + 2;
      trocas.push([ini, ini + interno.length, novo + (comMd ? ".md" : "") + resto]);
    }
    for (const m of l.matchAll(MARKDOWN)) {
      if (noCodigo(m.index!, m.index! + m[0].length)) continue;
      const caminho = m[3];
      if (caminho.includes("://")) continue;
      let decodificado = caminho;
      try {
        decodificado = decodeURIComponent(caminho);
      } catch {
        /* fica cru */
      }
      const novo = alvoNovo(semMd(decodificado), true);
      if (novo === null) continue;
      const codificar = caminho !== decodificado || caminho.includes("%20");
      const url = (codificar ? novo.replace(/%/g, "%25").replace(/ /g, "%20") : novo) + ".md";
      const ini = m.index! + m[1].length + 1 + m[2].length + 2;
      trocas.push([ini, ini + caminho.length, url]);
    }
    if (trocas.length === 0) continue;
    let nova = l;
    for (const [a, b, s] of trocas.sort((x, y) => y[0] - x[0])) nova = nova.slice(0, a) + s + nova.slice(b);
    linhas[i] = nova;
    mudou = true;
  }
  return mudou ? linhas.join("\n") : null;
}
