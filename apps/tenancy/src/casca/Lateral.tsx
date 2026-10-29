// A lateral, igual à do Mac (228 px): espaço, navegação, as sessões (só com o
// modo avançado), a conta e Ajustes. Nenhum item de fatia futura aparece.
import type { Bancada } from "../bancada/bancada";
import { useBancada } from "./usar";

export type Pagina = "agentes" | "bancada" | "ajustes" | "para-continuar" | "fora-da-main" | "nova-sessao";

export const LARGURA_DA_LATERAL = 228;

export function Lateral(p: {
  pagina: Pagina;
  ir: (pagina: Pagina) => void;
  modoAvancado: boolean;
  bancada: Bancada;
  espaco: string;
  conta: string;
  sessoes?: React.ReactNode;
}) {
  useBancada(p.bancada);
  const item = (pagina: Pagina, rotulo: string) => (
    <button
      type="button"
      className={p.pagina === pagina ? "nav ativo" : "nav"}
      aria-current={p.pagina === pagina ? "page" : undefined}
      onClick={() => p.ir(pagina)}
    >
      {rotulo}
    </button>
  );
  return (
    <aside className="lateral" data-regiao="lateral" data-largura={LARGURA_DA_LATERAL}>
      <div className="espaco" title="Espaço">
        <span className="espaco-nome">{p.espaco}</span>
      </div>
      <nav className="navegacao" data-regiao="navegacao" aria-label="Navegação">
        {item("agentes", "Agentes")}
        {p.modoAvancado ? item("bancada", "Bancada") : null}
        {item("ajustes", "Ajustes")}
      </nav>
      {p.modoAvancado ? (
        <section className="sessoes" data-regiao="sessoes" aria-label="Sessões">
          <h2 className="titulo-de-bloco">SESSÕES</h2>
          {item("para-continuar", "Para continuar")}
          {item("fora-da-main", "Trabalho fora da main")}
          <div className="lista-de-sessoes">{p.sessoes}</div>
          <button type="button" className="nova-sessao" onClick={() => p.ir("nova-sessao")}>
            Nova sessão
          </button>
        </section>
      ) : (
        <div className="sessoes-vazio" />
      )}
      <footer className="pe-da-lateral">
        <span className="conta" title="Conta">
          {p.conta}
        </span>
      </footer>
    </aside>
  );
}
