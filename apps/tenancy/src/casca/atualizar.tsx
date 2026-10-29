// Atualizar sem fechar (UC50): a tela de impacto antes de reabrir. O app
// aberto nunca fecha sozinho; quem dispara depende do caminho (Parte F).
import type { Bancada } from "../bancada/bancada";
import { nomeDaPasta } from "../bancada/bancada";
import { temGit } from "../bancada/repos";

export interface Impacto {
  sessoes: number;
  /** As pastas das sessões abertas com mudança que o git ainda não gravou. */
  naoGravado: string[];
  /** Caminho da imagem do sistema: vale depois de reiniciar o computador. */
  aoReiniciar: boolean;
}

export async function impactoDaAtualizacao(bancada: Bancada, aoReiniciar: boolean): Promise<Impacto> {
  const abertas = bancada.abertas();
  const naoGravado: string[] = [];
  const home = bancada.mao.arquivos.home();
  for (const pasta of new Set(abertas.map((s) => s.pasta))) {
    if (!(await temGit(bancada.mao, pasta))) continue;
    const st = await bancada.mao.git(pasta, ["status", "--porcelain"]);
    if (st.codigo === 0 && st.saida.trim()) naoGravado.push(nomeDaPasta(pasta, home));
  }
  return { sessoes: abertas.length, naoGravado, aoReiniciar };
}

export function textoDoImpacto(i: Impacto): { titulo: string; texto: string } {
  if (i.aoReiniciar) return { titulo: "A versão nova vale quando o computador reiniciar.", texto: "O app aberto continua como está até lá." };
  const sessoes = i.sessoes === 0 ? "Reabrir não encerra nenhuma sessão." : i.sessoes === 1 ? "Reabrir encerra 1 sessão." : `Reabrir encerra ${i.sessoes} sessões.`;
  const texto = i.naoGravado.length ? `Mudança não gravada em ${i.naoGravado.join(", ")}.` : "Nada fica sem gravar.";
  return { titulo: `Há uma versão nova pronta. ${sessoes}`, texto };
}

export function FaixaDeAtualizar(p: { impacto: Impacto; depois: () => void; reabrir: () => void }) {
  const t = textoDoImpacto(p.impacto);
  return (
    <div className="faixa-do-pe acento" data-regiao="atualizar">
      <div className="textos">
        <strong>{t.titulo}</strong>
        <span className="explica">{t.texto}</span>
      </div>
      <button type="button" className="secundario" onClick={p.depois}>
        Depois
      </button>
      {p.impacto.aoReiniciar ? null : (
        <button type="button" className="primario" onClick={p.reabrir}>
          Encerrar e reabrir
        </button>
      )}
    </div>
  );
}
