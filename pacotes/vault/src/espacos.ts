// Um espaço é um vault numa pasta registrada. A fronteira: espaço não lê o Pessoal, e espaço
// não lê espaço. Índice, busca e o que vai para uma sessão são sempre de um espaço só.

import type { Arquivos } from "./arquivos";

export interface Espaco {
  id: string;
  nome: string;
  tipo: "pessoal" | "trabalho" | "convidado" | string;
  pasta: string;
}

export interface Contexto {
  home: string;
  arquivos: Arquivos;
}

function semBarraNoFim(p: string): string {
  let s = p;
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/** Caminho absoluto, sem `~`, com os links resolvidos e sem barra no fim: é assim que a fronteira compara. */
export function normalizar(pasta: string, ctx: Contexto): string {
  let p = pasta === "~" ? ctx.home : pasta.startsWith("~/") ? ctx.home + pasta.slice(1) : pasta;
  p = semBarraNoFim(p);
  return semBarraNoFim(ctx.arquivos.real(p));
}

/** Registra o espaço com a pasta normalizada; recusa a pasta que já é de outro espaço. */
export function registrar(lista: Espaco[], novo: Espaco, ctx: Contexto): { lista: Espaco[]; registrado: boolean } {
  const pasta = normalizar(novo.pasta, ctx);
  if (lista.some((e) => e.pasta === pasta || e.id === novo.id)) return { lista, registrado: false };
  return { lista: [...lista, { ...novo, pasta }], registrado: true };
}

function contem(e: Espaco, caminho: string): boolean {
  const c = semBarraNoFim(caminho);
  return c === e.pasta || c.startsWith(e.pasta + "/");
}

/** O espaço de um caminho: o de pasta mais funda que o contém. */
export function dono(espacos: Espaco[], caminho: string): Espaco | undefined {
  return espacos.filter((e) => contem(e, caminho)).sort((a, b) => b.pasta.length - a.pasta.length)[0];
}

/** As pastas que uma sessão aberta em `pasta` não lê: as dos outros espaços, nunca uma que a contém. */
export function negadas(pasta: string, espacos: Espaco[]): string[] {
  const aqui = semBarraNoFim(pasta);
  const meu = dono(espacos, aqui);
  return espacos
    .filter((e) => e.id !== meu?.id && !(aqui === e.pasta || aqui.startsWith(e.pasta + "/")))
    .map((e) => e.pasta)
    .sort();
}

/** O caminho pode ir para a sessão que abre em `irPara`? Só se for do mesmo espaço, ou de fora de todos. */
export function pode(caminho: string, irPara: string, espacos: Espaco[]): boolean {
  const doCaminho = dono(espacos, caminho);
  if (!doCaminho) return true;
  return dono(espacos, irPara)?.id === doCaminho.id;
}

/** Busca nas notas só do espaço pedido: o que é de outro espaço, ou de fora de todos, não aparece. */
export function buscar(notas: Record<string, string>, termo: string, espacoId: string, espacos: Espaco[]): string[] {
  const t = termo.normalize("NFC").toLocaleLowerCase("pt-BR");
  return Object.entries(notas)
    .filter(([caminho]) => dono(espacos, caminho)?.id === espacoId)
    .filter(([, texto]) => texto.normalize("NFC").toLocaleLowerCase("pt-BR").includes(t))
    .map(([caminho]) => caminho)
    .sort();
}
