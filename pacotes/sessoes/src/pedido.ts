// O pedido de permissão da CLI na tela (UC19, CP-TEL-05): o que ela quer rodar
// ou mexer, e se "Sempre" pode ser oferecido. "Sempre" nunca vale para comando
// perigoso nem para regra larga.

const APARAR = /^[│┃║╭╮╰╯─━═┌┐└┘├┤\s]+|[│┃║╭╮╰╯─━═┌┐└┘├┤\s]+$/g;
const TITULOS = new Set(["bash command", "edit file", "create file", "write"]);

export type TipoDoPedido = "comando" | "arquivo" | "outro";

export interface Pedido {
  tipo: TipoDoPedido;
  /** O comando ou o arquivo, quando lido. */
  texto: string | null;
  /** A regra que o "Sempre" da CLI grava, quando ela oferece. */
  sempre: string | null;
  /** Linhas do pedido; a tecla só vai se a tela ainda for a mesma. */
  assinatura: string;
  frase: string;
}

export const TECLAS_DO_PEDIDO = { sim: "1", sempre: "2", nao: "\u001b" } as const;

export function lerPedido(texto: string): Pedido | null {
  const limpas = texto
    .replace(/\n$/, "")
    .split("\n")
    .map((l) => l.replace(/[\u0000 ]/g, " ").replace(APARAR, ""));
  let pergunta = -1;
  for (let i = limpas.length - 1; i >= 0; i--) if (limpas[i].toLowerCase().startsWith("do you want to")) {
    pergunta = i;
    break;
  }
  if (pergunta < 0) return null;
  const opcoes = limpas.slice(pergunta + 1).map((l) => l.replace(/^❯\s*/, ""));
  if (!opcoes.some((o) => o.startsWith("1."))) return null;

  let titulo = -1;
  for (let i = pergunta - 1; i >= 0; i--) if (TITULOS.has(limpas[i].toLowerCase())) {
    titulo = i;
    break;
  }
  const bash = titulo >= 0 && limpas[titulo].toLowerCase() === "bash command";
  let tipo: TipoDoPedido = "outro";
  let alvo: string | null = null;
  if (titulo >= 0) {
    const meio = limpas.slice(titulo + 1, pergunta);
    const regua = (l: string) => l !== "" && /^[╌┄┈]+$/.test(l);
    const r1 = meio.findIndex(regua);
    if (bash && r1 >= 0) {
      const depois = meio.slice(r1 + 1);
      const r2 = depois.findIndex(regua);
      const corpo = (r2 >= 0 ? depois.slice(0, r2) : depois).filter((l) => l !== "").join("\n");
      if (corpo) [tipo, alvo] = ["comando", corpo];
    } else {
      const linha = meio.find((l) => l !== "" && !l.toLowerCase().startsWith("tip:"));
      if (linha) [tipo, alvo] = [bash ? "comando" : "arquivo", linha];
    }
  }
  const assinatura = limpas
    .slice(titulo >= 0 ? titulo : pergunta)
    .filter((l) => l !== "")
    .join("\n");
  return { tipo, texto: alvo, sempre: regraDoSempre(opcoes), assinatura, frase: frase(tipo, alvo) };
}

function regraDoSempre(opcoes: string[]): string | null {
  const i = opcoes.findIndex((o) => o.startsWith("2."));
  if (i < 0) return null;
  const partes = [opcoes[i]];
  for (const o of opcoes.slice(i + 1)) {
    if (o === "" || /^\d\./.test(o)) break;
    partes.push(o);
  }
  const texto = partes.join(" ");
  const antigo = /don.t ask again for (.+?) commands/i.exec(texto);
  if (antigo) return antigo[1].trim();
  const novo = /don.t ask again for: (.+)$/i.exec(texto);
  if (novo) return novo[1].trim();
  return null;
}

