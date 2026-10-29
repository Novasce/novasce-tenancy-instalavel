// A mão do host: tudo o que a tela pede fora dela (terminal, processos, git,
// cofre, arquivos e as CLIs). É igual nos três caminhos da spec 8.2; muda só a
// implementação (Parte F). A de ensaio, com dados fictícios, é a do CI.
import type { Arquivos, RespostaDaAjuda } from "@novasce/pastas";
import type { Processo, Sinal } from "@novasce/sessoes";

export interface PedidoDeTerminal {
  /** O programa e os argumentos, já montados (por exemplo `$SHELL -l -c "exec claude"`). */
  programa: string;
  args: string[];
  pasta: string;
  /** O que entra no ambiente, além do que o host já tem. */
  ambiente: Record<string, string>;
  /** Nomes (ou prefixos terminados em `*`) que saem do ambiente. */
  tirar: string[];
  colunas: number;
  linhas: number;
}

export interface TerminalAberto {
  id: string;
  /** O processo que a mão subiu, com o início, para nunca sinalizar um pid reaproveitado. */
  pid: number;
  inicio: string;
}

export interface MaoDeTerminal {
  abrir(p: PedidoDeTerminal): Promise<TerminalAberto>;
  escrever(id: string, dados: string): Promise<void>;
  redimensionar(id: string, colunas: number, linhas: number): Promise<void>;
  /** O fluxo de saída. Devolve a função que desliga. */
  aoReceber(id: string, f: (dados: string) => void): () => void;
  /** A saída do processo, com o código. Devolve a função que desliga. */
  aoSair(id: string, f: (codigo: number) => void): () => void;
}

export interface MaoDeProcessosDoHost {
  /** A tabela do host: pid, ppid, pgid, sid, início, argv, marca e memória. */
  tabela(): Promise<Processo[]>;
  /** Sinal para uma lista de processos; quem tem início diferente (pid reaproveitado) não recebe. */
  sinal(alvos: { pid: number; inicio: string }[], sinal: Sinal): Promise<void>;
  /** Sinal ao grupo inteiro (o líder confere o início). */
  sinalAoGrupo(lider: { pid: number; inicio: string }, sinal: Sinal): Promise<void>;
  /** O pid e o grupo do próprio app, para nunca entrar nos alvos. */
  doApp(): Promise<{ pid: number; pgid: number }>;
}

export interface SaidaDoGit {
  codigo: number;
  saida: string;
  erro: string;
}

export type TrocaDoLogin =
  | { codigo: string; validoAte: string }
  | { falha: "sem-login" | "sessao-vencida" | "sem-rede" | "recusado" };

export interface MaoDoCofre {
  /** Existe o login do OS. Só presença, nunca o valor. */
  temLogin(): Promise<boolean>;
  /**
   * Troca o token do OS por um código de uso único e curto (decisão 8). O token
   * é lido e enviado do lado do host; a tela só recebe o código.
   */
  trocar(): Promise<TrocaDoLogin>;
}

export interface MaoDeArquivos {
  home(): string;
  /** O brain da pessoa (a herança do OS diz onde). */
  brain(): string;
  /** Os repos com `.git` dentro do brain (`repos/`). */
  repos(): Promise<string[]>;
  /** As pastas abertas por último, mais recentes primeiro. */
  recentes(): Promise<string[]>;
  /** As mãos de arquivo do pacote `pastas`, para ler e mover em `continuar/`. */
  arquivos(): Arquivos;
  /** As pastas dos espaços registrados, que também têm `continuar/`. */
  espacos(): string[];
}

export interface MaoDasClis {
  /** O shell de login da pessoa (`$SHELL`). */
  shell(): string;
  /** `<cli> --version`, com prazo de 5 s. */
  versao(cli: string): Promise<RespostaDaAjuda>;
  /** `<cli> --help`, com prazo de 5 s. */
  ajuda(cli: string): Promise<RespostaDaAjuda>;
}

export interface MaoDoHost {
  /** Qual mão é: "ensaio", ou o caminho da Parte F. */
  readonly tipo: "ensaio" | "flatpak" | "ajudante" | "direta";
  terminal: MaoDeTerminal;
  processos: MaoDeProcessosDoHost;
  git(pasta: string, args: string[]): Promise<SaidaDoGit>;
  cofre: MaoDoCofre;
  arquivos: MaoDeArquivos;
  cli: MaoDasClis;
  /** Abre um endereço no navegador do sistema (o PR, um link de fora). */
  abrirNoNavegador(url: string): Promise<void>;
  /** Põe o texto na área de transferência. */
  copiar(texto: string): Promise<void>;
  /** Fecha o app, depois que a pessoa disse "Encerrar e sair". */
  sair(): Promise<void>;
}
