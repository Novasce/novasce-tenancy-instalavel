// A sessão nasce do `exp` do token e o portão confere validade, não presença.

const TABELA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64url(texto: string): number[] | null {
  let b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < b64.length; i += 4) {
    const v = [...b64.slice(i, i + 4)].map((c) => (c === "=" ? 0 : TABELA.indexOf(c)));
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    bytes.push((n >> 16) & 255);
    if (b64[i + 2] !== "=") bytes.push((n >> 8) & 255);
    if (b64[i + 3] !== "=") bytes.push(n & 255);
  }
  return bytes;
}

function utf8(bytes: number[]): string {
  let saida = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const n = b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
    let p = n === 1 ? b : b & (0xff >> (n + 1));
    for (let k = 1; k < n; k++) p = (p << 6) | (bytes[i + k] & 63);
    saida += String.fromCodePoint(p);
    i += n;
  }
  return saida;
}

/** O conteúdo do token (a parte do meio), sem conferir a assinatura: quem confere é a API. */
export function conteudoDoToken(token: string): Record<string, unknown> | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const bytes = base64url(partes[1]);
  if (!bytes) return null;
  try {
    const json = JSON.parse(utf8(bytes));
    return json && typeof json === "object" && !Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

export interface Sessao {
  token: string;
  /** Milissegundos desde 1970. */
  expiraEm: number;
}

/** Token sem `exp` legível não vira sessão. */
export function sessaoDoToken(bruto: string): Sessao | null {
  const token = bruto.trim();
  if (!token) return null;
  const exp = conteudoDoToken(token)?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  return { token, expiraEm: exp * 1000 };
}

export function valida(sessao: Sessao, agora: number): boolean {
  return agora < sessao.expiraEm;
}

export type Portao = "entra" | "sem-sessao" | "sessao-vencida";

/** O portão do app: sem sessão legível não entra; vencida não entra; só a válida entra. */
export function portao(token: string | null, agora: number): Portao {
  const sessao = token ? sessaoDoToken(token) : null;
  if (!sessao) return "sem-sessao";
  return valida(sessao, agora) ? "entra" : "sessao-vencida";
}
