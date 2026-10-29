// Leitura da tela da CLI (UC17, casos CP-TEL). Tudo é decisão pura sobre o
// texto visível da aba; o PTY e o relógio ficam com quem chama. Mesmas regras do
// Mac (AgentesCore), escritas de novo.

import { duracao } from "./formato";

const GIROS = new Set(["·", "✢", "✳", "✶", "✻", "✽", "*"]);
const INICIO_DE_PROMPT = new Set(["›", "❯", "$", "%", ">", "#"]);
const INICIO_DE_STATUS = new Set(["⚠", "⏵", "▶", "✻", "✶", "✽", "⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷", "·"]);
const DICAS_DE_STATUS = ['try "', 'try"', "shift+tab", "esc to interrupt", "? for shortcuts", "/effort", "auto mode"];
const MOLDURA = new Set(["╭", "│", "╰", "⎿", "─", "┃", "┌", "└", "├", "═", "║", "╔", "╚", "╠", "▌", "▐"]);
const PALAVRAS_DE_PEDIDO = [
  "do you want to proceed",
  "(y/n)",
  "[y/n]",
  "allow",
  "yes, and",
  "esc to cancel",
  "deseja continuar",
  "permitir",
  "approve",
  "continue?",
  "(yes/no)",
];

export type Rodape = "trabalhando" | "fim-de-resposta" | "nenhum";

export interface LeituraDaTela {
  /** As linhas lidas: as 24 últimas, com NUL e espaço duro trocados por espaço. */
  linhas: string[];
  caixa: { topo: number; base: number } | null;
  promptLivre: boolean;
  rodape: Rodape;
  emSegundoPlano: number | null;
  pedePermissao: boolean;
}

export function lerTela(texto: string): LeituraDaTela {
  const todas = texto.split("\n");
  // Sem as linhas vazias do fim, que o terminal deixa abaixo do rodapé.
  while (todas.length && todas[todas.length - 1].replace(/[\u0000\u00a0]/g, " ").trim() === "") todas.pop();
  const linhas = todas.slice(-24).map((l) => l.replace(/[\u0000\u00a0]/g, " "));
  const aparadas = linhas.map((l) => l.trim());
  const caixa = caixaVazia(aparadas);
  return {
    linhas,
    caixa,
    promptLivre: caixa !== null || livrePeloReserva(aparadas),
    rodape: rodape(aparadas, caixa),
    emSegundoPlano: emSegundoPlano(aparadas, caixa),
    pedePermissao: pedePermissao(aparadas),
  };
}

function primeiro(s: string): string {
  return [...s][0] ?? "";
}

export function ehPromptVazio(linha: string): boolean {
  const c = primeiro(linha);
  if (!INICIO_DE_PROMPT.has(c)) return false;
  const resto = linha.slice(c.length).trim().toLowerCase();
  return resto === "" || ['try "', "try'", "try '", 'try"'].some((p) => resto.startsWith(p));
}

function ehBorda(linha: string): boolean {
  return [...linha].length >= 3 && /^[─━]+$/.test(linha);
}

function caixaVazia(aparadas: string[]): { topo: number; base: number } | null {
  const de = Math.max(0, aparadas.length - 12);
  for (let p = aparadas.length - 1; p >= de; p--) {
    if (!ehPromptVazio(aparadas[p])) continue;
    if (p > 0 && p + 1 < aparadas.length && ehBorda(aparadas[p - 1]) && ehBorda(aparadas[p + 1])) {
      return { topo: p - 1, base: p + 1 };
    }
    return null;
  }
  return null;
}

function ehStatus(linha: string): boolean {
  if (linha === "") return true;
  if (INICIO_DE_STATUS.has(primeiro(linha))) return true;
  const baixa = linha.toLowerCase();
  return DICAS_DE_STATUS.some((d) => baixa.includes(d));
}

// Sem caixa (Codex, shell, tela antiga): prompt vazio nas 5 últimas linhas e,
// depois dele, só status, moldura ou nada.
function livrePeloReserva(aparadas: string[]): boolean {
  const fim = aparadas.slice(-5);
  let p = -1;
  for (let i = fim.length - 1; i >= 0; i--) if (ehPromptVazio(fim[i])) {
    p = i;
    break;
  }
  if (p < 0) return false;
  return fim.slice(p + 1).every((l) => ehStatus(l) || MOLDURA.has(primeiro(l)));
}

