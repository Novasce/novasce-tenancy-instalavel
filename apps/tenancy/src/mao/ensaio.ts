// A mão de ensaio: um host de mentira com dados fictícios, a pessoa `lia`. É a
// que o CI, o autoteste e o `npm run dev` usam. Nada aqui toca a máquina.
import { ArquivosNaMemoria, type RespostaDaAjuda } from "@novasce/pastas";
import type { Processo, Sinal } from "@novasce/sessoes";
import type { MaoDoHost, PedidoDeTerminal, SaidaDoGit, TerminalAberto, TrocaDoLogin } from "./tipos";

const telas = import.meta.glob<string>("../../../../casos-de-prova/tela/*.txt", { eager: true, import: "default", query: "?raw" });

/** Uma tela de terminal dos casos de prova, pelo nome do arquivo. */
export function telaDeEnsaio(nome: string): string {
  const achado = Object.entries(telas).find(([caminho]) => caminho.endsWith(`/${nome}`));
  if (!achado) throw new Error(`falta a tela ${nome}`);
  return achado[1];
}

export const HOME = "/home/lia";
export const BRAIN = "/home/lia/Brain";
export const REPOS = ["atelie-api", "atelie-site", "cadernos"].map((r) => `${BRAIN}/repos/${r}`);

export interface ProcessoDeEnsaio extends Processo {
  /** Sinais que o processo ignora (KILL nunca é ignorado). */
  ignora?: Sinal[];
  /** Em que milissegundo do relógio do ensaio o processo nasce. */
  nasceEm?: number;
}

export interface BranchDeEnsaio {
  commitsForaDaMain: number;
  data: number;
  assunto: string;
}

export interface PastaDeTrabalho {
  /** A branch da pasta, ou null com HEAD solto. */
  head: string | null;
  mergeEmCurso: boolean;
  rastreadosMudados: number;
  soltos: number;
}

export interface RepoDeEnsaio extends PastaDeTrabalho {
  pasta: string;
  /** A branch principal, ou null quando o repositório não tem main nem master. */
  principal: string | null;
  remoto: string | null;
  branches: Record<string, BranchDeEnsaio>;
  /** Os worktrees, pelo caminho. */
  worktrees: Record<string, PastaDeTrabalho>;
}

export interface ClisDeEnsaio {
  [cli: string]: { versao: string; ajuda: string } | "ausente" | "nao-responde";
}

export const CLIS_DE_ENSAIO: ClisDeEnsaio = {
  bash: { versao: "GNU bash, version 5.2.0 (exemplo)", ajuda: "Usage: bash [option] ..." },
  claude: {
    versao: "9.9.9 (Claude Code, exemplo)",
    ajuda: "Usage: claude [options]\n  --model <model>\n  --effort <level>\n  --resume <id>\n  --continue\n",
  },
  codex: {
    versao: "codex-cli 9.9.9 (exemplo)",
    ajuda: "Usage: codex [options]\n  -m, --model <MODEL>\n  -c, --config <key=value>\n  resume [--last]\n",
  },
  agy: "ausente",
};

function repoNovo(nome: string, extra: Partial<RepoDeEnsaio> = {}): RepoDeEnsaio {
  return {
    pasta: `${BRAIN}/repos/${nome}`,
    principal: "main",
    head: "main",
    mergeEmCurso: false,
    rastreadosMudados: 0,
    soltos: 0,
    remoto: `git@github.com:exemplo/${nome}.git`,
    branches: { main: { commitsForaDaMain: 0, data: 1793000000, assunto: "Primeiro commit de exemplo" } },
    worktrees: {},
    ...extra,
  };
}

const LEIA_DE_ENSAIO = `ONDE PAROU
A peça de exemplo A ficou com o texto pronto.

O QUE ESPERA
Nada.

MODELO E ESFORÇO PARA ABRIR
Claude: claude-opus-5-5, esforço alto.
`;

