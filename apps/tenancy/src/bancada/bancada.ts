// O estado da Bancada: as sessões, quem está aberto e a ordem. A tela lê daqui
// e assina as mudanças; a mão do host faz o resto.
import type { MaoDoHost, PedidoDeTerminal, TerminalAberto } from "../mao/tipos";

export type Programa = "shell" | "claude" | "codex" | "agy" | "comando";

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
}

export interface PedidoDeSessao {
  programa: Programa;
  pasta: string;
  nome?: string;
  comando?: string;
  /** Opções a mais para a CLI (modelo, esforço, retomar). */
  opcoes?: string[];
  /** O ambiente a mais (o tema escolhe o COLORFGBG). */
  escuro?: boolean;
}

/** O que sai do ambiente antes da CLI subir: uma sessão do Claude dentro de outra se confunde. */
export const AMBIENTE_QUE_SAI = ["CLAUDECODE", "CLAUDE_CODE*"];
export const MARCA = "TENANCY_SESSAO";

function aspas(s: string): string {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

/** `$SHELL -l -c "exec <cli>"` na pasta, com a marca da sessão e o terminal de cores. */
export function pedidoDeTerminal(
  s: { id: string; programa: Programa; pasta: string; comando?: string; opcoes?: string[] },
  o: { shell: string; lang: string; escuro: boolean; colunas: number; linhas: number },
): PedidoDeTerminal {
  const cli = s.programa === "shell" ? null : s.programa === "comando" ? (s.comando ?? "").trim() : [s.programa, ...(s.opcoes ?? []).map(aspas)].join(" ");
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

/** O nome que a sessão ganha sem a pessoa dar um: a última parte da pasta. */
export function nomeDaPasta(pasta: string): string {
  return pasta.replace(/\/+$/, "").split("/").pop() || pasta;
}

export class Bancada {
  private lista: SessaoDaBancada[] = [];
  private ouvintes = new Set<() => void>();
  private proximo = 1;

  constructor(
    readonly mao: MaoDoHost,
    private relogio: () => number = () => Date.now(),
  ) {}

  sessoes(): SessaoDaBancada[] {
    return [...this.lista].sort((a, b) => a.ordem - b.ordem);
  }

  abertas(): SessaoDaBancada[] {
    return this.sessoes().filter((s) => s.terminal !== null);
  }

  ouvir(f: () => void): () => void {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  }

  protected avisar(): void {
    for (const f of this.ouvintes) f();
  }

  async abrir(p: PedidoDeSessao): Promise<SessaoDaBancada> {
    const agora = this.relogio();
    const id = `s${this.proximo++}`;
    const sessao: SessaoDaBancada = {
      id,
      nome: p.nome?.trim() || nomeDaPasta(p.pasta),
      nomeManual: !!p.nome?.trim(),
      pasta: p.pasta,
      programa: p.programa,
      comando: p.comando,
      criadaEm: agora,
      ultimaVez: agora,
      ordem: this.lista.length ? Math.max(...this.lista.map((s) => s.ordem)) + 1 : 0,
      terminal: null,
    };
    sessao.terminal = await this.mao.terminal.abrir(
      pedidoDeTerminal({ ...sessao, opcoes: p.opcoes }, { shell: "/bin/bash", lang: "pt_BR.UTF-8", escuro: !!p.escuro, colunas: 80, linhas: 24 }),
    );
    this.mao.terminal.aoSair(sessao.terminal.id, () => {
      sessao.terminal = null;
      this.avisar();
    });
    this.lista.push(sessao);
    this.avisar();
    return sessao;
  }
}
