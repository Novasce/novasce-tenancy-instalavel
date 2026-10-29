// As mãos de rede do núcleo: o app passa a de verdade, os testes passam uma de mentira.
export type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface Pedido {
  metodo: Metodo;
  url: string;
  cabecalhos: Record<string, string>;
  corpo?: string;
}

/** A resposta do servidor, ou a falha antes de qualquer resposta. */
export type Resposta = { status: number; corpo: string } | { falhaDeRede: string };

export interface Http {
  pedir(pedido: Pedido): Promise<Resposta>;
}

export interface Configuracao {
  /** A base da API vem sempre da configuração; nunca é constante no código. */
  baseDaApi: string;
}
