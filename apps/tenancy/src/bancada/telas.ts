// Os terminais da tela, um por painel aberto, vivos enquanto a sessão vive
// (trocar de página não perde o que já foi desenhado). Ligam a mão do host ao
// xterm e a vigia de cada sessão de agente à Bancada.
import type { Pedido } from "@novasce/sessoes";
import { lerPedido } from "@novasce/sessoes";
import type { Bancada, EstadoDaSessao, SessaoDaBancada } from "./bancada";
import { ultimasLinhas } from "./tela";
import type { CriarTerminal, TerminalDaTela } from "./terminal";
import { Vigia } from "./vigia";

interface Painel {
  sessao: string;
  termo: TerminalDaTela;
  vigia: Vigia | null;
  desligar: () => void;
}

const AGENTES = new Set(["claude", "codex", "agy"]);

export class Telas {
  private paineis = new Map<string, Painel>();
  /** O pedido lido na última volta, por sessão: a tecla só vai se a tela ainda for a mesma. */
  readonly pedidos = new Map<string, Pedido>();
  private ouvintes = new Set<() => void>();

  constructor(
    private bancada: Bancada,
    private criar: CriarTerminal,
    private escuro: () => boolean,
  ) {
    bancada.ouvir(() => this.sincronizar());
    this.sincronizar();
  }

  ouvir(f: () => void): () => void {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  }

  private avisar() {
    for (const f of this.ouvintes) f();
  }

  painel(terminalId: string): TerminalDaTela | null {
    return this.paineis.get(terminalId)?.termo ?? null;
  }

  /** Cria o terminal de cada painel novo e solta os que fecharam. */
  sincronizar(): void {
    const vivos = new Set<string>();
    for (const s of this.bancada.sessoes()) {
      if (s.terminal) {
        vivos.add(s.terminal.id);
        if (!this.paineis.has(s.terminal.id)) this.ligar(s, s.terminal.id, AGENTES.has(s.programa));
      }
      if (s.extra) {
        vivos.add(s.extra.id);
        if (!this.paineis.has(s.extra.id)) this.ligar(s, s.extra.id, false);
      }
    }
    for (const [id, p] of this.paineis) {
      if (vivos.has(id)) continue;
      p.desligar();
      p.termo.dispose();
      this.paineis.delete(id);
    }
  }

  private ligar(s: SessaoDaBancada, terminalId: string, agente: boolean): void {
    const mao = this.bancada.mao;
    const termo = this.criar({ escuro: this.escuro() });
    const vigia = agente ? new Vigia(termo, this.bancada.agora(), true) : null;
    const fora = mao.terminal.aoReceber(terminalId, (dados) => termo.write(dados));
    const dentro = termo.onData((dados) => void mao.terminal.escrever(terminalId, dados).catch(() => {}));
    const sino = termo.onBell(() => vigia?.campainha(this.bancada.agora()));
    this.paineis.set(terminalId, {
      sessao: s.id,
      termo,
      vigia,
      desligar: () => {
        fora();
        dentro.dispose();
        sino.dispose();
      },
    });
  }

  /** Uma volta da leitura (a cada 2 s): estado de cada sessão de agente. */
  ler(ativa: string | null): void {
    const agora = this.bancada.agora();
    this.bancada.carimbar();
    for (const p of this.paineis.values()) {
      if (!p.vigia) continue;
      const s = this.bancada.sessao(p.sessao);
      if (!s?.terminal || s.estado === "encerrando") continue;
      if (p.sessao === ativa) p.vigia.vista(agora);
      const l = p.vigia.ler(agora, 0);
      if (l.pedido && l.estado.estado === "pediu-permissao") this.pedidos.set(s.id, l.pedido);
      else this.pedidos.delete(s.id);
      this.bancada.mudarEstado(s.id, l.estado.estado as EstadoDaSessao);
    }
    this.avisar();
  }

  /**
   * Responde ao pedido com a tecla da CLI, só se a pergunta na tela ainda é a
   * mesma que a pessoa leu. Devolve false quando a pergunta mudou.
   */
  async responder(sessao: string, tecla: string): Promise<boolean> {
    const s = this.bancada.sessao(sessao);
    const lido = this.pedidos.get(sessao);
    if (!s?.terminal || !lido) return false;
    const termo = this.painel(s.terminal.id);
    const agora = termo ? lerPedido(ultimasLinhas(termo)) : null;
    if (!agora || agora.assinatura !== lido.assinatura) return false;
    await this.bancada.mao.terminal.escrever(s.terminal.id, tecla);
    this.pedidos.delete(sessao);
    this.avisar();
    return true;
  }

  /** Digitar para a sessão só com a caixa vazia, como o Mac. */
  async digitar(sessao: string, texto: string): Promise<boolean> {
    const s = this.bancada.sessao(sessao);
    const p = s?.terminal ? this.paineis.get(s.terminal.id) : undefined;
    if (!s?.terminal || !p?.vigia) return false;
    const l = p.vigia.ler(this.bancada.agora(), 0);
    if (!l.leitura.promptLivre) return false;
    await this.bancada.mao.terminal.escrever(s.terminal.id, texto);
    return true;
  }
}