function brainDeEnsaio(): Record<string, string> {
  return {
    [`${BRAIN}/CLAUDE.md`]: "# Brain de exemplo\n",
    [`${BRAIN}/continuar/a-continuar/2026-10-28 Ateliê - peça A/LEIA.txt`]: LEIA_DE_ENSAIO,
    [`${BRAIN}/continuar/a-continuar/2026-10-28 Ateliê - peça A/prompt.txt`]:
      "Primeiro passo: mova a pasta continuar/a-continuar/2026-10-28 Ateliê - peça A/ para continuar/continuados/.\n\nContinue a peça A.\n",
    [`${BRAIN}/continuar/em-espera/2026-10-27 Ateliê - espera a foto/LEIA.txt`]: "ONDE PAROU\nFalta a foto.\n",
    [`${BRAIN}/continuar/em-espera/2026-10-27 Ateliê - espera a foto/prompt.txt`]: "Continue quando a foto chegar.\n",
    [`${BRAIN}/continuar/continuados/`]: "",
    ...Object.fromEntries(REPOS.map((r) => [`${r}/.git/HEAD`, "ref: refs/heads/main\n"])),
  };
}

interface TerminalDeEnsaio extends TerminalAberto {
  pedido: PedidoDeTerminal;
  cli: string;
  vivo: boolean;
  tamanho: { colunas: number; linhas: number };
  escrito: string[];
  ouvintes: Set<(dados: string) => void>;
  saidas: Set<(codigo: number) => void>;
}

