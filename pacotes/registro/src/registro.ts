// O Registro (contrato 4 da spec, seção 6.5): cada entrada guarda o antes e o
// depois do que a ação mudou. No mesmo arquivo só a mais nova desfaz; arquivos
// diferentes não se prendem. Desfazer e refazer são entradas novas, com autoria.

import { type Acao, DESFAZER_NO_RODAPE_MS, regraDa } from "./acoes";
import { diaNoFuso, horaNoFuso } from "./fuso";

export type Arquivos = Record<string, string>;

export interface Mudanca {
  caminho: string;
  /** Conteúdo antes; `null` quando o arquivo não existia. */
  antes: string | null;
  /** Conteúdo depois; `null` quando o arquivo deixou de existir. */
  depois: string | null;
}

export interface Entrada {
  id: string;
  hora: string;
  autor: string;
  acao: Acao;
  titulo: string;
  mudancas: Mudanca[];
  /** Nome da chave, quando a ação mexe numa. O valor nunca entra aqui. */
  chave?: string;
  /** Texto do pedido à IA. Fica só no aparelho: o exportar não lê. */
  conversa?: string;
  /** Esta entrada desfaz a de id `desfaz`. */
  desfaz?: string;
  /** Esta entrada refaz a de id `refaz`. */
  refaz?: string;
}

export type Estado = "ativa" | "desfeita" | "reversao" | "irreversivel";

export function estadoDa(registro: Entrada[], id: string): Estado {
  const e = achar(registro, id);
  if (e.desfaz || e.refaz) return "reversao";
  if (!regraDa(e.acao).reversivel) return "irreversivel";
  const desfeitas = registro.filter((x) => x.desfaz === id).length;
  const refeitas = registro.filter((x) => x.refaz === id).length;
  return desfeitas > refeitas ? "desfeita" : "ativa";
}

export type PodeDesfazer =
  | { pode: true; aviso?: undefined; porCausaDe?: undefined }
  | { pode: false; aviso: string; porCausaDe?: string };

export function podeDesfazer(registro: Entrada[], id: string): PodeDesfazer {
  const estado = estadoDa(registro, id);
  if (estado === "irreversivel") return { pode: false, aviso: "não tem Desfazer" };
  if (estado === "reversao") return { pode: false, aviso: "use Refazer" };
  if (estado === "desfeita") return { pode: false, aviso: "já desfeita" };
  const bloqueio = acimaNoMesmoArquivo(registro, id);
  if (bloqueio) return { pode: false, aviso: "depois da de cima", porCausaDe: bloqueio };
  return { pode: true };
}

/**
 * O Desfazer do rodapé dura 10 s; depois disso só pelo Registro. Com o
 * registro, some também quando a ação já foi desfeita ou ficou presa.
 */
export function ofereceDesfazerNoRodape(entrada: Entrada, agora: string, registro?: Entrada[]): boolean {
  if (!regraDa(entrada.acao).reversivel || entrada.desfaz || entrada.refaz) return false;
  if (registro && !podeDesfazer(registro, entrada.id).pode) return false;
  const passou = Date.parse(agora) - Date.parse(entrada.hora);
  return passou >= 0 && passou < DESFAZER_NO_RODAPE_MS;
}

export function desfazer(registro: Entrada[], id: string, hora: string, autor: string): Entrada {
  const pode = podeDesfazer(registro, id);
  if (!pode.pode) throw new Error(`não desfaz ${id}: ${pode.aviso}`);
  const e = achar(registro, id);
  return {
    id: `${id}-desfeita-${registro.filter((x) => x.desfaz === id).length + 1}`,
    hora,
    autor,
    acao: e.acao,
    titulo: `Desfeita: ${e.titulo}`,
    mudancas: inverter(e.mudancas),
    desfaz: id,
  };
}

export function podeRefazer(registro: Entrada[], id: string): PodeDesfazer {
  if (estadoDa(registro, id) !== "desfeita") return { pode: false, aviso: "não está desfeita" };
  const bloqueio = acimaNoMesmoArquivo(registro, id);
  if (bloqueio) return { pode: false, aviso: "depois da de cima", porCausaDe: bloqueio };
  return { pode: true };
}

