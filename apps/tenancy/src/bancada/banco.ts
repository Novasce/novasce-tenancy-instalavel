// O banco das sessões, com as colunas do Mac (id, nome, pasta, programa,
// criada_em, ultima_vez, ordem, nome_manual). Na Parte E fica na memória (e no
// navegador, para o modo de ensaio); o SQLite na pasta de dados do app entra
// com a mão do caminho, na Parte F, atrás desta mesma interface.
import type { SessaoDaBancada } from "./bancada";

export interface LinhaDoBanco {
  id: string;
  nome: string;
  nomeManual: boolean;
  pasta: string;
  programa: SessaoDaBancada["programa"];
  comando?: string;
  criadaEm: number;
  ultimaVez: number;
  ordem: number;
  worktree?: SessaoDaBancada["worktree"];
}

export interface BancoDeSessoes {
  ler(): LinhaDoBanco[];
  gravar(sessoes: SessaoDaBancada[]): void;
}

export function linhaDe(s: SessaoDaBancada): LinhaDoBanco {
  const { id, nome, nomeManual, pasta, programa, comando, criadaEm, ultimaVez, ordem, worktree } = s;
  return { id, nome, nomeManual, pasta, programa, comando, criadaEm, ultimaVez, ordem, worktree };
}

export function bancoNaMemoria(inicial: LinhaDoBanco[] = []): BancoDeSessoes & { linhas: LinhaDoBanco[] } {
  const b = {
    linhas: [...inicial],
    ler: () => b.linhas.map((l) => ({ ...l })),
    gravar: (sessoes: SessaoDaBancada[]) => {
      b.linhas = sessoes.map(linhaDe);
    },
  };
  return b;
}
