// As guardas do git das sessões (UC20) do lado do app: abrir em worktree,
// mesclar, abrir PR e o Trabalho fora da main. As decisões são do pacote
// sessoes; aqui se roda o git pela mão e se escrevem os recados do Mac.
import { decidirMescla, enderecoDoPR, sessaoJaAberta, trabalhoForaDaMain, duracao, type BranchDeSessao } from "@novasce/sessoes";
import { nomeDaPasta, type Bancada, type Programa, type Worktree } from "./bancada";
import { branchesDeSessao, caminhoDoWorktree, principalDe, remotoDe, retratoDaMescla, temGit } from "./repos";

export const NOME_DO_PROGRAMA: Record<string, string> = { claude: "Claude", codex: "Codex", agy: "agy" };

/** A pergunta do worktree, quando já há sessão viva no mesmo repositório (CP-GIT-01, 02). */
export async function perguntaDeWorktree(bancada: Bancada, pasta: string): Promise<{ texto: string; repo: string } | null> {
  const mao = bancada.mao;
  const comGit = await temGit(mao, pasta);
  const home = mao.arquivos.home();
  const aberta = sessaoJaAberta({
    pasta,
    temGit: comGit,
    abertas: bancada.abertas().map((s) => ({ pasta: s.pasta, programa: s.programa === "comando" ? "comando" : s.programa, desde: String(s.criadaEm), viva: true })),
    espacos: [mao.arquivos.brain(), ...mao.arquivos.espacos()],
    home,
  });
  if (!aberta) return null;
  const ha = duracao((bancada.agora() - Number(aberta.desde)) / 1000);
  return { texto: `${nomeDaPasta(pasta, home)} tem um ${aberta.programa} aberto há ${ha}. Abrir a nova em worktree?`, repo: pasta.replace(/\/+$/, "") };
}

