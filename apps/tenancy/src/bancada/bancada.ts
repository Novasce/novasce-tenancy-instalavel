// O estado da Bancada: as sessões, quem está aberto e a ordem. A tela lê daqui
// e assina as mudanças; a mão do host faz o resto.
import { aoFechar, encerrar, type DestinoAoFechar } from "@novasce/sessoes";
import type { MaoDoHost, PedidoDeTerminal, TerminalAberto } from "../mao/tipos";
import { bancoNaMemoria, type BancoDeSessoes } from "./banco";
import { maoDeProcessosDe, protegidosDoHost } from "./processos";
import { principalDe, retratoAoFechar } from "./repos";

export type Programa = "shell" | "claude" | "codex" | "agy" | "comando";

/** O estado que o ponto da lateral desenha. Os do agente vêm da leitura da tela (UC17). */
export type EstadoDaSessao =
  | "abrindo"
  | "trabalhando"
  | "livre"
  | "pediu-permissao"
  | "terminou"
  | "parada"
  | "sem-resposta"
  | "terminal"
  | "encerrando"
  | "encerrada";

export const ROTULO_DO_ESTADO: Record<EstadoDaSessao, string> = {
  abrindo: "abrindo",
  trabalhando: "trabalhando",
  livre: "livre",
  "pediu-permissao": "pediu permissão",
  terminou: "terminou",
  parada: "parada",
  "sem-resposta": "sem resposta",
  terminal: "terminal",
  encerrando: "encerrando…",
  encerrada: "encerrada",
};

export interface Worktree {
  repo: string;
  caminho: string;
  branch: string;
}

/** O que a sessão espera da pessoa numa faixa (UC20 e UC22). */
export type Pendencia =
  | { tipo: "fora-da-main"; frase: string; commits: number; principal: string; soltos: number }
  | { tipo: "sem-commit"; soltos: number }
  | { tipo: "encerrar" }
  | { tipo: "retomar"; fechadaEm: number }
  | { tipo: "do-disco" };

/** Quanto tempo depois de fechada uma sessão de Claude ou Codex ainda oferece retomar. */
export const RETOMAR_ATE_MS = 7 * 24 * 3600 * 1000;

export interface Recado {
  texto: string;
  erro: boolean;
}

export interface SessaoDaBancada {
  id: string;
  nome: string;
  nomeManual: boolean;
  pasta: string;
  programa: Programa;
  /** O comando livre, quando o programa é "comando". */
  comando?: string;
  criadaEm: number;
  ultimaVez: number;
  ordem: number;
  /** null quando a sessão está fechada (fica na lista para reabrir). */
  terminal: TerminalAberto | null;
  estado: EstadoDaSessao;
  /** Desde quando está no estado, para o "há N min". */
  estadoDesde: number;
  worktree?: Worktree;
  pendencia?: Pendencia;
  codigoDeSaida?: number;
  /** A última fala do agente, para o nome automático. */
  ultimaFala?: string;
  /** A pasta de continuar/ de onde a sessão nasceu, para avisar se ela voltar. */
  origem?: string;
  /** O segundo painel, um shell na mesma pasta (UC21). */
  extra?: TerminalAberto | null;
}

export interface PedidoDeSessao {
  programa: Programa;
  pasta: string;
  nome?: string;
  comando?: string;
  /** Opções a mais para a CLI (modelo, esforço, retomar). */
  opcoes?: string[];
  /** O tema escolhe o COLORFGBG. */
  escuro?: boolean;
  worktree?: Worktree;
}

/** O que sai do ambiente antes da CLI subir: uma sessão do Claude dentro de outra se confunde. */
export const AMBIENTE_QUE_SAI = ["CLAUDECODE", "CLAUDE_CODE*"];
export const MARCA = "TENANCY_SESSAO";
const AGENTES = new Set<Programa>(["claude", "codex", "agy"]);

