import type { Arquivos } from "./arquivos";

const natural = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** A ordem do gerenciador de arquivos: "passo 9" antes de "passo 10". */
export function compararNomes(a: string, b: string): number {
  return natural.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

export function nomeDe(caminho: string): string {
  return caminho.slice(caminho.lastIndexOf("/") + 1);
}

export function paiDe(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf("/"));
}

/** AAAA-MM-DD com mês de 1 a 12 e dia de 1 a 31. */
export function ehDia(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

/** "2026-10-28 Lia Pereira - proposta" vira a data, o que vem antes do " - " e o que vem depois. */
export function partesDoNome(nome: string): { data: string | null; antes: string; depois: string | null } {
  let data: string | null = null;
  let resto = nome;
  if (ehDia(nome.slice(0, 10)) && nome.slice(10, 11) === " ") {
    data = nome.slice(0, 10);
    resto = nome.slice(11);
  }
  const texto = resto.trim();
  const i = texto.indexOf(" - ");
  if (i < 0) return { data, antes: texto, depois: null };
  return { data, antes: texto.slice(0, i), depois: texto.slice(i + 3) };
}

/** As pastas de um lugar, sem oculta e sem arquivo solto, na ordem natural. */
export function pastasEm(arquivos: Arquivos, lugar: string): string[] {
  return arquivos
    .listar(lugar)
    .filter((e) => e.pasta && !e.nome.startsWith("."))
    .map((e) => e.nome)
    .sort(compararNomes);
}

/** Move para dentro de `pasta`; nome tomado ganha " 2", " 3" e assim por diante. Devolve o caminho final. */
export function moverSemSobrescrever(arquivos: Arquivos, origem: string, pasta: string): string {
  const nome = nomeDe(origem);
  let destino = `${pasta}/${nome}`;
  for (let n = 2; arquivos.existe(destino); n++) destino = `${pasta}/${nome} ${n}`;
  arquivos.mover(origem, destino);
  return destino;
}

/** O desfazer de um mover: volta ao caminho exato, ou falha se ele estiver tomado. */
export function desfazerMover(arquivos: Arquivos, de: string, para: string): void {
  if (!arquivos.existe(de)) throw new Error(`não existe mais: ${de}`);
  if (arquivos.existe(para)) throw new Error(`o lugar de antes está tomado: ${para}`);
  arquivos.mover(de, para);
}
