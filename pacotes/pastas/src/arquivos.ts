// As mãos de arquivo do núcleo: o app passa as de verdade, os testes passam as da memória.
export interface Entrada {
  nome: string;
  pasta: boolean;
}

export interface Arquivos {
  /** As entradas diretas de uma pasta; pasta que não existe dá lista vazia. */
  listar(pasta: string): Entrada[];
  /** O texto do arquivo, ou null quando ele não existe. */
  ler(caminho: string): string | null;
  /** Arquivo ou pasta existe. */
  existe(caminho: string): boolean;
  gravar(caminho: string, texto: string): void;
  apagar(caminho: string): void;
  /** Move arquivo ou pasta; cria a pasta de destino; nunca sobrescreve (erro se o destino existe). */
  mover(origem: string, destino: string): void;
  /** O caminho com os atalhos (links simbólicos) resolvidos. */
  caminhoReal(caminho: string): string;
}

export interface OpcoesDaMemoria {
  /** Toda chamada a mover falha, para provar o caminho de volta. */
  falhaAoMover?: boolean;
}

/**
 * Arquivos na memória para os testes. Chave terminada em "/" é pasta vazia; `links` leva o
 * caminho do atalho ao caminho real.
 */
export class ArquivosNaMemoria implements Arquivos {
  private arquivos = new Map<string, string>();
  private pastasVazias = new Set<string>();

  constructor(
    inicial: Record<string, string> = {},
    private links: Record<string, string> = {},
    private opcoes: OpcoesDaMemoria = {},
  ) {
    for (const [caminho, texto] of Object.entries(inicial)) {
      if (caminho.endsWith("/")) this.pastasVazias.add(caminho.slice(0, -1));
      else this.arquivos.set(caminho, texto);
    }
  }

  todos(): Record<string, string> {
    return Object.fromEntries(this.arquivos);
  }

  listar(pasta: string): Entrada[] {
    const prefixo = pasta.replace(/\/+$/, "") + "/";
    const vistos = new Map<string, boolean>();
    for (const caminho of [...this.arquivos.keys(), ...[...this.pastasVazias].map((p) => p + "/")]) {
      if (!caminho.startsWith(prefixo)) continue;
      const resto = caminho.slice(prefixo.length);
      const barra = resto.indexOf("/");
      if (barra === 0 || resto === "") continue;
      const nome = barra < 0 ? resto : resto.slice(0, barra);
      vistos.set(nome, (vistos.get(nome) ?? false) || barra > 0);
    }
    return [...vistos].map(([nome, ehPasta]) => ({ nome, pasta: ehPasta }));
  }

  ler(caminho: string): string | null {
    return this.arquivos.get(caminho) ?? null;
  }

  existe(caminho: string): boolean {
    if (this.arquivos.has(caminho) || this.pastasVazias.has(caminho)) return true;
    const prefixo = caminho + "/";
    for (const c of this.arquivos.keys()) if (c.startsWith(prefixo)) return true;
    for (const p of this.pastasVazias) if (p.startsWith(prefixo)) return true;
    return false;
  }

  gravar(caminho: string, texto: string): void {
    this.arquivos.set(caminho, texto);
  }

  apagar(caminho: string): void {
    this.arquivos.delete(caminho);
  }

  mover(origem: string, destino: string): void {
    if (this.opcoes.falhaAoMover) throw new Error("mover falhou");
    if (!this.existe(origem)) throw new Error(`não existe: ${origem}`);
    if (this.existe(destino)) throw new Error(`já existe: ${destino}`);
    const trocar = (c: string) => (c === origem ? destino : c.startsWith(origem + "/") ? destino + c.slice(origem.length) : null);
    for (const [c, texto] of [...this.arquivos]) {
      const novo = trocar(c);
      if (novo !== null) {
        this.arquivos.delete(c);
        this.arquivos.set(novo, texto);
      }
    }
    for (const p of [...this.pastasVazias]) {
      const novo = trocar(p);
      if (novo !== null) {
        this.pastasVazias.delete(p);
        this.pastasVazias.add(novo);
      }
    }
  }

  caminhoReal(caminho: string): string {
    for (const [atalho, real] of Object.entries(this.links)) {
      if (caminho === atalho || caminho.startsWith(atalho + "/")) return real + caminho.slice(atalho.length);
    }
    return caminho;
  }
}
