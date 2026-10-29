// A vigia da sessão (UC17): lembra quando a tela mudou, quando foi vista, a
// campainha e o rodapé, e a cada leitura diz o estado pelo pacote sessoes.
import { estadoDaTela, lerPedido, lerTela, type Estado, type LeituraDaTela, type MemoriaDaAba, type Pedido } from "@novasce/sessoes";
import { ultimasLinhas, type BufferDeTerminal } from "./tela";

export interface Leitura {
  texto: string;
  leitura: LeituraDaTela;
  estado: Estado;
  pedido: Pedido | null;
}

export class Vigia {
  private memoria: MemoriaDaAba;
  private ultimoTexto = "";
  ultima: Leitura | null = null;

  constructor(
    private termo: BufferDeTerminal,
    abertaEm: number,
    private agente: boolean,
  ) {
    this.memoria = { mudouEm: abertaEm, vistaEm: abertaEm, abertaEm: agente ? abertaEm : null, prontaEm: agente ? null : abertaEm };
  }

  campainha(agora: number): void {
    this.memoria.campainhaEm = agora;
  }

  /** A pessoa olhou a sessão: "terminou" e "parada" saem. */
  vista(agora: number): void {
    this.memoria.vistaEm = agora;
  }

  ler(agora: number, cpu: number): Leitura {
    const texto = ultimasLinhas(this.termo);
    if (texto !== this.ultimoTexto) {
      this.ultimoTexto = texto;
      this.memoria.mudouEm = agora;
    }
    const leitura = lerTela(texto);
    if (this.memoria.prontaEm == null && (leitura.promptLivre || leitura.rodape !== "nenhum")) this.memoria.prontaEm = agora;
    if (leitura.rodape === "trabalhando") this.memoria.trabalhouEm = agora;
    const estado = this.agente ? estadoDaTela(leitura, this.memoria, cpu, agora) : ({ estado: "livre" } as Estado);
    this.ultima = { texto, leitura, estado, pedido: this.agente ? lerPedido(texto) : null };
    return this.ultima;
  }
}

/** Colar grande pede confirmação: mais de 50 linhas ou mais de 10 KB. */
export function colarPergunta(texto: string): string | null {
  const linhas = texto.replace(/\n$/, "").split("\n").length;
  const bytes = new TextEncoder().encode(texto).length;
  if (linhas <= 50 && bytes <= 10 * 1024) return null;
  return `colar ${linhas.toLocaleString("pt-BR")} linhas?`;
}