export function aspas(s: string): string {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

/** A linha que a CLI recebe: o programa e as opções, ou o comando livre. */
export function linhaDaCli(s: { programa: Programa; comando?: string; opcoes?: string[] }): string | null {
  if (s.programa === "shell") return null;
  if (s.programa === "comando") return (s.comando ?? "").trim() || null;
  return [s.programa, ...(s.opcoes ?? []).map(aspas)].join(" ");
}

/** `$SHELL -l -c "exec <cli>"` na pasta, com a marca da sessão e o terminal de cores. */
export function pedidoDeTerminal(
  s: { id: string; programa: Programa; pasta: string; comando?: string; opcoes?: string[] },
  o: { shell: string; lang: string; escuro: boolean; colunas: number; linhas: number },
): PedidoDeTerminal {
  const cli = linhaDaCli(s);
  return {
    programa: o.shell,
    // A CLI troca o shell (exec): fechar o agente fecha a aba. O comando livre roda inteiro no shell.
    args: cli ? ["-l", "-c", s.programa === "comando" ? cli : `exec ${cli}`] : ["-l"],
    pasta: s.pasta,
    ambiente: {
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      COLORFGBG: o.escuro ? "15;0" : "0;15",
      LANG: o.lang,
      [MARCA]: s.id,
    },
    tirar: AMBIENTE_QUE_SAI,
    colunas: o.colunas,
    linhas: o.linhas,
  };
}

/** O nome que a sessão ganha sem a pessoa dar um: os dois últimos trechos do caminho, a partir da home. */
export function nomeDaPasta(pasta: string, home = ""): string {
  const limpa = pasta.replace(/\/+$/, "");
  const casa = home.replace(/\/+$/, "");
  if (casa && limpa === casa) return "~";
  const relativa = casa && limpa.startsWith(casa + "/") ? limpa.slice(casa.length + 1) : limpa;
  const partes = relativa.split("/").filter(Boolean);
  return partes.slice(-2).join("/") || pasta;
}

/**
 * O nome pela última fala do agente, como o Mac: sem marcador nem aspas no
 * começo, a primeira frase se ela tem 8 caracteres ou mais, teto de 38 com a
 * última palavra inteira e reticências. Menos de 8 caracteres não vira nome.
 */
export function nomeDaFala(fala: string): string | null {
  let t = fala.trim().replace(/^[⏺✻✽·●—\-*>\s]+/u, "").replace(/^["'`“”]+|["'`“”]+$/gu, "").trim();
  if (t.length < 8) return null;
  const fim = /(\n|;|[.:](\s|$))/.exec(t);
  if (fim && fim.index >= 8) t = t.slice(0, fim.index);
  t = t.replace(/\s+/g, " ").trim();
  if (t.length <= 38) return t;
  const corte = t.slice(0, 38);
  const espaco = corte.lastIndexOf(" ");
  return (espaco > 0 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.]+$/, "") + "…";
}

/** Quem espera a pessoa: viva e terminou ou pediu permissão. */
export function esperaVoce(s: SessaoDaBancada): boolean {
  return s.terminal !== null && (s.estado === "terminou" || s.estado === "pediu-permissao");
}

export interface ResultadoDoEncerrar {
  encerradas: string[];
  /** As que ficaram abertas por uma guarda, com a faixa na sessão. */
  ficaram: string[];
}

export class Bancada {
  private lista: SessaoDaBancada[] = [];
  private ouvintes = new Set<() => void>();
  private proximo = 1;
  readonly banco: BancoDeSessoes;
  /** O recado do pé: sucesso some em 12 s, falha fica até "Entendi". */
  recadoAtual: Recado | null = null;
  private restaurada = false;

  constructor(
    readonly mao: MaoDoHost,
    private relogio: () => number = () => Date.now(),
    banco?: BancoDeSessoes,
    private esperar?: (ms: number) => Promise<void>,
  ) {
    this.banco = banco ?? bancoNaMemoria();
    for (const s of this.banco.ler()) {
      this.lista.push({ ...s, terminal: null, estado: "encerrada", estadoDesde: s.ultimaVez });
      this.proximo = Math.max(this.proximo, Number(s.id.replace(/\D/g, "")) + 1 || this.proximo);
    }
  }

  agora(): number {
    return this.relogio();
  }

  sessoes(): SessaoDaBancada[] {
    return [...this.lista].sort((a, b) => a.ordem - b.ordem);
  }

  abertas(): SessaoDaBancada[] {
    return this.sessoes().filter((s) => s.terminal !== null);
  }

  sessao(id: string): SessaoDaBancada | undefined {
    return this.lista.find((s) => s.id === id);
  }

  ouvir(f: () => void): () => void {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  }

  avisar(): void {
    this.banco.gravar(this.lista);
    for (const f of this.ouvintes) f();
  }

  /** A cada leitura: as vivas carimbam a última vez, para o retomar contar de quando fecharam mesmo se o app cair. */
  carimbar(): void {
    const agora = this.relogio();
    for (const s of this.lista) if (s.terminal) s.ultimaVez = agora;
    this.banco.gravar(this.lista);
  }

  recado(texto: string, erro: boolean): void {
    this.recadoAtual = { texto, erro };
    this.avisar();
  }

  limparRecado(): void {
    this.recadoAtual = null;
    this.avisar();
  }

  /**
   * As sessões do banco ao abrir o app. Só o shell sobe sozinho; Claude e Codex
   * fechados há menos de 7 dias oferecem retomar; o resto, abrir de novo.
   */
  async restaurar(): Promise<void> {
    if (this.restaurada) return;
    this.restaurada = true;
    const agora = this.relogio();
    for (const s of this.sessoes()) {
      if (s.terminal) continue;
      if (s.programa === "shell") await this.reabrir(s.id);
      else if ((s.programa === "claude" || s.programa === "codex") && agora - s.ultimaVez < RETOMAR_ATE_MS) s.pendencia = { tipo: "retomar", fechadaEm: s.ultimaVez };
      else s.pendencia = { tipo: "do-disco" };
    }
    this.avisar();
  }

  /**
   * Fechar pela tela: worktree passa pela guarda; agente vivo pergunta numa
   * faixa; shell sem nada sai direto.
   */
  async fechar(id: string): Promise<void> {
    const s = this.sessao(id);
    if (!s?.terminal || s.estado === "encerrando") return;
    if (s.worktree) {
      const d = aoFechar({ ...(await retratoAoFechar(this.mao, s.worktree)), branch: s.worktree.branch });
      if (d.tipo !== "apagar" || !AGENTES.has(s.programa)) {
        await this.encerrar([id]);
        return;
      }
    }
    if (AGENTES.has(s.programa)) {
      s.pendencia = { tipo: "encerrar" };
      this.avisar();
      return;
    }
    await this.encerrar([id]);
  }

  /** Sair do app: encerra todas; worktree fica como está, a branch nunca sai. */
  async encerrarTudo(): Promise<void> {
    await this.encerrar(
      this.abertas().map((s) => s.id),
      { semGuarda: true },
    );
  }

  mudarEstado(id: string, estado: EstadoDaSessao): void {
    const s = this.sessao(id);
    if (!s || s.estado === estado) return;
    s.estado = estado;
    s.estadoDesde = this.relogio();
    this.avisar();
  }

  async abrir(p: PedidoDeSessao): Promise<SessaoDaBancada> {
    const agora = this.relogio();
    const id = `s${this.proximo++}`;
    const sessao: SessaoDaBancada = {
      id,
      nome: p.nome?.trim() || nomeDaPasta(p.pasta, this.mao.arquivos.home()),
      nomeManual: !!p.nome?.trim(),
      pasta: p.pasta,
      programa: p.programa,
      comando: p.comando,
      criadaEm: agora,
      ultimaVez: agora,
      ordem: this.lista.length ? Math.max(...this.lista.map((s) => s.ordem)) + 1 : 0,
      terminal: null,
      estado: p.programa === "shell" || p.programa === "comando" ? "terminal" : "abrindo",
      estadoDesde: agora,
      worktree: p.worktree,
    };
    this.lista.push(sessao);
    try {
      await this.subir(sessao, p);
    } catch (e) {
      // Não subiu: a sessão sai da lista e a pessoa sabe por quê.
      this.lista = this.lista.filter((x) => x !== sessao);
      this.recado(`A sessão não abriu: ${e instanceof Error ? e.message : String(e)}.`, true);
      throw e;
    }
    return sessao;
  }

  /** Abre de novo uma sessão fechada, na mesma pasta e com o mesmo programa. */
  async reabrir(id: string, opcoes?: string[]): Promise<void> {
    const s = this.sessao(id);
    if (!s || s.terminal) return;
    s.pendencia = undefined;
    s.estado = s.programa === "shell" || s.programa === "comando" ? "terminal" : "abrindo";
    s.estadoDesde = this.relogio();
    s.codigoDeSaida = undefined;
    try {
      await this.subir(s, { programa: s.programa, pasta: s.pasta, comando: s.comando, opcoes });
    } catch (e) {
      s.estado = "encerrada";
      this.recado(`A sessão não abriu de novo: ${e instanceof Error ? e.message : String(e)}.`, true);
    }
  }

  private opcoesDoTerminal(escuro: boolean) {
    return { shell: this.mao.cli.shell(), lang: "pt_BR.UTF-8", escuro, colunas: 80, linhas: 24 };
  }

  private async subir(sessao: SessaoDaBancada, p: PedidoDeSessao): Promise<void> {
    sessao.terminal = await this.mao.terminal.abrir(pedidoDeTerminal({ ...sessao, opcoes: p.opcoes }, this.opcoesDoTerminal(!!p.escuro)));
    sessao.ultimaVez = this.relogio();
    const desligar = this.mao.terminal.aoSair(sessao.terminal.id, (codigo) => {
      desligar();
      sessao.terminal = null;
      sessao.codigoDeSaida = codigo;
      sessao.ultimaVez = this.relogio();
      sessao.estado = "encerrada";
      sessao.estadoDesde = this.relogio();
      this.avisar();
    });
    this.avisar();
  }

  /** Vazio volta ao automático (a última fala, senão a pasta); preenchido fixa. */
  renomear(id: string, nome: string): void {
    const s = this.sessao(id);
    if (!s) return;
    const limpo = nome.trim();
    s.nome = limpo || (s.ultimaFala && nomeDaFala(s.ultimaFala)) || nomeDaPasta(s.pasta, this.mao.arquivos.home());
    s.nomeManual = !!limpo;
    this.avisar();
  }

  /** O nome automático pela última fala; nunca por cima de um nome dado pela pessoa, nunca para shell. */
  nomeAutomatico(id: string, fala: string): void {
    const s = this.sessao(id);
    if (!s || s.programa === "shell" || s.programa === "comando") return;
    s.ultimaFala = fala;
    const nome = nomeDaFala(fala);
    if (s.nomeManual || !nome || nome === s.nome) return;
    s.nome = nome;
    this.avisar();
  }

  /** Dividir: um shell na mesma pasta, ao lado. Só um painel a mais por sessão. */
  async dividir(id: string, escuro = false): Promise<void> {
    const s = this.sessao(id);
    if (!s?.terminal || s.extra) return;
    s.extra = await this.mao.terminal.abrir(pedidoDeTerminal({ id: s.id, programa: "shell", pasta: s.pasta }, this.opcoesDoTerminal(escuro)));
    const desligar = this.mao.terminal.aoSair(s.extra.id, () => {
      desligar();
      s.extra = null;
      this.avisar();
    });
    this.avisar();
  }

  /** Sobe ou desce uma posição na ordem livre. Devolve se andou. */
  mover(id: string, passo: -1 | 1): boolean {
    const ordem = this.sessoes();
    const i = ordem.findIndex((s) => s.id === id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= ordem.length) return false;
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    ordem.forEach((s, n) => (s.ordem = n));
    this.avisar();
    return true;
  }

  /** Arrastar: põe a sessão antes de outra (ou no fim com null). */
  moverPara(id: string, antesDe: string | null): void {
    const ordem = this.sessoes().filter((s) => s.id !== id);
    const s = this.sessao(id);
    if (!s) return;
    const i = antesDe === null ? ordem.length : ordem.findIndex((x) => x.id === antesDe);
    ordem.splice(i < 0 ? ordem.length : i, 0, s);
    ordem.forEach((x, n) => (x.ordem = n));
    this.avisar();
  }

  /** Tira da lista uma sessão fechada. */
  esquecer(id: string): void {
    const s = this.sessao(id);
    if (!s || s.terminal) return;
    this.lista = this.lista.filter((x) => x.id !== id);
    this.avisar();
  }

  /**
   * Encerrar, pela guarda do UC20: um worktree com commit fora da principal ou
   * com arquivo solto não encerra; ganha a faixa e fica aberto. Os outros
   * recebem HUP e TERM, 3 s, e KILL (UC22). Worktree limpo sai com a branch.
   */
  async encerrar(ids: string[], o: { semGuarda?: boolean } = {}): Promise<ResultadoDoEncerrar> {
    const r: ResultadoDoEncerrar = { encerradas: [], ficaram: [] };
    const vao: SessaoDaBancada[] = [];
    const destinos = new Map<string, DestinoAoFechar>();
    for (const id of ids) {
      const s = this.sessao(id);
      if (!s?.terminal) continue;
      s.pendencia = undefined;
      if (s.worktree && !o.semGuarda) {
        const principal = (await principalDe(this.mao, s.worktree.repo)) ?? "main";
        const retrato = await retratoAoFechar(this.mao, s.worktree);
        const d = aoFechar({ ...retrato, branch: s.worktree.branch, principal });
        destinos.set(id, d);
        if (d.tipo === "perguntar") {
          s.pendencia = { tipo: "fora-da-main", frase: d.frase, commits: d.commits, principal, soltos: retrato.soltos };
          r.ficaram.push(id);
          continue;
        }
        if (d.tipo === "ficar") {
          const st = retrato;
          s.pendencia = { tipo: "sem-commit", soltos: st.soltos };
          r.ficaram.push(id);
          continue;
        }
      }
      vao.push(s);
    }
    for (const s of vao) {
      s.estado = "encerrando";
      s.estadoDesde = this.relogio();
    }
    this.avisar();
    if (vao.length) {
      const app = await this.mao.processos.doApp();
      await encerrar(
        vao.flatMap((s) => [s.terminal!, ...(s.extra ? [s.extra] : [])].map((t) => ({ pid: t.pid, inicio: t.inicio }))),
        maoDeProcessosDe(this.mao, this.esperar),
        { protegidos: await protegidosDoHost(this.mao), grupoDoApp: app.pgid, pidDoApp: app.pid },
      );
    }
    for (const s of vao) {
      s.terminal = null;
      s.extra = null;
      s.ultimaVez = this.relogio();
      s.estado = "encerrada";
      s.estadoDesde = this.relogio();
      s.pendencia = undefined;
      if (s.worktree && destinos.get(s.id)?.tipo === "apagar") await this.apagarWorktree(s.worktree);
      r.encerradas.push(s.id);
    }
    this.avisar();
    return r;
  }

  /** Worktree e branch saem; só chamado quando a guarda disse "apagar". */
  private async apagarWorktree(w: Worktree): Promise<void> {
    const s = await this.mao.git(w.repo, ["worktree", "remove", w.caminho]);
    if (s.codigo === 0) await this.mao.git(w.repo, ["branch", "-d", w.branch]);
  }

  /** "deixar" na faixa: a sessão encerra e a branch fica, para o Trabalho fora da main. */
  async encerrarDeixando(id: string): Promise<void> {
    const s = this.sessao(id);
    if (!s?.terminal) return;
    await this.encerrar([id], { semGuarda: true });
  }

  ficar(id: string): void {
    const s = this.sessao(id);
    if (!s) return;
    s.pendencia = undefined;
    this.avisar();
  }
}

export type { DestinoAoFechar };
