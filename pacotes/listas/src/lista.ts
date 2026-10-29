// O estado puro do componente de lista (contrato 5 da spec, seção 6.5; VL01).
// O núcleo decide alcance, busca, filtro, ordem, contagem, seleção e foco; o
// motor só desenha. Item fora do alcance da pessoa nem aparece nem conta.

export interface Item {
  id: string;
  titulo: string;
  espaco: string;
  /** AAAA-MM-DD, quando o item tem prazo. */
  prazo?: string;
  /** Valor que o filtro compara (coluna do cartão, tipo da nota). */
  estado?: string;
}

export type Ordem = "titulo" | "prazo";

/** A ordem escolhida em cada lista, pelo nome. Guardada pelo app, por pessoa. */
export type MemoriaDeOrdem = Record<string, Ordem>;

export interface Lista {
  nome: string;
  itens: Item[];
  acesso: string[];
  relogio: string;
  fuso: string;
  busca: string;
  filtro: string | null;
  ordem: Ordem;
  selecao: string[];
  ancora: string | null;
  foco: number;
}

export interface AbrirLista {
  nome: string;
  itens: Item[];
  acesso: string[];
  relogio: string;
  fuso: string;
  ordem?: Ordem;
  memoria?: MemoriaDeOrdem;
}

export function abrirLista(a: AbrirLista): Lista {
  return {
    nome: a.nome,
    itens: a.itens,
    acesso: a.acesso,
    relogio: a.relogio,
    fuso: a.fuso,
    busca: "",
    filtro: null,
    ordem: a.memoria?.[a.nome] ?? a.ordem ?? "titulo",
    selecao: [],
    ancora: null,
    foco: 0,
  };
}

const collator = new Intl.Collator("pt-BR", { numeric: true });

/** Comparação de títulos na ordem do português, como o Mac (`localizedStandardCompare`). */
export function compararTitulos(a: string, b: string): number {
  return collator.compare(a, b);
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Os itens que a pessoa pode ver, sem busca nem filtro. */
export function doAlcance(lista: Lista): Item[] {
  const acesso = new Set(lista.acesso);
  return lista.itens.filter((i) => acesso.has(i.espaco));
}

export function visiveis(lista: Lista): Item[] {
  const busca = semAcento(lista.busca.trim());
  const achados = doAlcance(lista).filter(
    (i) => (!busca || semAcento(i.titulo).includes(busca)) && (lista.filtro === null || i.estado === lista.filtro),
  );
  return ordenar(achados, lista);
}

export type GrupoDePrazo = "Vencido" | "Hoje" | "Futuro" | "Sem prazo";
const POSICAO: Record<GrupoDePrazo, number> = { Vencido: 0, Hoje: 1, Futuro: 2, "Sem prazo": 3 };

export function hojeNoFuso(relogio: string, fuso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(relogio),
  );
}

export function grupoDePrazo(item: Item, relogio: string, fuso: string): GrupoDePrazo {
  if (!item.prazo) return "Sem prazo";
  const hoje = hojeNoFuso(relogio, fuso);
  if (item.prazo < hoje) return "Vencido";
  if (item.prazo === hoje) return "Hoje";
  return "Futuro";
}

function ordenar(itens: Item[], lista: Lista): Item[] {
  const porTitulo = (a: Item, b: Item) => compararTitulos(a.titulo, b.titulo) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (lista.ordem === "titulo") return [...itens].sort(porTitulo);
  return [...itens].sort((a, b) => {
    const ga = POSICAO[grupoDePrazo(a, lista.relogio, lista.fuso)];
    const gb = POSICAO[grupoDePrazo(b, lista.relogio, lista.fuso)];
    if (ga !== gb) return ga - gb;
    if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1;
    return porTitulo(a, b);
  });
}

/** "298 itens", ou "3 de 298" quando há busca ou filtro. */
export function contagem(lista: Lista): string {
  const total = doAlcance(lista).length;
  if (!lista.busca.trim() && lista.filtro === null) return total === 1 ? "1 item" : `${total} itens`;
  return `${visiveis(lista).length} de ${total}`;
}

/** Troca a ordem e grava na memória da pessoa, para voltar igual ao reabrir. */
export function trocarOrdem(lista: Lista, ordem: Ordem, memoria: MemoriaDeOrdem): Lista {
  memoria[lista.nome] = ordem;
  return { ...lista, ordem, foco: 0 };
}

export interface Trocado {
  lista: Lista;
  /** Quantos saíram da seleção, dito à pessoa. Vazio quando não havia seleção. */
  aviso?: string;
}

function limparSelecao(lista: Lista): Trocado {
  const saiu = lista.selecao.length;
  const nova = { ...lista, selecao: [], ancora: null, foco: 0 };
  if (!saiu) return { lista: nova };
  return { lista: nova, aviso: saiu === 1 ? "1 item saiu da seleção" : `${saiu} itens saíram da seleção` };
}

export function trocarFiltro(lista: Lista, filtro: string | null): Trocado {
  return limparSelecao({ ...lista, filtro });
}

export function trocarBusca(lista: Lista, busca: string): Trocado {
  return limparSelecao({ ...lista, busca });
}
