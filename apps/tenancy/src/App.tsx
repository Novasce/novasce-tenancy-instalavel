import { useEffect, useMemo, useReducer, useState } from "react";
import { Bancada } from "./bancada/bancada";
import { FolhaNova } from "./bancada/folha-nova";
import { ATUALIZAR_FORA_DA_MAIN_MS, TelaForaDaMain } from "./bancada/fora-da-main";
import { listarForaDaMain, type ForaDaMain } from "./bancada/guardas";
import { FaixaDeSair, FaixaDosOrfaos, perguntaDeSair, Recado } from "./bancada/pe";
import { protegidosDoHost } from "./bancada/processos";
import { MARCA } from "./bancada/bancada";
import { orfaos as acharOrfaos, type Orfao } from "@novasce/sessoes";
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
  const [foraDaMain, setForaDaMain] = useState<ForaDaMain[]>([]);
  const [orfaos, setOrfaos] = useState<Orfao[]>([]);
  const [sair, setSair] = useState<string | null>(null);

  const atualizarForaDaMain = async () => setForaDaMain(await listarForaDaMain(bancada));

  // Ao abrir: as sessões do banco voltam (só o shell sobe), os órfãos de uma
  // abertura anterior são achados e o Trabalho fora da main é lido.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const tabela = await p.mao.processos.tabela();
      const prot = await protegidosDoHost(p.mao);
      const achados = acharOrfaos(tabela, prot, { marca: MARCA, pacoteDoApp: "com.novasce.Tenancy" });
      if (vivo) setOrfaos(achados);
      await bancada.restaurar();
      if (vivo) setForaDaMain(await listarForaDaMain(bancada));
    })();
    return () => {
      vivo = false;
    };
  }, [bancada, p.mao]);

  useEffect(() => {
    if (p.semRelogio) return;
    const t = setInterval(() => void atualizarForaDaMain(), ATUALIZAR_FORA_DA_MAIN_MS);
    return () => clearInterval(t);
  }, [bancada, p.semRelogio]);

  // Recado de sucesso some em 12 s; o de falha fica até "Entendi".
  const recado = bancada.recadoAtual;
  useEffect(() => {
    if (!recado || recado.erro || p.semRelogio) return;
    const t = setTimeout(() => bancada.limparRecado(), 12_000);
    return () => clearTimeout(t);
  }, [recado, bancada, p.semRelogio]);

  // Sair com agentes abertos pergunta uma vez; sem agente, sai direto.
  useEffect(() => {
    const pedir = () => {
      const pergunta = perguntaDeSair(bancada);
      if (pergunta) setSair(pergunta);
      else void p.mao.sair();
    };
    window.addEventListener("tenancy:sair", pedir);
    return () => window.removeEventListener("tenancy:sair", pedir);
  }, [bancada, p.mao]);

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
    if (pagina === "fora-da-main") void atualizarForaDaMain();
  }, [pagina]);

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
        foraDaMain={foraDaMain.length}
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
        ) : atual === "fora-da-main" ? (
          <TelaForaDaMain bancada={bancada} lista={foraDaMain} atualizar={atualizarForaDaMain} />
        ) : atual === "bancada" ? (
          <TelaDaSessao bancada={bancada} telas={telas} ativa={ativa ?? bancada.sessoes()[0]?.id ?? null} ir={irPara} escuro={escuro} />
        ) : (
          <div className="pagina" data-pagina={atual}>
            <EstadoDaTela estado="vazio" titulo="Nada aqui ainda" texto="Esta área chega na próxima parte." />
          </div>
        )}
      </main>
      <footer className="pe-da-janela">
        {sair ? (
          <FaixaDeSair
            texto={sair}
            ficar={() => setSair(null)}
            sair={async () => {
              setSair(null);
              bancada.recado("Encerrando as sessões…", false);
              await bancada.encerrarTudo();
              await p.mao.sair();
            }}
          />
        ) : orfaos.length ? (
          <FaixaDosOrfaos bancada={bancada} orfaos={orfaos} mudar={setOrfaos} />
        ) : (
          <Recado bancada={bancada} />
        )}
      </footer>
    </div>
  );
}
