// Ajustes: modo avançado (IN04) e tema. Desligar com sessão aberta avisa e só
// esconde a Bancada; nenhuma sessão é encerrada.
import { useState } from "react";
import type { Bancada } from "../bancada/bancada";
import type { Escolhas, Tema } from "./preferencias";
import { useBancada } from "./usar";

const TEMAS: { id: Tema; rotulo: string }[] = [
  { id: "claro", rotulo: "Claro" },
  { id: "escuro", rotulo: "Escuro" },
  { id: "sistema", rotulo: "Sistema" },
];

export function avisoAoDesligar(abertas: number): string | null {
  if (abertas === 0) return null;
  return abertas === 1
    ? "1 sessão continua aberta. A Bancada só sai da lateral; ligue o modo avançado de novo para voltar a ela."
    : `${abertas} sessões continuam abertas. A Bancada só sai da lateral; ligue o modo avançado de novo para voltar a elas.`;
}

export function Ajustes(p: { escolhas: Escolhas; mudar: (e: Escolhas) => void; bancada: Bancada; regras?: React.ReactNode }) {
  useBancada(p.bancada);
  const [aviso, setAviso] = useState<string | null>(null);
  const alternar = () => {
    if (!p.escolhas.modoAvancado) {
      setAviso(null);
      p.mudar({ ...p.escolhas, modoAvancado: true });
      return;
    }
    const texto = avisoAoDesligar(p.bancada.abertas().length);
    if (texto) setAviso(texto);
    else p.mudar({ ...p.escolhas, modoAvancado: false });
  };
  return (
    <div className="pagina ajustes" data-pagina="ajustes">
      <h1>Ajustes</h1>
      <section className="grupo">
        <h2>Aparência</h2>
        <div className="segmentado" role="group" aria-label="Tema">
          {TEMAS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={p.escolhas.tema === t.id ? "chip ativo" : "chip"}
              aria-pressed={p.escolhas.tema === t.id}
              onClick={() => p.mudar({ ...p.escolhas, tema: t.id })}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
      </section>
      <section className="grupo">
        <h2>Bancada</h2>
        <button type="button" role="switch" className="interruptor" aria-checked={p.escolhas.modoAvancado} onClick={alternar}>
          <span className="interruptor-trilho" aria-hidden="true" />
          Modo avançado
        </button>
        <p className="explica">Mostra a Bancada, com as sessões de Claude Code, Codex e agy.</p>
        <div className="aviso-reservado" aria-live="polite">
          {aviso ? (
            <div className="aviso">
              <p>{aviso}</p>
              <div className="botoes">
                <button
                  type="button"
                  className="primario"
                  onClick={() => {
                    setAviso(null);
                    p.mudar({ ...p.escolhas, modoAvancado: false });
                  }}
                >
                  Esconder a Bancada
                </button>
                <button type="button" className="secundario" onClick={() => setAviso(null)}>
                  Manter
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {p.regras}
    </div>
  );
}
