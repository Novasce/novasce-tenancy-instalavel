import { classificar } from "./api";
import type { Resposta } from "./http";

// Lote para Review (contrato 2): cada cartão leva a sua prova e o seu comentário; sem prova fica
// de fora antes de qualquer chamada; "em Review" só depois da confirmação daquele cartão.

export interface CartaoDoLote {
  id: string;
  titulo: string;
  status: string;
  prova: { nome: string } | null;
  comentario: string;
}

export interface ChamadaDoLote {
  cartao: string;
  anexo: string;
  comentario: string;
}

export interface PlanoDoLote {
  chamadas: ChamadaDoLote[];
  /** Sem prova, ou fora de Backlog e Fazendo: nenhuma chamada sai para eles. */
  foraAntes: { cartao: string; motivo: "falta-a-prova" | "status" }[];
  /** Já em Review: não recebem anexo de novo. */
  jaEmReview: string[];
  /** O que a tela mostra enquanto as respostas não chegam: o estado de antes. */
  naTela: Record<string, string>;
  cartoes: CartaoDoLote[];
}

export function planejarLote(cartoes: CartaoDoLote[]): PlanoDoLote {
  const plano: PlanoDoLote = { chamadas: [], foraAntes: [], jaEmReview: [], naTela: {}, cartoes };
  for (const c of cartoes) {
    plano.naTela[c.id] = c.status;
    if (c.status === "REVIEW") plano.jaEmReview.push(c.id);
    else if (c.status !== "BACKLOG" && c.status !== "FAZENDO") plano.foraAntes.push({ cartao: c.id, motivo: "status" });
    else if (!c.prova) plano.foraAntes.push({ cartao: c.id, motivo: "falta-a-prova" });
    else plano.chamadas.push({ cartao: c.id, anexo: c.prova.nome, comentario: c.comentario });
  }
  return plano;
}

export type AvisoDoLote = "nao-esta-no-seu-acesso" | "sessao-vencida" | "sem-resposta" | "recusado" | "nao-enviado";

export interface ResultadoDoCartao {
  status: string;
  aviso: AvisoDoLote | null;
  /** Prova e comentário ficam na tela quando o cartão não foi. */
  prova?: string;
  comentario?: string;
}

/**
 * Envia uma chamada por cartão, em ordem. 403 num cartão não para os outros; sessão vencida para o
 * resto, que fica como estava. Nenhum cartão vira FEITO.
 */
export async function enviarLote(
  plano: PlanoDoLote,
  enviar: (c: ChamadaDoLote) => Promise<Resposta>,
  aoResponder?: (cartao: string, resultado: ResultadoDoCartao) => void,
) {
  const resultado: Record<string, ResultadoDoCartao> = {};
  const chamadas: string[] = [];
  const antes = (id: string) => plano.naTela[id];
  let parou = false;
  for (const c of plano.chamadas) {
    const ficou = (aviso: AvisoDoLote): ResultadoDoCartao => ({ status: antes(c.cartao), aviso, prova: c.anexo, comentario: c.comentario });
    if (parou) {
      resultado[c.cartao] = ficou("nao-enviado");
      continue;
    }
    chamadas.push(c.cartao);
    const r = classificar(await enviar(c).catch((e: unknown) => ({ falhaDeRede: String(e) })), true);
    if (r.tipo === "ok") resultado[c.cartao] = { status: "REVIEW", aviso: null };
    else if (r.tipo === "sem-acesso") resultado[c.cartao] = ficou("nao-esta-no-seu-acesso");
    else if (r.tipo === "sessao-vencida") {
      resultado[c.cartao] = ficou("sessao-vencida");
      parou = true;
    } else resultado[c.cartao] = ficou(r.tipo === "rede" ? "sem-resposta" : "recusado");
    aoResponder?.(c.cartao, resultado[c.cartao]);
  }
  const continuamSelecionados = [
    ...plano.foraAntes.map((f) => f.cartao),
    ...plano.chamadas.map((c) => c.cartao).filter((id) => resultado[id]?.status !== "REVIEW"),
  ];
  return { chamadas, resultado, continuamSelecionados };
}
