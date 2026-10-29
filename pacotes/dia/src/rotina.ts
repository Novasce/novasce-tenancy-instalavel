// Uma rotina mora em `rotinas/<id>.md` no Pessoal: o pedido é o corpo, o resto vai no cabeçalho
// `---`. É o mesmo formato do Mac, para os dois lerem e gravarem os mesmos bytes.

export interface Rotina {
  id: string;
  nome: string;
  /** "dias úteis 07:15", como mora no arquivo. */
  quando: string;
  pedido: string;
  ia: "claude" | "codex" | "agy";
  habilidade: string | null;
  avisa: boolean;
  onde: "topo" | "fim";
  permite: string[];
  ligada: boolean;
  rascunho: boolean;
}

/** O cabeçalho `---`: só `chave: valor` numa linha, listas `[a, b]` e valor em bloco (`|`). */
export function lerFrontmatter(texto: string): { campos: Record<string, string>; corpo: string } {
  const linhas = texto.split("\n");
  const fim = linhas.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (linhas[0]?.trim() !== "---" || fim < 0) return { campos: {}, corpo: texto };
  const campos: Record<string, string> = {};
  let emBloco: string | null = null;
  for (const linha of linhas.slice(1, fim)) {
    if (emBloco !== null && (linha.startsWith(" ") || linha.startsWith("\t"))) {
      const resto = linha.trim();
      if (resto) campos[emBloco] = campos[emBloco] ? campos[emBloco] + " " + resto : resto;
      continue;
    }
    emBloco = null;
    const dois = linha.indexOf(":");
    if (dois < 0) continue;
    const chave = linha.slice(0, dois).trim();
    let valor = linha.slice(dois + 1).trim();
    if (valor.length >= 2 && (valor[0] === '"' || valor[0] === "'") && valor[0] === valor[valor.length - 1]) valor = valor.slice(1, -1);
    if (!chave) continue;
    if (["|", ">", "|-", ">-", "|+", ">+"].includes(valor)) {
      campos[chave] = "";
      emBloco = chave;
    } else campos[chave] = valor;
  }
  let corpo = linhas.slice(fim + 1).join("\n");
  while (corpo.startsWith("\n")) corpo = corpo.slice(1);
  return { campos, corpo };
}

/** Escreve na ordem dada; chave sem valor não sai. */
export function escreverFrontmatter(campos: Record<string, string>, corpo: string, ordem: string[]): string {
  let s = "---\n";
  for (const k of ordem) if (campos[k] !== undefined) s += `${k}: ${campos[k]}\n`;
  s += "---\n\n" + corpo;
  return s.endsWith("\n") ? s : s + "\n";
}

/** "[a, b]" ou "a, b" vira ["a", "b"]. */
export function lista(valor: string | undefined): string[] {
  let v = (valor ?? "").trim();
  if (!v) return [];
  if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1);
  return v
    .split(",")
    .map((s) => s.replace(/^[ "']+|[ "']+$/g, ""))
    .filter((s) => s !== "");
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** "sim", "true", "yes" são sim; "não", "false", "no" são não; o resto, nem um nem outro. */
export function sim(v: string): boolean | null {
  const t = semAcento(v.trim().toLowerCase());
  if (["sim", "s", "true", "yes", "1"].includes(t)) return true;
  if (["nao", "n", "false", "no", "0"].includes(t)) return false;
  return null;
}

const UTEIS = [2, 3, 4, 5, 6];
const NOMES: Record<number, string> = { 1: "domingos", 2: "segundas", 3: "terças", 4: "quartas", 5: "quintas", 6: "sextas", 7: "sábados" };
const CHAVES: [string, number][] = [["domingo", 1], ["segunda", 2], ["terca", 3], ["quarta", 4], ["quinta", 5], ["sexta", 6], ["sabado", 7]];

/** Lê "dias úteis 07:15", "sextas 9h" e devolve a forma do arquivo; nulo sem hora. */
export function horario(texto: string): string | null {
  const t = semAcento(texto.toLowerCase());
  const m = /(\d{1,2})(?::|h)(\d{2})?/u.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  if (h >= 24) return null;
  const min = Math.min(59, Number(m[2] ?? "0"));
  const dias = new Set<number>();
  if (t.includes("dias uteis") || t.includes("dia util")) UTEIS.forEach((d) => dias.add(d));
  for (const [nome, d] of CHAVES) if (t.includes(nome)) dias.add(d);
  const ordem = [...dias].sort((a, b) => a - b);
  let prefixo: string;
  if (ordem.length === 0 || ordem.length === 7) prefixo = "todo dia";
  else if (ordem.join() === UTEIS.join()) prefixo = "dias úteis";
  else {
    const nomes = ordem.map((d) => NOMES[d]);
    prefixo = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  }
  return `${prefixo} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** A rotina do arquivo. Nula sem nome, sem pedido ou sem hora. Na dúvida, fecha: ligada estranha é desligada. */
export function lerRotina(markdown: string, id: string): Rotina | null {
  const { campos, corpo } = lerFrontmatter(markdown);
  const pedido = corpo.trim();
  const quando = horario(campos.quando ?? "");
  if (!campos.nome || !pedido || quando === null) return null;
  const ia = campos.ia === "codex" || campos.ia === "agy" ? campos.ia : "claude";
  return {
    id,
    nome: campos.nome,
    quando,
    pedido,
    ia,
    habilidade: campos.habilidade ? campos.habilidade : null,
    avisa: campos.avisa === undefined ? true : (sim(campos.avisa) ?? true),
    onde: campos.onde === "topo" ? "topo" : "fim",
    permite: lista(campos.permite),
    ligada: campos.ligada === undefined ? true : (sim(campos.ligada) ?? false),
    rascunho: campos.rascunho === undefined ? false : (sim(campos.rascunho) ?? true),
  };
}

export function rotinaParaMarkdown(r: Rotina): string {
  const campos: Record<string, string> = {
    nome: r.nome,
    quando: horario(r.quando) ?? r.quando,
    ia: r.ia,
    avisa: r.avisa ? "sim" : "não",
    onde: r.onde,
    ligada: r.ligada ? "sim" : "não",
    rascunho: r.rascunho ? "sim" : "não",
  };
  if (r.habilidade) campos.habilidade = r.habilidade;
  if (r.permite.length > 0) campos.permite = "[" + r.permite.join(", ") + "]";
  return escreverFrontmatter(campos, r.pedido.trim() + "\n", ["nome", "quando", "ia", "habilidade", "avisa", "onde", "permite", "ligada", "rascunho"]);
}

/** O pedido que vai para a CLI: a habilidade nomeada na frente, quando há uma. */
export function pedidoFinal(r: Rotina): string {
  const p = r.pedido.trim();
  return r.habilidade ? `Use a habilidade ${r.habilidade} (.agents/skills/${r.habilidade}/SKILL.md). ${p}` : p;
}
