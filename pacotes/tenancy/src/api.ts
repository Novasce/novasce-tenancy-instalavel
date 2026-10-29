import type { Configuracao, Http, Metodo, Resposta } from "./http";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Data ISO 8601, com ou sem fração de segundo. Outro formato é erro, nunca data inventada. */
export function lerData(texto: string): Date {
  const d = new Date(texto);
  if (!ISO.test(texto) || Number.isNaN(d.getTime())) throw new Error(`data fora do ISO-8601: ${texto}`);
  return d;
}

/** O `data` do envelope `{data, message}`. */
export function decodificarEnvelope<T>(corpo: string): T {
  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    throw new Error("resposta fora do formato: não é JSON");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("resposta fora do formato: sem envelope");
  return (json as { data: T }).data;
}

/** A mensagem de erro: texto como veio, lista junta por vírgula, corpo que não é JSON vai cru. */
export function mensagemDeErro(corpo: string): string {
  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    return corpo;
  }
  const m = (json as { message?: unknown } | null)?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m) && m.every((x) => typeof x === "string")) return m.join(", ");
  return "";
}

export function textoDoErro(status: number, corpo: string): string {
  return `Erro ${status}: ${[...mensagemDeErro(corpo)].slice(0, 140).join("")}`;
}

export type Resultado =
  | { tipo: "ok"; status: number; corpo: string }
  | { tipo: "rede"; detalhe: string }
  | { tipo: "sem-sessao" }
  | { tipo: "sessao-vencida" }
  | { tipo: "sem-acesso" }
  | { tipo: "credenciais" }
  | { tipo: "http"; status: number; mensagem: string };

/** Rede, 401 e 403 são coisas diferentes. 401 fora do login vence a sessão; 403 nunca desloga. */
export function classificar(r: Resposta, autenticada: boolean): Resultado {
  if ("falhaDeRede" in r) return { tipo: "rede", detalhe: r.falhaDeRede };
  if (r.status >= 200 && r.status < 300) return { tipo: "ok", status: r.status, corpo: r.corpo };
  if (autenticada && r.status === 401) return { tipo: "sessao-vencida" };
  if (r.status === 403) return { tipo: "sem-acesso" };
  return { tipo: "http", status: r.status, mensagem: mensagemDeErro(r.corpo) };
}

/** As rotas que dependem da linha escolhida levam o cabeçalho X-Linha; as outras, nunca. */
export function rotaPorLinha(metodo: Metodo, rota: string): boolean {
  const caminho = rota.split("?")[0];
  const porLinha = ["/tasks", "/products", "/dashboard/meu-dia/veredito"];
  if (metodo === "GET" && (porLinha.includes(caminho) || /^\/tasks\/[^/]+$/.test(caminho))) return true;
  return (metodo === "GET" || metodo === "POST") && /^\/tasks\/[^/]+\/comments$/.test(caminho);
}

export function normalizarBase(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

export class ClienteTenancy {
  private base: string;

  constructor(
    private http: Http,
    config: Configuracao,
    private tokenAtual: () => string | null,
  ) {
    this.base = normalizarBase(config.baseDaApi);
  }

  /** Pedido autenticado. Sem token, nenhum pedido sai. `linha` é o slug ou "todas". */
  async pedir(metodo: Metodo, rota: string, op: { linha?: string | null; corpo?: unknown } = {}): Promise<Resultado> {
    const token = this.tokenAtual();
    if (!token) return { tipo: "sem-sessao" };
    const cabecalhos: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (op.linha && rotaPorLinha(metodo, rota)) cabecalhos["X-Linha"] = op.linha;
    return classificar(await this.enviar(metodo, rota, cabecalhos, op.corpo), true);
  }

  /** Login: 401 é e-mail ou senha errados. */
  async entrar(email: string, senha: string): Promise<Resultado> {
    const r = classificar(await this.enviar("POST", "/auth/login", {}, { email, password: senha }), false);
    if (r.tipo === "http" && r.status === 401) return { tipo: "credenciais" };
    return r;
  }

  private enviar(metodo: Metodo, rota: string, cabecalhos: Record<string, string>, corpo?: unknown): Promise<Resposta> {
    if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
    return this.http.pedir({
      metodo,
      url: this.base + rota,
      cabecalhos,
      ...(corpo !== undefined ? { corpo: JSON.stringify(corpo) } : {}),
    });
  }
}

/** O que o app guarda; o Pessoal e os rascunhos não são dados de trabalho. */
export interface EstadoDoApp {
  sessao: unknown;
  eu: unknown;
  tarefas: unknown[];
  linhas: unknown[];
  leituras: Record<string, unknown>;
  pessoal: unknown;
  rascunhos: unknown;
  online?: boolean;
  foraDoPapel?: boolean;
  sessaoVenceu?: boolean;
}

/** Como o app reage a cada erro. Sessão vencida limpa a sessão e o trabalho; 403 só tira o que a conta não alcança. */
export function reagirAoErro<E extends EstadoDoApp>(r: Resultado, estado: E): E {
  switch (r.tipo) {
    case "sessao-vencida":
      return { ...estado, sessao: null, eu: null, tarefas: [], linhas: [], leituras: {}, sessaoVenceu: true, online: true };
    case "sem-acesso":
      return { ...estado, foraDoPapel: true, tarefas: [], online: true };
    case "rede":
      return { ...estado, online: false };
    default:
      return { ...estado, online: true };
  }
}
