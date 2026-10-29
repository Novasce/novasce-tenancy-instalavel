// Papel por linha: o papel vem de `linhas[].papel`, nunca do papel da pessoa na Casa.

export const PAPEIS = ["ADMIN", "FINANCEIRO", "SUPPORT", "DEV", "VENDEDOR", "MARKETING", "SOCIO"] as const;
export type Papel = (typeof PAPEIS)[number] | "desconhecido";
export type Status = "BACKLOG" | "FAZENDO" | "REVIEW" | "FEITO";

export interface Linha {
  slug: string;
  kind?: string;
  nome: string;
  papel?: string | null;
}

export interface Eu {
  id: string;
  casaAccess?: boolean;
  linhas: Linha[];
}

export interface Cartao {
  id: string;
  status?: string;
  kind?: string;
  assigneeId?: string | null;
  product?: { id?: string; line?: { slug: string } } | null;
  visibleToUserIds?: string[] | null;
}

/** Papel que o app não conhece vira desconhecido, nunca ADMIN. */
export function papelDe(bruto: string | null | undefined): Papel | null {
  if (bruto === null || bruto === undefined) return null;
  return (PAPEIS as readonly string[]).includes(bruto) ? (bruto as Papel) : "desconhecido";
}

export function somenteLeitura(papel: Papel): boolean {
  return papel === "SOCIO" || papel === "desconhecido";
}

const ehCasa = (l: Linha) => l.kind === "CASA";

/** As linhas que a pessoa alcança: a Casa só com casaAccess, e vem primeiro. */
export function linhasAutorizadas(eu: Eu): Linha[] {
  return eu.linhas
    .filter((l) => !ehCasa(l) || eu.casaAccess === true)
    .sort((a, b) => Number(ehCasa(b)) - Number(ehCasa(a)) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** A linha de um registro: a do produto; sem produto, a Casa. */
export function linhaDoRegistro(eu: Eu, cartao: Cartao): string | null {
  return cartao.product?.line?.slug ?? eu.linhas.find(ehCasa)?.slug ?? null;
}

/** Em "todas as linhas", o papel vale por registro. */
export function papelDoRegistro(eu: Eu, cartao: Cartao): Papel | null {
  const slug = linhaDoRegistro(eu, cartao);
  return papelDe(linhasAutorizadas(eu).find((l) => l.slug === slug)?.papel);
}

export function restrito(cartao: Cartao): boolean {
  return (cartao.visibleToUserIds ?? []).length > 0;
}

/** Sem produto o cartão é da Casa: só quem tem papel de escrita na Casa cria assim. */
export function podeCriarSemProduto(eu: Eu): boolean {
  return linhasAutorizadas(eu).some((l) => {
    const p = papelDe(l.papel);
    return ehCasa(l) && p !== null && !somenteLeitura(p);
  });
}

export function faltaProduto(eu: Eu, produtoId: string | null, produtos: unknown[]): string | null {
  if (produtoId || podeCriarSemProduto(eu)) return null;
  return produtos.length === 0
    ? "Nenhum produto da sua linha chegou do Tenancy: sem produto, o cartão seria da Casa."
    : "Escolha um produto da sua linha: sem produto, o cartão é da Casa.";
}

export type Acao = "review" | "devolver" | "parecer" | "responder";

/** As ações de um cartão para a pessoa. FEITO nunca é ação do app: é do founder no web. */
export function acoesDoCartao(cartao: Cartao, eu: Eu): Acao[] {
  const papel = papelDoRegistro(eu, cartao);
  if (papel === null) return [];
  const status = cartao.status;
  if (cartao.kind === "TICKET") {
    if (status === "FEITO") return [];
    return ["ADMIN", "SUPPORT", "DEV"].includes(papel) ? ["responder", "parecer"] : ["parecer"];
  }
  if (somenteLeitura(papel)) return status === "FEITO" ? [] : ["parecer"];
  if (status === "BACKLOG" || status === "FAZENDO") return cartao.assigneeId === eu.id || papel === "ADMIN" ? ["review"] : [];
  if (status === "REVIEW") return papel === "ADMIN" ? ["devolver", "parecer"] : ["parecer"];
  return [];
}

const ROTULO: Record<Status, string> = { BACKLOG: "Backlog", FAZENDO: "Fazendo", REVIEW: "Review", FEITO: "Feito" };

/** Mover pelo app só entre Backlog e Fazendo. Devolve o motivo da recusa, ou null. */
export function problemaAoMover(de: string, para: string): string | null {
  if (para === "FEITO") return "FEITO é no Tenancy web.";
  if (para === "REVIEW") return "Review vai com prova: use Enviar para Review com prova.";
  if (para !== "BACKLOG" && para !== "FAZENDO") return "Essa coluna não existe aqui.";
  if (de === "FEITO") return "Cartão em FEITO volta pelo Tenancy web.";
  if (de === "REVIEW") return "Cartão em Review volta por Devolver com orientação.";
  if (de === para) return `O cartão já está em ${ROTULO[para]}.`;
  return null;
}
