// As mãos do vault no disco, por interface. O núcleo só fala com isto; nos testes, com a
// versão na memória. Caminhos absolutos, com "/" (o Windows entra pelas mãos de verdade).

export interface Arquivos {
  /** O texto do arquivo, ou nulo quando ele não existe. */
  ler(caminho: string): string | null;
  /** Grava inteiro de uma vez (atômico), criando as pastas que faltam. */
  gravar(caminho: string, texto: string): void;
  existe(caminho: string): boolean;
  ehPasta(caminho: string): boolean;
  /** Os nomes diretos dentro da pasta, em ordem. Vazio quando ela não existe. */
  listar(pasta: string): string[];
  /** Move sem sobrescrever: falha se o destino já existe, a não ser que seja o mesmo arquivo só com outra caixa. */
  mover(de: string, para: string): void;
  /** O caminho com os links simbólicos resolvidos. */
  real(caminho: string): string;
}

export function pai(caminho: string): string {
  const i = caminho.lastIndexOf("/");
  return i <= 0 ? (i === 0 ? "/" : "") : caminho.slice(0, i);
}

export function nome(caminho: string): string {
  return caminho.slice(caminho.lastIndexOf("/") + 1);
}

/** O disco de mentira: um mapa de arquivo para texto, pastas implícitas e links simbólicos de pasta. */
export class ArquivosNaMemoria implements Arquivos {
  private arquivos = new Map<string, string>();
  private readonly links: Record<string, string>;
  private readonly ignoraCaixa: boolean;

  constructor(arquivos: Record<string, string> = {}, opcoes: { links?: Record<string, string>; ignoraCaixa?: boolean } = {}) {
    for (const [c, t] of Object.entries(arquivos)) this.arquivos.set(c, t);
    this.links = opcoes.links ?? {};
    this.ignoraCaixa = opcoes.ignoraCaixa ?? false;
  }

  private chave(caminho: string): string | undefined {
    if (this.arquivos.has(caminho)) return caminho;
    if (!this.ignoraCaixa) return undefined;
    const baixo = caminho.toLowerCase();
    for (const k of this.arquivos.keys()) if (k.toLowerCase() === baixo) return k;
    return undefined;
  }

  private igual(a: string, b: string): boolean {
    return this.ignoraCaixa ? a.toLowerCase() === b.toLowerCase() : a === b;
  }

  private prefixo(a: string, b: string): boolean {
    return this.ignoraCaixa ? a.toLowerCase().startsWith(b.toLowerCase()) : a.startsWith(b);
  }

  ler(caminho: string): string | null {
    const k = this.chave(caminho);
    return k === undefined ? null : (this.arquivos.get(k) ?? null);
  }

  gravar(caminho: string, texto: string): void {
    this.arquivos.set(this.chave(caminho) ?? caminho, texto);
  }

  existe(caminho: string): boolean {
    return this.chave(caminho) !== undefined || this.ehPasta(caminho);
  }

  ehPasta(caminho: string): boolean {
    const p = caminho.endsWith("/") ? caminho : caminho + "/";
    for (const k of this.arquivos.keys()) if (this.prefixo(k, p)) return true;
    return false;
  }

  listar(pasta: string): string[] {
    const p = pasta.endsWith("/") ? pasta : pasta + "/";
    const nomes = new Set<string>();
    for (const k of this.arquivos.keys()) {
      if (k.startsWith(p)) nomes.add(k.slice(p.length).split("/")[0]);
    }
    return [...nomes].sort();
  }

  mover(de: string, para: string): void {
    const soACaixa = this.igual(de, para);
    if (!soACaixa && this.existe(para)) throw new Error(`já existe: ${para}`);
    const arquivo = this.chave(de);
    if (arquivo !== undefined) {
      const texto = this.arquivos.get(arquivo)!;
      this.arquivos.delete(arquivo);
      this.arquivos.set(para, texto);
      return;
    }
    if (!this.ehPasta(de)) throw new Error(`não existe: ${de}`);
    for (const k of [...this.arquivos.keys()]) {
      if (this.prefixo(k, de + "/")) {
        const texto = this.arquivos.get(k)!;
        this.arquivos.delete(k);
        this.arquivos.set(para + k.slice(de.length), texto);
      }
    }
  }

  real(caminho: string): string {
    for (const [link, alvo] of Object.entries(this.links)) {
      if (caminho === link || caminho.startsWith(link + "/")) return alvo + caminho.slice(link.length);
    }
    return caminho;
  }

  /** Tudo o que está no disco, para os testes compararem. */
  tudo(): Record<string, string> {
    return Object.fromEntries([...this.arquivos.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}
