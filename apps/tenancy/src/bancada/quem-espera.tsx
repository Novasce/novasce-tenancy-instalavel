// Sua vez (UC19): a faixa no alto da Bancada e a coluna Quem espera, fila única.
import { podeSempre, TECLAS_DO_PEDIDO } from "@novasce/sessoes";
import { useEffect, useState } from "react";
import { esperaVoce, type Bancada, type SessaoDaBancada } from "./bancada";
import { detalheDaSessao } from "./lista/ListaDeSessoes";
import { Ponto } from "./Ponto";
import type { Telas } from "./telas";

const PRIORIDADE: Record<string, number> = { "pediu-permissao": 0, terminou: 1, "sem-resposta": 2 };

/** Quem espera, na ordem: pediu permissão, terminou; empate, o mais antigo primeiro. */
export function filaDaSuaVez(bancada: Bancada): SessaoDaBancada[] {
  return bancada
    .sessoes()
    .filter(esperaVoce)
    .sort((a, b) => (PRIORIDADE[a.estado] ?? 9) - (PRIORIDADE[b.estado] ?? 9) || a.estadoDesde - b.estadoDesde);
}

export function FaixaDaSuaVez(p: { bancada: Bancada; telas: Telas; ativa: string | null; ir: (id: string) => void }) {
  const fila = filaDaSuaVez(p.bancada);
  const [mudou, setMudou] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // "A pergunta mudou" fica 4 s, como o Mac.
  useEffect(() => {
    if (!mudou) return;
    const t = setTimeout(() => setMudou(null), 4_000);
    return () => clearTimeout(t);
  }, [mudou]);
  const s = fila.find((x) => x.id !== p.ativa) ?? fila[0];
  if (!s) {
    return (
      <div className="faixa-sua-vez vazia" data-regiao="sua-vez">
        Ninguém espera você.
      </div>
    );
  }
  const pedido = p.telas.pedidos.get(s.id) ?? null;
  const responde = s.programa === "claude" && pedido !== null && pedido.tipo !== "outro";
  const enviar = async (tecla: string) => {
    if (enviando) return;
    setEnviando(true);
    try {
      const foi = await p.telas.responder(s.id, tecla);
      setMudou(foi ? null : s.id);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="faixa-sua-vez" data-regiao="sua-vez">
      <span className="rotulo-sua-vez">SUA VEZ · {fila.length}</span>
      <Ponto estado={s.estado} />
      <strong className="nome">{s.nome}</strong>
      <span className="texto">{mudou === s.id ? "A pergunta mudou. Olhe a sessão." : (pedido?.frase ?? detalheDaSessao(s, p.bancada.agora()))}</span>
      <span className="acoes">
        {responde ? (
          <>
            <button type="button" className="resposta ok" disabled={enviando} onClick={() => void enviar(TECLAS_DO_PEDIDO.sim)}>
              Sim, só agora
            </button>
            {podeSempre(pedido) ? (
              <button
                type="button"
                className="resposta"
                disabled={enviando}
                title={`Vira regra do próprio Claude Code, no .claude/settings.local.json desta pasta. Vale dentro e fora do app. Só para ${pedido.sempre}, nunca para qualquer comando.`}
                onClick={() => void enviar(TECLAS_DO_PEDIDO.sempre)}
              >
                Sempre para {pedido.sempre} aqui
              </button>
            ) : null}
            <button type="button" className="resposta nao" disabled={enviando} onClick={() => void enviar(TECLAS_DO_PEDIDO.nao)}>
              Não
            </button>
          </>
        ) : s.id !== p.ativa ? (
          <button type="button" className="link" onClick={() => p.ir(s.id)}>
            Ir para lá
          </button>
        ) : (
          <span className="mono explica">Responda na CLI, abaixo.</span>
        )}
      </span>
    </div>
  );
}

export function ColunaQuemEspera(p: { bancada: Bancada; ativa: string | null; ir: (id: string) => void }) {
  const fila = filaDaSuaVez(p.bancada);
  return (
    <aside className="quem-espera" data-regiao="quem-espera">
      <h2 className="titulo-de-bloco">QUEM ESPERA · FILA ÚNICA</h2>
      <div className="cartoes">
        {fila.length === 0 ? (
          <p className="explica">Ninguém. Quando uma IA terminar ou pedir licença, ela entra aqui, na ordem do Ctrl+Alt+N.</p>
        ) : (
          fila.map((s) => (
            <button key={s.id} type="button" className={s.id === p.ativa ? "cartao-espera ativo" : "cartao-espera"} onClick={() => p.ir(s.id)}>
              <span className="linha">
                <Ponto estado={s.estado} />
                <strong>{s.nome}</strong>
                <span className="mono explica">{s.programa}</span>
              </span>
              <span className="fala">{detalheDaSessao(s, p.bancada.agora())}</span>
            </button>
          ))
        )}
      </div>
      <p className="explica pe">A CLI pergunta do jeito dela. O app só mostra quem espera e leva você até lá.</p>
    </aside>
  );
}
