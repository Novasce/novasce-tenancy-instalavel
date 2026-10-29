// A sessão da frente: cabeça de 36 px, faixas, os painéis do terminal e a
// coluna Quem espera. As faixas nascem numa área própria acima do terminal.
import { useEffect, useRef, useState } from "react";
import { nomeDaPasta, type Bancada, type SessaoDaBancada } from "./bancada";
import { detalheDaSessao } from "./lista/ListaDeSessoes";
import { Ponto } from "./Ponto";
import { FaixasDaSessao } from "./faixas";
import { ColunaQuemEspera, FaixaDaSuaVez } from "./quem-espera";
import type { Telas } from "./telas";
import { colarPergunta } from "./vigia";

function PainelDoTerminal(p: { telas: Telas; terminalId: string; aoColar: (texto: string) => boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const termo = p.telas.painel(p.terminalId);
    if (!termo || !el.current) return;
    termo.abrirEm(el.current);
    termo.focus();
  }, [p.telas, p.terminalId]);
  return (
    <div
      className="painel-do-terminal"
      data-regiao="terminal"
      ref={el}
      onPasteCapture={(e) => {
        const texto = e.clipboardData?.getData("text/plain") ?? (e.nativeEvent as unknown as { clipboardData?: DataTransfer }).clipboardData?.getData("text") ?? "";
        if (p.aoColar(texto)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    />
  );
}

export function Cabeca(p: { bancada: Bancada; s: SessaoDaBancada; renomear: () => void; dividir: () => void }) {
  const fechar = () => void p.bancada.fechar(p.s.id);
  const home = p.bancada.mao.arquivos.home();
  return (
    <header className="cabeca-da-sessao" data-regiao="cabeca-da-sessao">
      <Ponto estado={p.s.terminal || p.s.estado === "encerrando" ? p.s.estado : "encerrada"} />
      <strong className="nome">{p.s.nome}</strong>
      <span className="programa mono">{`${p.s.programa === "comando" ? (p.s.comando ?? "").split(/\s+/)[0] : p.s.programa} · ${nomeDaPasta(p.s.pasta, home)}`}</span>
      {p.s.worktree ? <span className="pilula mono">worktree</span> : null}
      <span className="espaco-flex" />
      <span className="detalhe">{detalheDaSessao(p.s, p.bancada.agora())}</span>
      <button type="button" className="icone-texto" onClick={p.renomear}>
        Renomear a sessão
      </button>
      <button type="button" className="icone-texto" disabled={!p.s.terminal || !!p.s.extra} onClick={p.dividir}>
        Dividir o painel
      </button>
      <button type="button" className="icone-texto" disabled={!p.s.terminal || p.s.estado === "encerrando"} onClick={fechar}>
        Fechar a sessão
      </button>
    </header>
  );
}

function FaixaDeRenomear(p: { bancada: Bancada; s: SessaoDaBancada; fechar: () => void }) {
  const [nome, setNome] = useState(p.s.nomeManual ? p.s.nome : "");
  return (
    <div className="faixa faixa-renomear" data-regiao="renomear">
      <span className="rotulo-da-faixa">renomear</span>
      <input
        className="campo"
        autoFocus
        placeholder="nome da sessão"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            p.bancada.renomear(p.s.id, nome);
            p.fechar();
          } else if (e.key === "Escape") p.fechar();
        }}
      />
      <span className="mono explica">{nome.trim() ? "Enter fixa · Esc desiste" : "vazio devolve o automático"}</span>
    </div>
  );
}

export function TelaDaSessao(p: {
  bancada: Bancada;
  telas: Telas;
  ativa: string | null;
  ir: (id: string) => void;
  escuro: boolean;
}) {
  const s = p.ativa ? p.bancada.sessao(p.ativa) : undefined;
  const [renomeando, setRenomeando] = useState(false);
  const [colar, setColar] = useState<{ texto: string; pergunta: string; terminal: string } | null>(null);

  const aoColar = (terminal: string) => (texto: string) => {
    const pergunta = colarPergunta(texto);
    if (!pergunta) return false;
    setColar({ texto, pergunta, terminal });
    return true;
  };

  return (
    <div className="bancada" data-pagina="bancada">
      <FaixaDaSuaVez bancada={p.bancada} telas={p.telas} ativa={p.ativa} ir={p.ir} />
      <div className="corpo-da-bancada">
        <section className="sessao-da-frente">
          {s ? (
            <>
              <Cabeca bancada={p.bancada} s={s} renomear={() => setRenomeando(!renomeando)} dividir={() => void p.bancada.dividir(s.id, p.escuro)} />
              <div className="faixas-da-sessao">
                <FaixasDaSessao bancada={p.bancada} s={s} />
                {colar ? (
                  <div className="faixa ambar" data-regiao="colar">
                    <span className="rotulo-da-faixa">colar</span>
                    <span className="texto-da-faixa">{colar.pergunta}</span>
                    <button
                      type="button"
                      className="botao-da-faixa primario"
                      onClick={() => {
                        const termo = p.telas.painel(colar.terminal);
                        if (termo) termo.paste(colar.texto);
                        else void p.bancada.mao.terminal.escrever(colar.terminal, colar.texto);
                        setColar(null);
                      }}
                    >
                      colar
                    </button>
                    <button type="button" className="botao-da-faixa" onClick={() => setColar(null)}>
                      não
                    </button>
                  </div>
                ) : null}
                {renomeando ? <FaixaDeRenomear bancada={p.bancada} s={s} fechar={() => setRenomeando(false)} /> : null}
              </div>
              <div className={s.extra ? "paineis dois" : "paineis"}>
                {s.terminal ? (
                  <PainelDoTerminal key={s.terminal.id} telas={p.telas} terminalId={s.terminal.id} aoColar={aoColar(s.terminal.id)} />
                ) : (
                  <div className="sessao-fechada">
                    <p>{detalheDaSessao(s, p.bancada.agora())}</p>
                    <button type="button" className="secundario" onClick={() => void p.bancada.reabrir(s.id)}>
                      Abrir de novo
                    </button>
                  </div>
                )}
                {s.extra ? <PainelDoTerminal key={s.extra.id} telas={p.telas} terminalId={s.extra.id} aoColar={aoColar(s.extra.id)} /> : null}
              </div>
            </>
          ) : (
            <div className="sem-sessao">
              <strong>Nenhuma sessão aberta.</strong>
              <p className="explica">Ctrl+Shift+T abre uma: a pasta e a IA. A CLI é a de verdade, do jeito dela.</p>
            </div>
          )}
        </section>
        <ColunaQuemEspera bancada={p.bancada} ativa={p.ativa} ir={p.ir} />
      </div>
    </div>
  );
}
