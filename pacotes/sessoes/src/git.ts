// Guardas do git das sessões (UC20, casos CP-GIT). Decisões puras sobre um
// retrato do repositório: quem chama roda o git e traz os números.

export interface SessaoAberta {
  pasta: string;
  programa: string;
  desde: string;
  viva: boolean;
}

export function normalizar(pasta: string, home: string): string {
  let p = pasta.trim();
  if (p === "~" || p.startsWith("~/")) p = home.replace(/\/+$/, "") + p.slice(1);
  return p.replace(/\/+$/, "") || "/";
}

/**
 * Segunda sessão na mesma pasta. Espaço registrado (o brain e os espaços) abre
 * ali mesmo, sem pergunta: igualdade exata de caminho, nunca por prefixo, então
 * um repo de código dentro do brain continua perguntando se abre em worktree.
 */
export function sessaoJaAberta(p: {
  pasta: string;
  temGit: boolean;
  abertas: SessaoAberta[];
  espacos: string[];
  home: string;
}): { programa: string; desde: string } | null {
  if (!p.temGit) return null;
  const alvo = normalizar(p.pasta, p.home);
  if (p.espacos.some((e) => normalizar(e, p.home) === alvo)) return null;
  const aberta = p.abertas.find((a) => a.viva && normalizar(a.pasta, p.home) === alvo);
  return aberta ? { programa: aberta.programa, desde: aberta.desde } : null;
}

export type OpcaoAoFechar = "abrir-pr" | "mesclar" | "deixar";

export type DestinoAoFechar =
  | { tipo: "apagar" }
  | { tipo: "ficar" }
  | { tipo: "perguntar"; commits: number; opcoes: OpcaoAoFechar[]; principal: "abrir-pr"; frase: string };

/**
 * Fechar a aba de um worktree da sessão. Sem commit e sem solto, worktree e
 * branch saem; com solto, fica tudo; com commit, pergunta. HEAD fora da branch
 * da sessão (trocada à mão) ou contagem desconhecida: nada é removido.
 */
export function aoFechar(f: {
  commitsForaDaMain: number | null;
  soltos: number;
  headNaBranch: boolean;
  branch?: string;
  principal?: string;
}): DestinoAoFechar {
  if (!f.headNaBranch || f.commitsForaDaMain === null) return { tipo: "ficar" };
  const n = f.commitsForaDaMain;
  if (n > 0) {
    const principal = f.principal ?? "main";
    const frase =
      n === 1
        ? `${f.branch ?? "a branch"} tem 1 commit fora da ${principal}. O que fazer com ele?`
        : `${f.branch ?? "a branch"} tem ${n} commits fora da ${principal}. O que fazer com eles?`;
    return { tipo: "perguntar", commits: n, opcoes: ["abrir-pr", "mesclar", "deixar"], principal: "abrir-pr", frase };
  }
  return f.soltos === 0 ? { tipo: "apagar" } : { tipo: "ficar" };
}

export type DecisaoDeMescla =
  | { tipo: "recusa"; motivo: "sem-principal" }
  | { tipo: "recusa"; motivo: "outra-branch"; branch: string }
  | { tipo: "recusa"; motivo: "pasta-principal-ocupada" }
  | { tipo: "mesclar"; git: string[] };

/**
 * Mesclar a branch da sessão na principal, na pasta principal do repositório.
 * Recusa com a pasta em outra branch, com merge em curso ou com arquivo
 * rastreado mudado (nada é abortado). O merge é sempre um commit de merge, sem
 * avanço rápido, e nunca faz push.
 */
export function decidirMescla(r: {
  principal: string | null;
  headDaPastaPrincipal: string | null;
  mergeEmCurso: boolean;
  rastreadosMudados: number;
  branch: string;
}): DecisaoDeMescla {
  if (!r.principal) return { tipo: "recusa", motivo: "sem-principal" };
  const head = r.headDaPastaPrincipal ?? "HEAD solto";
  if (head !== r.principal) return { tipo: "recusa", motivo: "outra-branch", branch: head };
  if (r.mergeEmCurso || r.rastreadosMudados > 0) return { tipo: "recusa", motivo: "pasta-principal-ocupada" };
  return { tipo: "mesclar", git: ["merge", "--no-ff", "-m", `Merge da ${r.branch} (sessão do Tenancy)`, r.branch] };
}

/**
 * A página de comparação do GitHub para abrir o PR, sem credencial na URL. Fora
 * do GitHub não há página: nada é enviado.
 */
export function enderecoDoPR(remoto: string, principal: string, branch: string): string | null {
  let r = remoto.trim();
  if (r.startsWith("git@github.com:")) r = "https://github.com/" + r.slice("git@github.com:".length);
  else if (r.startsWith("ssh://git@github.com/")) r = "https://github.com/" + r.slice("ssh://git@github.com/".length);
  else r = r.replace(/^https:\/\/[^/@]*@github\.com\//, "https://github.com/");
  if (!r.startsWith("https://github.com/")) return null;
  r = r.replace(/\.git$/, "").replace(/\/+$/, "");
  return `${r}/compare/${principal}...${branch}?expand=1`;
}

export interface BranchDeSessao {
  nome: string;
  commitsForaDaMain: number;
  /** Data do último commit, em segundos. */
  data?: number;
  assunto?: string;
}

/** "Trabalho fora da main · N": branches de sessão com commit, sem aba aberta, da mais nova para a mais antiga. */
export function trabalhoForaDaMain(branches: BranchDeSessao[], abertas: string[]): { lista: BranchDeSessao[]; rotulo: string } {
  const abertasSet = new Set(abertas);
  const lista = branches
    .filter((b) => b.nome.startsWith("sessao-") && !abertasSet.has(b.nome) && b.commitsForaDaMain > 0)
    .sort((a, b) => (b.data ?? 0) - (a.data ?? 0));
  return { lista, rotulo: `Trabalho fora da main · ${lista.length}` };
}