function frase(tipo: TipoDoPedido, alvo: string | null): string {
  if (tipo === "comando" && alvo) {
    const linhas = alvo.split("\n");
    if (linhas.length === 1) return `quer rodar ${alvo}`;
    const mais = linhas.length - 1;
    return `quer rodar ${linhas[0]} e mais ${mais} ${mais === 1 ? "linha" : "linhas"}`;
  }
  if (tipo === "arquivo" && alvo) return `quer mexer em ${alvo}`;
  return "pediu permissão";
}

export function podeSempre(p: Pedido): boolean {
  if (p.tipo !== "comando" || !p.texto || p.sempre === null) return false;
  if (perigoso(p.texto) || perigoso(p.texto.replace(/\n/g, ""))) return false;
  if (p.sempre.trim() === "" || p.sempre.trim().startsWith("*")) return false;
  return !perigoso(p.sempre);
}

const NOMES_PERIGOSOS = new Set(
  (
    "rm rmdir srm trash sudo su doas dd mkfs diskutil chmod chown kill killall pkill launchctl defaults " +
    "curl wget ssh scp rsync mv shutdown reboot sh bash zsh eval npx bunx pipx vercel railway"
  ).split(" "),
);
const PREFIXOS = new Set(["env", "command", "exec", "nohup", "time", "nice", "builtin"]);
const GIT_PERIGOSO = new Set(["push", "reset", "clean", "rebase", "restore", "filter-branch", "filter-repo", "update-ref"]);
const SUBCOMANDOS: Record<string, Set<string>> = {
  npm: new Set("publish unpublish install i add ci uninstall exec x".split(" ")),
  pnpm: new Set("publish install i add dlx exec".split(" ")),
  yarn: new Set("publish add install dlx".split(" ")),
  bun: new Set("publish add install x".split(" ")),
  pip: new Set(["install", "uninstall"]),
  pip3: new Set(["install", "uninstall"]),
  brew: new Set("install uninstall upgrade reinstall remove".split(" ")),
  gh: new Set("pr repo release api secret workflow run".split(" ")),
};

/** Comando que nunca ganha "Sempre": apaga, sobe privilégio, sai para a rede, publica, reescreve histórico. */
export function perigoso(comando: string): boolean {
  const c = comando.toLowerCase();
  if (/(?<![>0-9&])>(?![>&])\s*(?!\/dev\/null)\S/.test(c)) return true;
  const pedacos = c.replace(/\$\(/g, "\n").split(/[\n;|&`]/);
  return pedacos.some(pedacoPerigoso);
}

function pedacoPerigoso(pedaco: string): boolean {
  const palavras = pedaco
    .split(/[ \t]+/)
    .map((p) => p.replace(/^[(){}]+|[(){}]+$/g, ""))
    .filter(Boolean);
  while (palavras.length && (palavras[0].includes("=") || PREFIXOS.has(palavras[0]))) palavras.shift();
  if (!palavras.length) return false;
  const nome = palavras[0].split("/").pop() ?? "";
  const args = palavras.slice(1);
  const primeiroArg = args.find((a) => !a.startsWith("-"));
  if (NOMES_PERIGOSOS.has(nome)) return true;
  if (nome === "xargs") return primeiroArg !== undefined && NOMES_PERIGOSOS.has(primeiroArg.split("/").pop() ?? "");
  if (nome === "find") return args.some((a) => ["-delete", "-exec", "-execdir", "-ok"].includes(a));
  if (nome === "git") return gitPerigoso(args);
  const sub = SUBCOMANDOS[nome];
  return sub !== undefined && primeiroArg !== undefined && sub.has(primeiroArg);
}

function gitPerigoso(args: string[]): boolean {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    i += args[i] === "-c" ? 2 : 1;
  }
  const sub = args[i];
  const resto = args.slice(i + 1);
  if (sub === undefined) return false;
  if (GIT_PERIGOSO.has(sub)) return true;
  if (sub === "checkout") return resto.includes("--") || resto.includes(".");
  if (sub === "branch") return resto.some((a) => ["-d", "--delete", "-m", "--move"].includes(a));
  if (sub === "stash") return resto.includes("drop") || resto.includes("clear");
  return false;
}
