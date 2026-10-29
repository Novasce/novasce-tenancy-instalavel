// A lixeira de 30 dias por espaço (contrato 1 da spec, seção 6.5). Nota, canvas,
// rotina, habilidade e prompt vão para ela; o resto volta pelo Registro.
// Estas funções não apagam nada: dizem o que venceu e para onde volta.

import { somarDias } from "./fuso";

export const DIAS_NA_LIXEIRA = 30;

export type TipoNaLixeira = "nota" | "canvas" | "rotina" | "habilidade" | "prompt";

export interface ItemNaLixeira {
  id: string;
  tipo: TipoNaLixeira;
  espaco: string;
  /** Caminho de onde saiu, relativo à raiz dos espaços. */
  origem: string;
  apagadoEm: string;
  conteudo?: string;
}

/** O instante em que o item vence: 30 dias de calendário no fuso da casa. */
export function venceEm(item: ItemNaLixeira, fuso: string): Date {
  return new Date(somarDias(Date.parse(item.apagadoEm), DIAS_NA_LIXEIRA, fuso));
}

export function venceu(item: ItemNaLixeira, agora: string, fuso: string): boolean {
  return Date.parse(agora) >= venceEm(item, fuso).getTime();
}

/** Os que já venceram. Quem apaga é a varredura, num passo visível. */
export function vencidos(itens: ItemNaLixeira[], agora: string, fuso: string): ItemNaLixeira[] {
  return itens.filter((i) => venceu(i, agora, fuso));
}

/** Dias inteiros que faltam, como o Mac conta (`Lixeira.diasRestantes`). */
export function diasRestantes(item: ItemNaLixeira, agora: string, fuso: string): number {
  if (venceu(item, agora, fuso)) return 0;
  const falta = venceEm(item, fuso).getTime() - Date.parse(agora);
  return Math.ceil(falta / 86_400_000);
}

export function rotuloDaLixeira(item: ItemNaLixeira, agora: string, fuso: string): string {
  const d = diasRestantes(item, agora, fuso);
  if (d <= 0) return "a exclusão já pode começar";
  if (d === 1) return "sai amanhã";
  return `sai em ${d} dias`;
}

export type Restauro =
  | { tipo: "volta"; caminho: string; conteudo?: string; pausada: boolean }
  | { tipo: "pede-destino"; pasta: string };

/**
 * Para onde o item volta. Volta ao lugar de origem com o conteúdo intacto (as
 * ligações vão junto); rotina volta pausada; se a pasta sumiu, pede outra antes.
 */
export function restaurar(item: ItemNaLixeira, pastaExiste: (pasta: string) => boolean): Restauro {
  const corte = item.origem.lastIndexOf("/");
  const pasta = corte < 0 ? "" : item.origem.slice(0, corte);
  if (pasta && !pastaExiste(pasta)) return { tipo: "pede-destino", pasta };
  return { tipo: "volta", caminho: item.origem, conteudo: item.conteudo, pausada: item.tipo === "rotina" };
}
