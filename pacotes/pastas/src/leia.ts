// O LEIA.txt das pastas do brain: texto livre, lido por seções. O título fica numa linha em
// maiúsculas ("ONDE PAROU (28/10, noite)"), com ou sem sublinhado, ou a chave vem na mesma linha
// do valor ("PRA QUEM  Lia" ou "PRAZO: sexta").

export interface Secao {
  titulo: string;
  detalhe: string | null;
  /** Linhas lógicas: cada parágrafo numa linha, cada item de lista numa linha. */
  linhas: string[];
}

export interface Leia {
  preambulo: string[];
  secoes: Secao[];
}

const tamanho = (s: string) => [...s].length;

function ehSublinhado(t: string): boolean {
  return tamanho(t) >= 3 && /^[-=]+$/.test(t);
}

/** "- x", "• x", "* x", "1. x", "2) x". */
function ehItem(t: string): boolean {
  if (t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ")) return true;
  return /^\d{1,3}(\. |\) )/.test(t);
}

function cabecalho(linha: string): { titulo: string; detalhe: string | null; valor: string | null } | null {
  const t = linha.trim();
  if (!t || tamanho(t) > 120 || ehItem(t)) return null;
  const corte = /\(|:| {2}/.exec(t);
  const fim = corte ? corte.index : t.length;
  const pelosEspacos = corte?.[0] === "  ";
  const chave = t.slice(0, fim).trim();
  const letras = (chave.match(/\p{L}/gu) ?? []).length;
  if (tamanho(chave) > 60 || letras < 4 || /\p{Ll}/u.test(chave) || !/^[\p{L}\p{N} ·/\-,&]*$/u.test(chave)) return null;
  let resto = t.slice(fim).trim();
  if (pelosEspacos) return { titulo: chave, detalhe: null, valor: resto || null };
  let detalhe: string | null = null;
  const fecha = resto.indexOf(")");
  if (resto.startsWith("(") && fecha > 0) {
    detalhe = resto.slice(1, fecha).trim();
    resto = resto.slice(fecha + 1).trim();
  }
  if (!resto) return { titulo: chave, detalhe, valor: null };
  if (!resto.startsWith(":")) return null;
  const valor = resto.slice(1).trim();
  return { titulo: chave, detalhe, valor: valor || null };
}

function logicas(brutas: string[]): string[] {
  const saida: string[] = [];
  let atual = "";
  const fechar = () => {
    if (atual) saida.push(atual);
    atual = "";
  };
  for (const linha of brutas) {
    const t = linha.trim();
    if (!t) {
      fechar();
      continue;
    }
    if (ehItem(t)) {
      fechar();
      atual = t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ") ? t.slice(2) : t;
    } else {
      atual = atual ? `${atual} ${t}` : t;
    }
  }
  fechar();
  return saida;
}

export function lerLeia(texto: string): Leia {
  const preambulo: string[] = [];
  const secoes: { titulo: string; detalhe: string | null; brutas: string[] }[] = [];
  for (const linha of texto.split(/\r\n|[\n\r\u2028\u2029\u0085\v\f]/)) {
    const t = linha.trim();
    if (ehSublinhado(t)) continue;
    const c = cabecalho(t);
    if (c) secoes.push({ titulo: c.titulo, detalhe: c.detalhe, brutas: c.valor ? [c.valor] : [] });
    else if (secoes.length === 0) preambulo.push(linha);
    else secoes[secoes.length - 1].brutas.push(linha);
  }
  return {
    preambulo: logicas(preambulo),
    secoes: secoes.map((s) => ({ titulo: s.titulo, detalhe: s.detalhe, linhas: logicas(s.brutas) })),
  };
}

/** A primeira seção cujo título contém uma das chaves; a ordem das chaves é a preferência. */
export function secao(leia: Leia, chaves: string[]): Secao | null {
  for (const chave of chaves) {
    const s = leia.secoes.find((x) => x.titulo.includes(chave));
    if (s) return s;
  }
  return null;
}

/** As linhas de todas as seções cujo título contém a chave, na ordem do arquivo. */
export function juntar(leia: Leia, chave: string): string[] {
  return leia.secoes.filter((s) => s.titulo.includes(chave)).flatMap((s) => s.linhas);
}

/** Minúsculas e sem acento, para comparar palavra. */
export function dobrar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
