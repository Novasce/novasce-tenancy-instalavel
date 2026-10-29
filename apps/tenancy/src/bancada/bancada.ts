// O estado da Bancada: as sessões, quem está aberto e a ordem. A tela lê daqui
// e assina as mudanças; a mão do host faz o resto.
import { aoFechar, encerrar, type DestinoAoFechar } from "@novasce/sessoes";
import type { MaoDoHost, PedidoDeTerminal, TerminalAberto } from "../mao/tipos";
import { bancoNaMemoria, type BancoDeSessoes } from "./banco";
import { maoDeProcessosDe, protegidosDoHost } from "./processos";
import { retratoAoFechar } from "./repos";

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
  | { tipo: "fora-da-main"; frase: string; commits: number }
  | { tipo: "sem-commit"; soltos: number };

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
  /** A última fala da pessoa, para o nome automático. */
  ultimaFala?: string;
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
    args: cli ? ["-l", "-c", `exec ${cli}`] : ["-l"],
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
  if (home && limpa === home.replace(/\/+$/, "")) return "~";
  const partes = limpa.split("/").filter(Boolean);
  return partes.slice(-2).join("/") || pasta;
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
    await this.subir(sessao, p);
    return sessao;
  }

  /** Abre de novo uma sessão fechada, na mesma pasta e com o mesmo programa. */
  async reabrir(id: string, opcoes?: string[]): Promise<void> {
    const s = this.sessao(id);
    if (!s || s.terminal) return;
    s.estado = s.programa === "shell" || s.programa === "comando" ? "terminal" : "abrindo";
    s.estadoDesde = this.relogio();
    s.codigoDeSaida = undefined;
    await this.subir(s, { programa: s.programa, pasta: s.pasta, comando: s.comando, opcoes });
  }

  private async subir(sessao: SessaoDaBancada, p: PedidoDeSessao): Promise<void> {
    sessao.terminal = await this.mao.terminal.abrir(
      pedidoDeTerminal({ ...sessao, opcoes: p.opcoes }, { shell: "/bin/bash", lang: "pt_BR.UTF-8", escuro: !!p.escuro, colunas: 80, linhas: 24 }),
    );
    sessao.ultimaVez = this.relogio();
    const desligar = this.mao.terminal.aoSair(sessao.terminal.id, (codigo) => {
      desligar();
      sessao.terminal = null;
      sessao.codigoDeSaida = codigo;
      sessao.estado = "encerrada";
      sessao.estadoDesde = this.relogio();
      this.avisar();
    });
    this.avisar();
  }

  renomear(id: string, nome: string): void {
    const s = this.sessao(id);
    if (!s) return;
    const limpo = nome.trim();
    s.nome = limpo || nomeDaPasta(s.pasta, this.mao.arquivos.home());
    s.nomeManual = !!limpo;
    this.avisar();
  }

  /** O nome automático pela última fala; nunca por cima de um nome dado pela pessoa. */
  nomeAutomatico(id: string, fala: string): void {
    const s = this.sessao(id);
    if (!s || s.nomeManual) return;
    const curto = fala.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!curto) return;
    s.ultimaFala = fala;
    s.nome = curto;
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
  async encerrar(ids: string[]): Promise<ResultadoDoEncerrar> {
    const r: ResultadoDoEncerrar = { encerradas: [], ficaram: [] };
    const vao: SessaoDaBancada[] = [];
    const destinos = new Map<string, DestinoAoFechar>();
    for (const id of ids) {
      const s = this.sessao(id);
      if (!s?.terminal) continue;
      if (s.worktree) {
        const d = aoFechar({ ...(await retratoAoFechar(this.mao, s.worktree)), branch: s.worktree.branch });
        destinos.set(id, d);
        if (d.tipo === "perguntar") {
          s.pendencia = { tipo: "fora-da-main", frase: d.frase, commits: d.commits };
          r.ficaram.push(id);
          continue;
        }
        if (d.tipo === "ficar") {
          const st = await retratoAoFechar(this.mao, s.worktree);
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
        vao.map((s) => ({ pid: s.terminal!.pid, inicio: s.terminal!.inicio })),
        maoDeProcessosDe(this.mao, this.esperar),
        { protegidos: await protegidosDoHost(this.mao), grupoDoApp: app.pgid, pidDoApp: app.pid },
      );
    }
    for (const s of vao) {
      s.terminal = null;
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
    const w = s.worktree;
    s.worktree = undefined;
    s.pendencia = undefined;
    await this.encerrar([id]);
    s.worktree = w;
  }

  ficar(id: string): void {
    const s = this.sessao(id);
    if (!s) return;
    s.pendencia = undefined;
    this.avisar();
  }
}

export type { DestinoAoFechar };
