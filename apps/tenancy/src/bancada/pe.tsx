// O pé da janela: recado das ações, órfãos de uma abertura anterior e a
// pergunta de sair com agentes abertos (UC22). Uma faixa por vez, por cima.
import { encerrar, linhaDoOrfao, mb as formatarMb, type Orfao } from "@novasce/sessoes";
import type { Bancada } from "./bancada";
import { NOME_DO_PROGRAMA } from "./guardas";
import { maoDeProcessosDe, protegidosDoHost } from "./processos";

function lista(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** "Sair encerra 3 agentes: 2 Claude e 1 Codex.", ou null sem agente aberto. */
export function perguntaDeSair(bancada: Bancada): string | null {
  const agentes = bancada.abertas().filter((s) => NOME_DO_PROGRAMA[s.programa]);
  if (!agentes.length) return null;
  if (agentes.length === 1) return `Sair encerra o ${NOME_DO_PROGRAMA[agentes[0].programa]} que está aberto.`;
  const contagem = new Map<string, number>();
  for (const s of agentes) contagem.set(NOME_DO_PROGRAMA[s.programa], (contagem.get(NOME_DO_PROGRAMA[s.programa]) ?? 0) + 1);
  return `Sair encerra ${agentes.length} agentes: ${lista([...contagem].map(([nome, n]) => `${n} ${nome}`))}.`;
}

export function FaixaDeSair(p: { texto: string; ficar: () => void; sair: () => void }) {
  return (
    <div className="faixa-do-pe" data-regiao="sair">
      <div className="textos">
        <strong>{p.texto}</strong>
        <span className="explica">Encerrar leva a sessão inteira de cada aba: a IA, os servidores dela e o shell.</span>
      </div>
      <button type="button" className="secundario" onClick={p.ficar}>
        Ficar
      </button>
      <button type="button" className="primario" onClick={p.sair}>
        Encerrar e sair
      </button>
    </div>
  );
}

export function tituloDosOrfaos(orfaos: Orfao[]): string {
  const programas = orfaos.some((o) => o.rotulo === "node" || o.rotulo === "npm exec");
  const quem = programas
    ? orfaos.length === 1
      ? "1 programa segue"
      : `${orfaos.length} programas seguem`
    : orfaos.length === 1
      ? "1 sessão segue"
      : `${orfaos.length} sessões seguem`;
  const contagem = new Map<string, number>();
  for (const o of orfaos) contagem.set(o.rotulo, (contagem.get(o.rotulo) ?? 0) + 1);
  const total = orfaos.reduce((t, o) => t + o.processos.reduce((x, y) => x + (y.mb ?? 0), 0), 0);
  return `${quem} rodando sem aba, de uma abertura anterior do app: ${lista([...contagem].map(([r, n]) => `${n} ${r}`))}, cerca de ${formatarMb(total)}.`;
}

export function FaixaDosOrfaos(p: { bancada: Bancada; orfaos: Orfao[]; mudar: (o: Orfao[]) => void }) {
  const node = p.orfaos.some((o) => o.rotulo === "node" || o.rotulo === "npm exec");
  const encerrarEstes = async (alvo: Orfao[]) => {
    const mao = p.bancada.mao;
    const app = await mao.processos.doApp();
    await encerrar(
      alvo.map((o) => ({ pid: o.raiz, inicio: o.inicio })),
      maoDeProcessosDe(mao),
      { protegidos: await protegidosDoHost(mao), grupoDoApp: app.pgid, pidDoApp: app.pid },
    );
    p.mudar(p.orfaos.filter((o) => !alvo.includes(o)));
  };
  return (
    <div className="pe-dos-orfaos" data-regiao="orfaos">
      {p.orfaos.length > 1 ? (
        <ul className="linhas-dos-orfaos">
          {p.orfaos.map((o) => (
            <li key={`${o.raiz}@${o.inicio}`}>
              <span className="mono">{linhaDoOrfao(o, p.bancada.agora())}</span>
              <button type="button" className="secundario" onClick={() => p.mudar(p.orfaos.filter((x) => x !== o))}>
                Deixar
              </button>
              <button type="button" className="secundario perigo" onClick={() => void encerrarEstes([o])}>
                Encerrar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="faixa-do-pe">
        <div className="textos">
          <strong>{tituloDosOrfaos(p.orfaos)}</strong>
          <span className="explica">
            {node
              ? "Um node pode ser um servidor seu, deixado de propósito: confira o que ele roda. Encerrar leva cada um inteiro; deixar não mexe em nada."
              : "Nenhuma aba mostra essas sessões. Encerrar leva cada uma inteira; deixar não mexe em nada."}
          </span>
        </div>
        <button type="button" className="secundario" onClick={() => p.mudar([])}>
          {p.orfaos.length === 1 ? "Deixar" : "Deixar todos"}
        </button>
        <button type="button" className="primario" onClick={() => void encerrarEstes(p.orfaos)}>
          {p.orfaos.length === 1 ? "Encerrar" : "Encerrar todos"}
        </button>
      </div>
    </div>
  );
}

export function Recado({ bancada }: { bancada: Bancada }) {
  const r = bancada.recadoAtual;
  return (
    <div className={r?.erro ? "recado erro" : "recado"} aria-live="polite">
      {r ? (
        <span data-regiao="recado">
          {r.texto}
          {r.erro ? (
            <button type="button" className="link" onClick={() => bancada.limparRecado()}>
              Entendi
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
