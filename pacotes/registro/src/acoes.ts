// A tabela única de ações (contrato 1 da spec, seção 6.5; prancha VL08 "rule").
// Reversível não pergunta: faz, oferece Desfazer por 10 s no rodapé e depois
// pelo Registro. Irreversível pergunta com o alcance escrito e não tem Desfazer.

export type Acao =
  | "arquivar"
  | "renomear"
  | "mover"
  | "editar"
  | "reescrever-bloco"
  | "mandar-para-lixeira"
  | "restaurar"
  | "apagar-permanente"
  | "esvaziar-lixeira"
  | "revogar-aparelho"
  | "revogar-regra"
  | "encerrar-chave-antiga"
  | "envio-externo"
  | "enviar-para-review"
  | "trocar-chave"
  | "pedido-a-ia";

export type Regra =
  | { reversivel: true }
  // "alcance": a pergunta mostra quantos e quais; "digitar": só confirma depois
  // de digitar a contagem; "fluxo-proprio": a ação tem a sua tela de passos e
  // não ganha uma segunda pergunta aqui.
  | { reversivel: false; confirma: "alcance" | "digitar" | "fluxo-proprio" };

const TABELA: Record<Acao, Regra> = {
  arquivar: { reversivel: true },
  renomear: { reversivel: true },
  mover: { reversivel: true },
  editar: { reversivel: true },
  "reescrever-bloco": { reversivel: true },
  "mandar-para-lixeira": { reversivel: true },
  restaurar: { reversivel: true },
  "apagar-permanente": { reversivel: false, confirma: "alcance" },
  "esvaziar-lixeira": { reversivel: false, confirma: "digitar" },
  "revogar-aparelho": { reversivel: false, confirma: "alcance" },
  "revogar-regra": { reversivel: false, confirma: "alcance" },
  "encerrar-chave-antiga": { reversivel: false, confirma: "alcance" },
  "envio-externo": { reversivel: false, confirma: "alcance" },
  "enviar-para-review": { reversivel: false, confirma: "alcance" },
  "trocar-chave": { reversivel: false, confirma: "fluxo-proprio" },
  "pedido-a-ia": { reversivel: false, confirma: "fluxo-proprio" },
};

export function regraDa(acao: Acao): Regra {
  const regra = TABELA[acao];
  if (!regra) throw new Error(`ação desconhecida: ${acao}`);
  return regra;
}

export type Confirmacao =
  | { pergunta: false }
  | { pergunta: true; quantos: number; digitar?: string };

export function pedirConfirmacao(acao: Acao, quantos: number): Confirmacao {
  const regra = regraDa(acao);
  if (regra.reversivel || regra.confirma === "fluxo-proprio") return { pergunta: false };
  if (regra.confirma === "digitar") return { pergunta: true, quantos, digitar: String(quantos) };
  return { pergunta: true, quantos };
}

export function podeConfirmar(conf: Confirmacao, digitado = ""): boolean {
  if (!conf.pergunta) return true;
  if (conf.digitar === undefined) return true;
  return digitado.trim() === conf.digitar;
}

export const DESFAZER_NO_RODAPE_MS = 10_000;
