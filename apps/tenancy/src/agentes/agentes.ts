// A aba Agentes é a página do Tenancy web numa janela própria (decisão 5), sem
// nenhuma capacidade do app. Entra pela troca do token do OS por um código de
// uso único (decisão 8): o token nunca vai na URL; o código vale uma vez.

/** A rota do web que resgata o código e grava a sessão; sem base (ensaio), a página local fictícia. */
export function enderecoDosAgentes(base: string | null, codigo: string): string {
  const c = encodeURIComponent(codigo);
  if (!base) return `agentes-ensaio.html?codigo=${c}`;
  return `${base.replace(/\/+$/, "")}/entrar/app?codigo=${c}`;
}

/** A página do web caiu no login dela: a sessão venceu. */
export function estadoPelaUrl(url: string): "vencida" | "aberta" {
  try {
    return new URL(url, "http://local.invalid").pathname.startsWith("/login") ? "vencida" : "aberta";
  } catch {
    return "aberta";
  }
}

export type EstadoDosAgentes = "abrindo" | "aberta" | "fechada" | "sem-login" | "vencida" | "offline" | "recusado";
