import { useEffect, useMemo, useReducer, useState } from "react";
import { Bancada } from "./bancada/bancada";
import { FolhaNova } from "./bancada/folha-nova";
import { ListaDeSessoes } from "./bancada/lista/ListaDeSessoes";
import { RegrasSempre } from "./bancada/regras";
import { TelaDaSessao } from "./bancada/sessao";
import { Telas } from "./bancada/telas";
import { LER_A_CADA_MS } from "./bancada/tela";
import { criarTerminalXterm, type CriarTerminal } from "./bancada/terminal";
import { Ajustes } from "./casca/Ajustes";
import { EstadoDaTela } from "./casca/estado";
import { Lateral, type Pagina } from "./casca/Lateral";
import type { Escolhas, Preferencias } from "./casca/preferencias";
import type { MaoDoHost } from "./mao/tipos";

function escuroAgora(tema: Escolhas["tema"]): boolean {
  if (tema === "escuro") return true;
  if (tema === "claro") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function App(p: {
  mao: MaoDoHost;
  preferencias: Preferencias;
  bancada?: Bancada;
  criarTerminal?: CriarTerminal;
  /** Sem o relógio de 2 s: a leitura só corre pelo evento `tenancy:ler` (testes e autoteste). */
  semRelogio?: boolean;
}) {
  const bancada = useMemo(() => p.bancada ?? new Bancada(p.mao), [p.bancada, p.mao]);
  const [escolhas, setEscolhas] = useState<Escolhas>(() => p.preferencias.ler());
  const [pagina, setPagina] = useState<Pagina>("agentes");
  const [ativa, setAtiva] = useState<string | null>(null);
  const escuro = escuroAgora(escolhas.tema);
  const telas = useMemo(() => new Telas(bancada, p.criarTerminal ?? criarTerminalXterm, () => escuro), [bancada, p.criarTerminal]);
  const [, redesenhar] = useReducer((n: number) => n + 1, 0);

  useEffect(() => telas.ouvir(redesenhar), [telas]);
  useEffect(() => bancada.ouvir(redesenhar), [bancada]);

  useEffect(() => {
    document.documentElement.dataset.tema = escolhas.tema;
  }, [escolhas.tema]);

  useEffect(() => {
    const ler = () => telas.ler(pagina === "bancada" ? ativa : null);
    window.addEventListener("tenancy:ler", ler);
    const relogio = p.semRelogio ? null : setInterval(ler, LER_A_CADA_MS);
    return () => {
      window.removeEventListener("tenancy:ler", ler);
      if (relogio) clearInterval(relogio);
    };
  }, [telas, pagina, ativa, p.semRelogio]);

  const mudar = (e: Escolhas) => {
    p.preferencias.gravar(e);
    setEscolhas(e);
  };

  const irPara = (id: string) => {
    setAtiva(id);
    setPagina("bancada");
  };

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (!escolhas.modoAvancado || !e.ctrlKey || !e.shiftKey) return;
      if (e.key === "T") {
        e.preventDefault();
        setPagina("nova-sessao");
      }
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [escolhas.modoAvancado]);

  const sessoesVisiveis = escolhas.modoAvancado;
  const atual: Pagina = !sessoesVisiveis && pagina !== "agentes" && pagina !== "ajustes" ? "agentes" : pagina;

  return (
    <div className="janela">
      <Lateral
        pagina={atual}
        ir={setPagina}
        modoAvancado={escolhas.modoAvancado}
        bancada={bancada}
        espaco="Brain"
        conta="lia"
        sessoes={<ListaDeSessoes bancada={bancada} ativa={atual === "bancada" ? ativa : null} ir={irPara} />}
      />
      <main className="conteudo">
        {atual === "ajustes" ? (
          <Ajustes escolhas={escolhas} mudar={mudar} bancada={bancada} regras={escolhas.modoAvancado ? <RegrasSempre bancada={bancada} /> : null} />
        ) : atual === "agentes" ? (
          <div className="pagina" data-pagina="agentes">
            <EstadoDaTela estado="carregando" titulo="Abrindo os agentes" texto="A página dos agentes do Tenancy abre numa janela própria." />
          </div>
        ) : atual === "nova-sessao" ? (
          <FolhaNova bancada={bancada} escuro={escuro} aberta={irPara} cancelar={() => setPagina(ativa ? "bancada" : "agentes")} />
        ) : atual === "bancada" ? (
          <TelaDaSessao bancada={bancada} telas={telas} ativa={ativa ?? bancada.sessoes()[0]?.id ?? null} ir={irPara} escuro={escuro} />
        ) : (
          <div className="pagina" data-pagina={atual}>
            <EstadoDaTela estado="vazio" titulo="Nada aqui ainda" texto="Esta área chega na próxima parte." />
          </div>
        )}
      </main>
    </div>
  );
}
