// A mão de processos do pacote sessoes sobre a mão do host: o sinal sempre leva
// o início do processo, para um pid reaproveitado nunca receber.
import { protegidos, type MaoDeProcessos, type Processo } from "@novasce/sessoes";
import type { MaoDoHost } from "../mao/tipos";

export function maoDeProcessosDe(mao: MaoDoHost, esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): MaoDeProcessos {
  let ultima: Processo[] = [];
  const inicioDe = (pid: number) => ultima.find((p) => p.pid === pid)?.inicio;
  return {
    async tabela() {
      ultima = await mao.processos.tabela();
      return ultima;
    },
    async sinalAoGrupo(grupo, sinal) {
      const inicio = inicioDe(grupo);
      if (inicio !== undefined) await mao.processos.sinalAoGrupo({ pid: grupo, inicio }, sinal);
    },
    async sinalAoPid(pid, sinal) {
      const inicio = inicioDe(pid);
      if (inicio !== undefined) await mao.processos.sinal([{ pid, inicio }], sinal);
    },
    esperar,
  };
}

/** O app e os pais dele, lidos do host. */
export async function protegidosDoHost(mao: MaoDoHost): Promise<Set<number>> {
  const app = await mao.processos.doApp();
  return protegidos(app.pid, await mao.processos.tabela());
}