// Só o rodapé conta: com caixa, a linha do giro acima dela e tudo abaixo; sem
// caixa, as 6 últimas linhas. Fala da conversa que cita o rodapé não conta.
function rodape(aparadas: string[], caixa: LeituraDaTela["caixa"]): Rodape {
  let zona: string[];
  if (caixa) {
    const acima = aparadas.slice(Math.max(0, caixa.topo - 16), caixa.topo).filter((l) => GIROS.has(primeiro(l)));
    zona = [...acima, ...aparadas.slice(caixa.base + 1)];
  } else {
    zona = aparadas.slice(-6);
  }
  const texto = zona.join("\n").toLowerCase();
  if (texto.includes("stop hooks")) return "fim-de-resposta";
  if (texto.includes("esc to interrupt")) return "trabalhando";
  return "nenhum";
}

function emSegundoPlano(aparadas: string[], caixa: LeituraDaTela["caixa"]): number | null {
  if (!caixa) return null;
  for (const linha of aparadas.slice(caixa.base + 1)) {
    const palavras = linha.toLowerCase().split(/[\s·]+/).filter(Boolean);
    for (let i = 0; i + 1 < palavras.length; i++) {
      const n = /^\d+$/.test(palavras[i]) ? Number(palavras[i]) : 0;
      if (n > 0 && /^(shell|background|bash)/.test(palavras[i + 1])) return n;
    }
  }
  return null;
}

function pedePermissao(aparadas: string[]): boolean {
  const texto = aparadas.slice(-6).join("\n").toLowerCase();
  return PALAVRAS_DE_PEDIDO.some((p) => texto.includes(p));
}

// MARK: estado da aba

export const PARADA_DEPOIS_DE = 7200_000;
export const QUIETO_VALE = 20_000;
export const SEM_RESPOSTA_DEPOIS_DE = 30_000;
export const LIVRE_DEPOIS_DO_RODAPE = 3_000;
const TELA_PARADA = 2_000;

/** O que a aba lembra entre leituras, em milissegundos. */
export interface MemoriaDaAba {
  mudouEm: number;
  vistaEm: number;
  abertaEm?: number | null;
  prontaEm?: number | null;
  campainhaEm?: number | null;
  trabalhouEm?: number | null;
}

export type Estado =
  | { estado: "trabalhando" }
  | { estado: "livre" }
  | { estado: "terminou"; desde: number }
  | { estado: "pediu-permissao"; desde: number }
  | { estado: "parada"; desde: number }
  | { estado: "abrindo" }
  | { estado: "sem-resposta"; desde: number };

export function estadoDaTela(leitura: LeituraDaTela, aba: MemoriaDaAba, cpu: number, agora: number): Estado {
  const quieto = agora - aba.mudouEm;
  const vista = aba.vistaEm;
  if (aba.prontaEm == null && aba.abertaEm != null && !leitura.pedePermissao) {
    const semNada = Math.min(agora - aba.abertaEm, quieto);
    return semNada >= SEM_RESPOSTA_DEPOIS_DE ? { estado: "sem-resposta", desde: aba.abertaEm } : { estado: "abrindo" };
  }
  if (leitura.pedePermissao && quieto >= TELA_PARADA) return { estado: "pediu-permissao", desde: aba.mudouEm };
  if (leitura.rodape === "trabalhando") return { estado: "trabalhando" };
  if (leitura.rodape === "fim-de-resposta" && quieto >= TELA_PARADA && aba.mudouEm > vista) {
    return { estado: "terminou", desde: aba.mudouEm };
  }
  if (aba.campainhaEm != null && aba.campainhaEm > vista) return { estado: "terminou", desde: aba.campainhaEm };
  if (quieto >= PARADA_DEPOIS_DE && cpu < 1) return { estado: "parada", desde: aba.mudouEm };
  if (leitura.promptLivre && aba.mudouEm > vista) {
    if (aba.trabalhouEm != null && aba.trabalhouEm > vista && quieto >= LIVRE_DEPOIS_DO_RODAPE) {
      return { estado: "terminou", desde: aba.mudouEm };
    }
    if (quieto >= QUIETO_VALE && cpu < 1) return { estado: "terminou", desde: aba.mudouEm };
  }
  return leitura.promptLivre && cpu < 1 ? { estado: "livre" } : { estado: "trabalhando" };
}

const ROTULOS: Record<Estado["estado"], string> = {
  trabalhando: "trabalhando",
  livre: "livre",
  terminou: "terminou",
  "pediu-permissao": "pediu permissão",
  parada: "parada",
  abrindo: "abrindo",
  "sem-resposta": "sem resposta",
};

/** A linha que a aba mostra. */
export function linhaDaAba(estado: Estado, leitura: LeituraDaTela, agora: number): string {
  if (estado.estado === "livre" && leitura.emSegundoPlano !== null) return `livre · ${leitura.emSegundoPlano} em segundo plano`;
  if (estado.estado === "terminou") return `terminou há ${duracao((agora - estado.desde) / 1000)} · espera você`;
  return ROTULOS[estado.estado];
}
