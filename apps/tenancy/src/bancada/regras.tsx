// Persona e regras (UC48): as regras "Sempre" moram na configuração da própria
// CLI (`.claude/settings.local.json`, `permissions.allow`), por pasta. Ajustes
// lista e revogar tira na origem.
import { useState } from "react";
import { nomeDaPasta, type Bancada } from "./bancada";
import { useBancada } from "../casca/usar";

export const ARQUIVO_DE_REGRAS = ".claude/settings.local.json";

export interface Regra {
  regra: string;
  pasta: string;
}

function lerJson(texto: string | null): { permissions?: { allow?: unknown } } | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** A pasta da casa e a de cada sessão aberta, sem repetir. */
export function pastasDasRegras(bancada: Bancada): string[] {
  return [...new Set([bancada.mao.arquivos.brain(), ...bancada.abertas().map((s) => s.pasta)])];
}

export function lerRegras(bancada: Bancada): Regra[] {
  const arquivos = bancada.mao.arquivos.arquivos();
  const regras: Regra[] = [];
  for (const pasta of pastasDasRegras(bancada)) {
    const allow = lerJson(arquivos.ler(`${pasta}/${ARQUIVO_DE_REGRAS}`))?.permissions?.allow;
    if (Array.isArray(allow)) for (const r of allow) if (typeof r === "string") regras.push({ regra: r, pasta });
  }
  return regras;
}

/** Tira a regra do arquivo. Devolve false quando o arquivo mudou ou não está lá. */
export function revogar(bancada: Bancada, r: Regra): boolean {
  const arquivos = bancada.mao.arquivos.arquivos();
  const caminho = `${r.pasta}/${ARQUIVO_DE_REGRAS}`;
  const json = lerJson(arquivos.ler(caminho));
  const allow = json?.permissions?.allow;
  if (!json || !Array.isArray(allow) || !allow.includes(r.regra)) return false;
  json.permissions!.allow = allow.filter((x) => x !== r.regra);
  arquivos.gravar(caminho, JSON.stringify(json, null, 2) + "\n");
  return true;
}

export function RegrasSempre({ bancada }: { bancada: Bancada }) {
  useBancada(bancada);
  const [, mudou] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const regras = lerRegras(bancada);
  const home = bancada.mao.arquivos.home();
  return (
    <section className="grupo regras">
      <h2>O que faz sem perguntar · {regras.length}</h2>
      <p className="explica">As regras moram na configuração da própria CLI: valem dentro e fora do app, e nunca para qualquer comando.</p>
      {regras.length === 0 ? (
        <p className="explica">Nada ainda: o degrau de fazer sem perguntar nasce vazio.</p>
      ) : (
        <ul className="lista-de-regras">
          {regras.map((r) => (
            <li key={`${r.pasta}|${r.regra}`} className="linha-de-regra">
              <code>{r.regra}</code>
              <span className="explica">{nomeDaPasta(r.pasta, home)}</span>
              <span className="mono explica">{ARQUIVO_DE_REGRAS}</span>
              <button
                type="button"
                className="link perigo-texto"
                aria-label={`Revogar ${r.regra}`}
                onClick={() => {
                  setErro(revogar(bancada, r) ? null : "Não revogou: o arquivo de regras mudou ou não está lá.");
                  mudou((n) => n + 1);
                }}
              >
                Revogar
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="aviso-reservado-curto" aria-live="polite">
        {erro ?? ""}
      </p>
    </section>
  );
}