/** Refazer devolve só a entrada desfeita, nada além dela. */
export function refazer(registro: Entrada[], id: string, hora: string, autor: string): Entrada {
  const pode = podeRefazer(registro, id);
  if (!pode.pode) throw new Error(`não refaz ${id}: ${pode.aviso}`);
  const e = achar(registro, id);
  return {
    id: `${id}-refeita-${registro.filter((x) => x.refaz === id).length + 1}`,
    hora,
    autor,
    acao: e.acao,
    titulo: `Refeita: ${e.titulo}`,
    mudancas: e.mudancas.map((m) => ({ ...m })),
    refaz: id,
  };
}

/**
 * Aplica as mudanças de uma entrada. Recusa se algum arquivo não estiver como a
 * entrada espera: desfazer nunca pisa no que mudou depois.
 */
export function aplicar(arquivos: Arquivos, entrada: Entrada): Arquivos {
  const novo: Arquivos = { ...arquivos };
  for (const m of entrada.mudancas) {
    const atual = m.caminho in novo ? novo[m.caminho] : null;
    if (atual !== m.antes) throw new Error(`${m.caminho} mudou desde a ação "${entrada.titulo}"`);
    if (m.depois === null) delete novo[m.caminho];
    else novo[m.caminho] = m.depois;
  }
  return novo;
}

// A entrada ativa mais nova, depois de `id`, que mexe num arquivo de `id`.
function acimaNoMesmoArquivo(registro: Entrada[], id: string): string | undefined {
  const i = registro.findIndex((x) => x.id === id);
  const meus = new Set(registro[i].mudancas.map((m) => m.caminho));
  for (let j = registro.length - 1; j > i; j--) {
    const x = registro[j];
    if (x.desfaz || x.refaz || !regraDa(x.acao).reversivel) continue;
    if (estadoDa(registro, x.id) !== "ativa") continue;
    if (x.mudancas.some((m) => meus.has(m.caminho))) return x.id;
  }
  return undefined;
}

function inverter(mudancas: Mudanca[]): Mudanca[] {
  return [...mudancas].reverse().map((m) => ({ caminho: m.caminho, antes: m.depois, depois: m.antes }));
}

function achar(registro: Entrada[], id: string): Entrada {
  const e = registro.find((x) => x.id === id);
  if (!e) throw new Error(`entrada desconhecida: ${id}`);
  return e;
}

export interface Exportado {
  caminho: string;
  conteudo: string;
  linhas: number;
}

/**
 * Exporta o período para o Pessoal, em Markdown ou CSV. Leva hora, autoria, a
 * ação e o nome da chave. Nunca leva o conteúdo dos arquivos (onde mora o valor
 * de uma chave) nem o texto da conversa com a IA.
 */
export function exportar(registro: Entrada[], formato: "md" | "csv", de: string, ate: string, fuso: string): Exportado {
  const doPeriodo = registro.filter((e) => {
    const dia = diaNoFuso(Date.parse(e.hora), fuso);
    return dia >= de && dia <= ate;
  });
  const linhas = doPeriodo.map((e) => {
    const ms = Date.parse(e.hora);
    return [diaNoFuso(ms, fuso), horaNoFuso(ms, fuso), e.autor, e.titulo, e.chave ?? ""];
  });
  const caminho = `Pessoal/Registro/Registro ${de} a ${ate}.${formato}`;
  let conteudo: string;
  if (formato === "csv") {
    conteudo = [["dia", "hora", "autor", "acao", "chave"], ...linhas].map((l) => l.map(csv).join(",")).join("\n") + "\n";
  } else {
    conteudo =
      [
        `# Registro de ${de} a ${ate}`,
        "",
        "| Dia | Hora | Quem | O que | Chave |",
        "|---|---|---|---|---|",
        ...linhas.map((l) => `| ${l.map(md).join(" | ")} |`),
      ].join("\n") + "\n";
  }
  return { caminho, conteudo, linhas: linhas.length };
}

function csv(bruto: string): string {
  // Título que começa como fórmula não vira fórmula na planilha.
  const v = /^[=+\-@]/.test(bruto) ? `'${bruto}` : bruto;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function md(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