/** Qual CLI o pedido sobe: o que vem depois de `exec`, ou o próprio programa. */
export function cliDoPedido(p: PedidoDeTerminal): string {
  const linha = [p.programa, ...p.args].join(" ");
  const m = /\bexec\s+([^\s"']+)/.exec(linha);
  const nome = (m ? m[1] : p.programa).split("/").pop() ?? "";
  return nome;
}

export interface Ensaio {
  /** Os sinais mandados, na ordem. */
  sinais: { em: number; pid?: number; grupo?: number; sinal: Sinal }[];
  /** O relógio do ensaio, em ms. */
  agora: number;
  esperar(ms: number): Promise<void>;
  vivo(id: string): boolean;
  terminais(): TerminalDeEnsaio[];
  /** Desenha uma tela inteira no terminal (limpa antes). */
  mostrar(id: string, texto: string): void;
  /** O que a tela escreveu no terminal. */
  escrito(id: string): string[];
  /** O processo sai sozinho. */
  sair(id: string, codigo: number): void;
  processos: ProcessoDeEnsaio[];
  repos: Record<string, RepoDeEnsaio>;
  clis: ClisDeEnsaio;
  /** A tela que cada CLI mostra ao abrir. */
  telaInicial: Record<string, string>;
  login: { tem: boolean; troca: TrocaDoLogin };
  /** Os comandos de git rodados, para os testes. */
  gits: { pasta: string; args: string[] }[];
  arquivos: ArquivosNaMemoria;
  recentes: string[];
}

export type MaoDeEnsaio = MaoDoHost & { ensaio: Ensaio };

export interface OpcoesDoEnsaio {
  processos?: ProcessoDeEnsaio[];
  repos?: RepoDeEnsaio[];
  clis?: ClisDeEnsaio;
  arquivos?: Record<string, string>;
}

export const PID_DO_APP = 50;

export function maoDeEnsaio(o: OpcoesDoEnsaio = {}): MaoDeEnsaio {
  const terminais = new Map<string, TerminalDeEnsaio>();
  let proximoPid = 1000;
  let proximoId = 1;
  const reposIniciais = o.repos ?? [repoNovo("atelie-api"), repoNovo("atelie-site"), repoNovo("cadernos", { remoto: null })];
  const ensaio: Ensaio = {
    sinais: [],
    agora: 0,
    async esperar(ms) {
      ensaio.agora += ms;
    },
    vivo: (id) => terminais.get(id)?.vivo ?? false,
    terminais: () => [...terminais.values()],
    mostrar(id, texto) {
      const t = terminais.get(id);
      if (!t) return;
      const dados = "\u001b[2J\u001b[H" + texto.replace(/\r?\n/g, "\r\n");
      for (const f of t.ouvintes) f(dados);
    },
    escrito: (id) => terminais.get(id)?.escrito ?? [],
    sair(id, codigo) {
      const t = terminais.get(id);
      if (!t || !t.vivo) return;
      t.vivo = false;
      matar(t.pid);
      for (const f of t.saidas) f(codigo);
    },
    processos: [
      { pid: 1, ppid: 0, pgid: 1, sid: 1, inicio: "1", argv: ["/sbin/init"] },
      { pid: 40, ppid: 1, pgid: 40, sid: 40, inicio: "100", argv: ["plasmashell"] },
      { pid: PID_DO_APP, ppid: 40, pgid: PID_DO_APP, sid: 40, inicio: "200", argv: ["novasce-tenancy"] },
      ...(o.processos ?? []),
    ],
    repos: Object.fromEntries(reposIniciais.map((r) => [r.pasta, r])),
    clis: { ...CLIS_DE_ENSAIO, ...o.clis },
    telaInicial: { claude: telaDeEnsaio("CP-TEL-01.txt") },
    login: { tem: true, troca: { codigo: "codigo-de-ensaio", validoAte: "2026-10-28T12:01:00Z" } },
    gits: [],
    arquivos: new ArquivosNaMemoria({ ...brainDeEnsaio(), ...o.arquivos }),
    recentes: [`${BRAIN}`, REPOS[1]],
  };

  const vivos = () => ensaio.processos.filter((p) => (p.nasceEm ?? 0) <= ensaio.agora && !mortos.has(chave(p)));
  const mortos = new Set<string>();
  const chave = (p: { pid: number; inicio: string }) => `${p.pid}@${p.inicio}`;
  function matar(pid: number) {
    for (const p of ensaio.processos) if (p.pid === pid) mortos.add(chave(p));
    for (const t of terminais.values()) {
      if (t.pid === pid && t.vivo) {
        t.vivo = false;
        for (const f of t.saidas) f(129);
      }
    }
  }
  function receber(p: ProcessoDeEnsaio, s: Sinal) {
    if (p.pid === PID_DO_APP) throw new Error("a mão de ensaio recusou um sinal ao próprio app");
    if (s === "KILL" || !(p.ignora ?? []).includes(s)) matar(p.pid);
  }

  const mao: MaoDeEnsaio = {
    tipo: "ensaio",
    ensaio,
    terminal: {
      async abrir(pedido) {
        const id = `t${proximoId++}`;
        const pid = proximoPid++;
        const inicio = String(10_000 + pid);
        const cli = cliDoPedido(pedido);
        const ambiente: Record<string, string> = { ...pedido.ambiente };
        ensaio.processos.push({ pid, ppid: PID_DO_APP, pgid: pid, sid: pid, inicio, argv: [pedido.programa, ...pedido.args], ambiente, mb: 120 });
        const t: TerminalDeEnsaio = {
          id,
          pid,
          inicio,
          pedido,
          cli,
          vivo: true,
          tamanho: { colunas: pedido.colunas, linhas: pedido.linhas },
          escrito: [],
          ouvintes: new Set(),
          saidas: new Set(),
        };
        terminais.set(id, t);
        const tela = ensaio.telaInicial[cli];
        if (tela) queueMicrotask(() => ensaio.mostrar(id, tela));
        return { id, pid, inicio };
      },
      async escrever(id, dados) {
        const t = terminais.get(id);
        if (!t?.vivo) throw new Error("terminal fechado");
        t.escrito.push(dados);
      },
      async redimensionar(id, colunas, linhas) {
        const t = terminais.get(id);
        if (t) t.tamanho = { colunas, linhas };
      },
      aoReceber(id, f) {
        const t = terminais.get(id);
        t?.ouvintes.add(f);
        return () => t?.ouvintes.delete(f);
      },
      aoSair(id, f) {
        const t = terminais.get(id);
        t?.saidas.add(f);
        return () => t?.saidas.delete(f);
      },
    },
    processos: {
      async tabela() {
        return vivos().map(({ ignora: _i, nasceEm: _n, ...p }) => p);
      },
      async sinal(alvos, sinal) {
        for (const a of alvos) {
          ensaio.sinais.push({ em: ensaio.agora, pid: a.pid, sinal });
          for (const p of vivos().filter((x) => x.pid === a.pid && x.inicio === a.inicio)) receber(p, sinal);
        }
      },
      async sinalAoGrupo(lider, sinal) {
        ensaio.sinais.push({ em: ensaio.agora, grupo: lider.pid, sinal });
        if (!vivos().some((x) => x.pid === lider.pid && x.inicio === lider.inicio)) return;
        for (const p of vivos().filter((x) => x.pgid === lider.pid)) receber(p, sinal);
      },
      async doApp() {
        return { pid: PID_DO_APP, pgid: PID_DO_APP };
      },
    },
    async git(pasta, args) {
      ensaio.gits.push({ pasta, args });
      return gitDeEnsaio(ensaio.repos, pasta, args);
    },
    cofre: {
      async temLogin() {
        return ensaio.login.tem;
      },
      async trocar() {
        return ensaio.login.tem ? ensaio.login.troca : { falha: "sem-login" };
      },
    },
    arquivos: {
      home: () => HOME,
      brain: () => BRAIN,
      async repos() {
        return Object.keys(ensaio.repos).sort();
      },
      async recentes() {
        return [...ensaio.recentes];
      },
      arquivos: () => ensaio.arquivos,
    },
    cli: {
      async versao(cli) {
        return respostaDaCli(ensaio.clis[cli], "versao");
      },
      async ajuda(cli) {
        return respostaDaCli(ensaio.clis[cli], "ajuda");
      },
    },
  };
  return mao;
}

function respostaDaCli(c: ClisDeEnsaio[string] | undefined, o: "versao" | "ajuda"): RespostaDaAjuda {
  if (!c || c === "ausente") return { codigo: 127, saida: "" };
  if (c === "nao-responde") return { esgotou: true };
  return { codigo: 0, saida: c[o] };
}

// MARK: git de mentira

function ok(saida = ""): SaidaDoGit {
  return { codigo: 0, saida, erro: "" };
}
function falha(erro: string, codigo = 128): SaidaDoGit {
  return { codigo, saida: "", erro };
}

function acharRepo(repos: Record<string, RepoDeEnsaio>, pasta: string): { repo: RepoDeEnsaio; aqui: PastaDeTrabalho } | null {
  for (const repo of Object.values(repos)) {
    if (repo.pasta === pasta) return { repo, aqui: repo };
    if (repo.worktrees[pasta]) return { repo, aqui: repo.worktrees[pasta] };
  }
  return null;
}

/** Os comandos de git que o app roda, respondidos sobre o modelo do repositório. */
export function gitDeEnsaio(repos: Record<string, RepoDeEnsaio>, pasta: string, args: string[]): SaidaDoGit {
  const achado = acharRepo(repos, pasta);
  if (!achado) return falha("fatal: not a git repository (or any of the parent directories): .git");
  const { repo, aqui } = achado;
  const a = args.join(" ");
  if (a === "rev-parse --show-toplevel") return ok(pasta + "\n");
  if (a === "symbolic-ref --quiet --short HEAD") return aqui.head ? ok(aqui.head + "\n") : falha("", 1);
  if (args[0] === "rev-parse" && args[1] === "--verify" && args[2] === "--quiet") {
    const ref = args[3];
    if (ref === "MERGE_HEAD") return aqui.mergeEmCurso ? ok("0".repeat(40) + "\n") : falha("", 1);
    const nome = ref.replace(/^refs\/heads\//, "");
    return repo.branches[nome] || nome === repo.principal ? ok("1".repeat(40) + "\n") : falha("", 1);
  }
  if (args[0] === "rev-list" && args[1] === "--count") {
    const [base, branch] = args[2].split("..");
    if (!repo.principal || base !== repo.principal) return falha(`fatal: ambiguous argument '${args[2]}'`);
    const b = repo.branches[branch];
    return b ? ok(`${b.commitsForaDaMain}\n`) : falha(`fatal: ambiguous argument '${args[2]}'`);
  }
  if (a === "status --porcelain") {
    const linhas = [
      ...Array.from({ length: aqui.rastreadosMudados }, (_, i) => ` M arquivo-${i + 1}.txt`),
      ...Array.from({ length: aqui.soltos }, (_, i) => `?? novo-${i + 1}.txt`),
    ];
    return ok(linhas.map((l) => l + "\n").join(""));
  }
  if (a === "remote get-url origin") return repo.remoto ? ok(repo.remoto + "\n") : falha("error: No such remote 'origin'", 2);
  if (args[0] === "for-each-ref") {
    const linhas = Object.entries(repo.branches)
      .filter(([nome]) => nome !== repo.principal)
      .map(([nome, b]) => `${nome}\t${b.data}\t${b.assunto}`);
    return ok(linhas.map((l) => l + "\n").join(""));
  }
  if (args[0] === "worktree" && args[1] === "add" && args[2] === "-b") {
    const [branch, caminho, base] = args.slice(3);
    if (repo.branches[branch]) return falha(`fatal: a branch named '${branch}' already exists`);
    if (base !== repo.principal) return falha(`fatal: invalid reference: ${base}`);
    repo.branches[branch] = { commitsForaDaMain: 0, data: repo.branches[base]?.data ?? 0, assunto: "" };
    repo.worktrees[caminho] = { head: branch, mergeEmCurso: false, rastreadosMudados: 0, soltos: 0 };
    return ok();
  }
  if (args[0] === "worktree" && args[1] === "remove") {
    const caminho = args[args.length - 1];
    const w = repo.worktrees[caminho];
    if (!w) return falha(`fatal: '${caminho}' is not a working tree`);
    if (w.soltos + w.rastreadosMudados > 0 && !args.includes("--force")) return falha("fatal: contains modified or untracked files");
    delete repo.worktrees[caminho];
    return ok();
  }
  if (args[0] === "branch" && (args[1] === "-D" || args[1] === "-d")) {
    const nome = args[2];
    if (!repo.branches[nome]) return falha(`error: branch '${nome}' not found.`, 1);
    if (args[1] === "-d" && repo.branches[nome].commitsForaDaMain > 0) return falha(`error: The branch '${nome}' is not fully merged.`, 1);
    delete repo.branches[nome];
    return ok();
  }
  if (args[0] === "merge") {
    const branch = args[args.length - 1];
    if (!repo.branches[branch]) return falha(`merge: ${branch} - not something we can merge`, 1);
    repo.branches[branch].commitsForaDaMain = 0;
    return ok("Merge made by the 'ort' strategy.\n");
  }
  if (args[0] === "log" && args[1] === "--oneline") {
    const [, branch] = args[2].split("..");
    const b = repo.branches[branch];
    if (!b) return falha(`fatal: ambiguous argument '${args[2]}'`);
    return ok(Array.from({ length: b.commitsForaDaMain }, (_, i) => `${String(i + 1).padStart(7, "a")} ${b.assunto || "Commit de exemplo"}\n`).join(""));
  }
  return falha(`git de ensaio: comando não previsto: git ${a}`, 129);
}

export { repoNovo };
