// O retrato do repositório que as guardas do git (UC20) pedem, lido pela mão do
// host. As decisões ficam no pacote sessoes; aqui só se roda o git e se conta.
import type { BranchDeSessao } from "@novasce/sessoes";
import type { MaoDoHost } from "../mao/tipos";

const linhas = (s: string) => s.split("\n").filter((l) => l.length > 0);

export async function temGit(mao: MaoDoHost, pasta: string): Promise<boolean> {
  return (await mao.git(pasta, ["rev-parse", "--show-toplevel"])).codigo === 0;
}

/** A principal do repositório: main, depois master; null sem nenhuma. */
export async function principalDe(mao: MaoDoHost, repo: string): Promise<string | null> {
  for (const nome of ["main", "master"]) {
    if ((await mao.git(repo, ["rev-parse", "--verify", "--quiet", `refs/heads/${nome}`])).codigo === 0) return nome;
  }
  return null;
}

async function headDe(mao: MaoDoHost, pasta: string): Promise<string | null> {
  const s = await mao.git(pasta, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return s.codigo === 0 ? s.saida.trim() : null;
}

async function status(mao: MaoDoHost, pasta: string): Promise<{ rastreados: number; soltos: number } | null> {
  const s = await mao.git(pasta, ["status", "--porcelain"]);
  if (s.codigo !== 0) return null;
  const l = linhas(s.saida);
  const soltos = l.filter((x) => x.startsWith("??")).length;
  return { rastreados: l.length - soltos, soltos };
}

async function commitsForaDa(mao: MaoDoHost, repo: string, principal: string | null, branch: string): Promise<number | null> {
  if (!principal) return null;
  const s = await mao.git(repo, ["rev-list", "--count", `${principal}..${branch}`]);
  const n = Number.parseInt(s.saida.trim(), 10);
  return s.codigo === 0 && Number.isFinite(n) ? n : null;
}

/** Fechar a aba de um worktree: commits fora da principal, soltos e se o HEAD ainda é a branch. */
export async function retratoAoFechar(
  mao: MaoDoHost,
  w: { repo: string; caminho: string; branch: string },
): Promise<{ commitsForaDaMain: number | null; soltos: number; headNaBranch: boolean }> {
  const principal = await principalDe(mao, w.repo);
  const head = await headDe(mao, w.caminho);
  const st = await status(mao, w.caminho);
  return {
    commitsForaDaMain: await commitsForaDa(mao, w.repo, principal, w.branch),
    // Status que falhou conta como solto: nada é apagado sem saber.
    soltos: st ? st.soltos + st.rastreados : 1,
    headNaBranch: head === w.branch,
  };
}

/** A pasta principal do repositório antes de mesclar. */
export async function retratoDaMescla(
  mao: MaoDoHost,
  repo: string,
): Promise<{ principal: string | null; headDaPastaPrincipal: string | null; mergeEmCurso: boolean; rastreadosMudados: number }> {
  const st = await status(mao, repo);
  return {
    principal: await principalDe(mao, repo),
    headDaPastaPrincipal: await headDe(mao, repo),
    mergeEmCurso: (await mao.git(repo, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).codigo === 0,
    rastreadosMudados: st ? st.rastreados : 1,
  };
}

export async function remotoDe(mao: MaoDoHost, repo: string): Promise<string | null> {
  const s = await mao.git(repo, ["remote", "get-url", "origin"]);
  return s.codigo === 0 ? s.saida.trim() : null;
}

/** As branches de sessão com a conta de commits fora da principal, a data e o assunto. */
export async function branchesDeSessao(mao: MaoDoHost, repo: string): Promise<BranchDeSessao[]> {
  const principal = await principalDe(mao, repo);
  if (!principal) return [];
  const s = await mao.git(repo, ["for-each-ref", "--format=%(refname:short)%09%(committerdate:unix)%09%(subject)", "refs/heads/"]);
  if (s.codigo !== 0) return [];
  const lista: BranchDeSessao[] = [];
  for (const l of linhas(s.saida)) {
    const [nome, data, ...assunto] = l.split("\t");
    if (!nome.startsWith("sessao-")) continue;
    const n = await commitsForaDa(mao, repo, principal, nome);
    if (n === null) continue;
    lista.push({ nome, commitsForaDaMain: n, data: Number(data), assunto: assunto.join("\t") });
  }
  return lista;
}

/** `<repo>/.worktrees/sessao-<N>-<AAAA-MM-DD>`, com o `.worktrees/` fora do git pelo exclude. */
export function caminhoDoWorktree(repo: string, n: number, dia: string): { caminho: string; branch: string } {
  const branch = `sessao-${n}-${dia}`;
  return { caminho: `${repo.replace(/\/+$/, "")}/.worktrees/${branch}`, branch };
}