function diaLocal(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

/** Cria o worktree `<repo>/.worktrees/sessao-<N>-<dia>` a partir da principal, com `.worktrees/` no exclude. */
export async function criarWorktree(bancada: Bancada, repo: string): Promise<Worktree | { erro: string }> {
  const mao = bancada.mao;
  const arquivos = mao.arquivos.arquivos();
  const principal = await principalDe(mao, repo);
  if (!principal) return { erro: "O repositório não tem main nem master: a sessão abre na mesma pasta." };
  let n = Math.max(1, bancada.sessoes().filter((s) => s.pasta.startsWith(repo)).length);
  let w = caminhoDoWorktree(repo, n, diaLocal(bancada.agora()));
  while (arquivos.existe(w.caminho)) w = caminhoDoWorktree(repo, ++n, diaLocal(bancada.agora()));
  const s = await mao.git(repo, ["worktree", "add", "-b", w.branch, w.caminho, principal]);
  if (s.codigo !== 0) return { erro: `O git não criou o worktree: ${s.erro.trim().split("\n")[0]}` };
  const exclude = `${repo}/.git/info/exclude`;
  const atual = arquivos.ler(exclude) ?? "";
  if (!atual.split("\n").includes(".worktrees/")) arquivos.gravar(exclude, `${atual}${atual && !atual.endsWith("\n") ? "\n" : ""}.worktrees/\n`);
  return { repo, caminho: w.caminho, branch: w.branch };
}

export async function abrirEmWorktree(bancada: Bancada, p: { programa: Programa; repo: string; nome?: string; comando?: string; escuro?: boolean }) {
  const w = await criarWorktree(bancada, p.repo);
  if ("erro" in w) {
    bancada.recado(w.erro, true);
    return bancada.abrir({ programa: p.programa, pasta: p.repo, nome: p.nome, comando: p.comando, escuro: p.escuro });
  }
  const base = p.nome?.trim() || nomeDaPasta(p.repo, bancada.mao.arquivos.home());
  return bancada.abrir({ programa: p.programa, pasta: w.caminho, nome: `${base} · ${w.branch}`, comando: p.comando, escuro: p.escuro, worktree: w });
}

/** Mesclar a branch na principal, na pasta principal do repo (CP-GIT-06). Devolve se mesclou. */
export async function mesclar(bancada: Bancada, repo: string, branch: string): Promise<boolean> {
  const mao = bancada.mao;
  const curto = nomeDaPasta(repo, mao.arquivos.home());
  const d = decidirMescla({ ...(await retratoDaMescla(mao, repo)), branch });
  if (d.tipo === "recusa") {
    const texto =
      d.motivo === "outra-branch"
        ? `Não mesclou: a pasta principal de ${curto} está em ${d.branch}. A branch ${branch} ficou.`
        : d.motivo === "pasta-principal-ocupada"
          ? `Não mesclou: a pasta principal de ${curto} tem arquivo mudado ou um merge no meio. A branch ${branch} ficou.`
          : `Não mesclou: ${curto} não tem main nem master. A branch ${branch} ficou.`;
    bancada.recado(texto, true);
    return false;
  }
  const s = await mao.git(repo, d.git);
  if (s.codigo !== 0) {
    // Conflito: o merge é desfeito na hora, para a pasta principal ficar como estava.
    if ((await mao.git(repo, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"])).codigo === 0) await mao.git(repo, ["merge", "--abort"]);
    bancada.recado(`Não mesclou: o git recusou (conflito). Nada mudou na main; a branch ${branch} ficou.`, true);
    return false;
  }
  const sha = (await mao.git(repo, ["rev-parse", "--short", "HEAD"])).saida.trim();
  const principal = (await principalDe(mao, repo)) ?? "main";
  bancada.recado(`${branch} mesclada na ${principal} de ${curto}${sha ? ` (${sha})` : ""}. Falta mandar para o GitHub.`, false);
  return true;
}

/** Abrir PR: manda a branch e abre a página de comparação; o PR é a pessoa quem cria (CP-GIT-07). */
export async function abrirPR(bancada: Bancada, repo: string, branch: string): Promise<boolean> {
  const mao = bancada.mao;
  const principal = (await principalDe(mao, repo)) ?? "main";
  const remoto = await remotoDe(mao, repo);
  const endereco = remoto ? enderecoDoPR(remoto, principal, branch) : null;
  const push = endereco ? await mao.git(repo, ["push", "-u", "origin", branch]) : null;
  if (!endereco || !push || push.codigo !== 0) {
    bancada.recado(`O push de ${branch} não passou (remoto fora do GitHub ou sem acesso). A branch ficou.`, true);
    return false;
  }
  await mao.abrirNoNavegador(endereco);
  bancada.recado(`${branch} foi para o GitHub; a página do PR abriu no navegador. O PR é você quem cria.`, false);
  return true;
}

export interface ForaDaMain extends BranchDeSessao {
  repo: string;
  principal: string;
}

/** Os repos que já tiveram worktree do app e os das sessões abertas; as branches de sessão com commit e sem aba. */
export async function listarForaDaMain(bancada: Bancada): Promise<ForaDaMain[]> {
  const mao = bancada.mao;
  const repos = new Set<string>();
  for (const s of bancada.sessoes()) if (s.worktree) repos.add(s.worktree.repo);
  for (const s of bancada.abertas()) if (!s.worktree && (await temGit(mao, s.pasta))) repos.add(s.pasta.replace(/\/+$/, ""));
  const abertas = bancada.abertas().flatMap((s) => (s.worktree ? [s.worktree.branch] : []));
  const lista: ForaDaMain[] = [];
  for (const repo of repos) {
    const r = trabalhoForaDaMain(await branchesDeSessao(mao, repo), abertas);
    const principal = (await principalDe(mao, repo)) ?? "main";
    lista.push(...r.lista.map((b) => ({ ...b, repo, principal })));
  }
  return lista.sort((a, b) => (b.data ?? 0) - (a.data ?? 0));
}

/** "fechada há 4 min", como o Retomar.quando do Mac. */
export function quandoFechou(ms: number): string {
  const s = ms / 1000;
  if (s < 90) return "fechada agora há pouco";
  if (s < 3600) return `fechada há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `fechada há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return `fechada há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** O comando de retomar que o --help da CLI aceita; null quando ela não tem. */
export async function opcoesDeRetomar(bancada: Bancada, programa: Programa): Promise<string[] | null> {
  if (programa !== "claude" && programa !== "codex") return null;
  const r = await bancada.mao.cli.ajuda(programa);
  if (!("codigo" in r) || r.codigo !== 0) return null;
  if (programa === "codex" && /\bresume\b/.test(r.saida)) return ["resume", "--last"];
  return r.saida.includes("--continue") ? ["--continue"] : null;
}
