// A lista de sessões da lateral (UC16, VL04) sobre o componente de lista do
// pacote listas: busca, contagem, seleção e lote em área reservada, rolagem
// só dentro da região e só as linhas à vista desenhadas. A ordem é livre, a da
// pessoa (Mac 0.23): a lista não reordena por título.
import { abrirLista, trocarBusca, visiveis, janelaVisivel, type Lista } from "@novasce/listas";
import { duracao } from "@novasce/sessoes";
import { useEffect, useMemo, useRef, useState } from "react";
import { esperaVoce, ROTULO_DO_ESTADO, type Bancada, type SessaoDaBancada } from "../bancada";
import { Ponto } from "../Ponto";
import { useBancada } from "../../casca/usar";
import { quandoFechou } from "../guardas";

/** 30 px de linha e 2 de vão, como o Mac. */
export const ALTURA_DA_LINHA = 32;
const ALTURA_PADRAO = 360;

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

/** O detalhe da sessão (dica da linha e cabeça), na ordem de precedência do Mac. */
export function detalheDaSessao(s: SessaoDaBancada, agora: number): string {
  const ha = duracao((agora - s.estadoDesde) / 1000);
  if (s.estado === "encerrando") return "encerrando…";
  if (s.pendencia?.tipo === "fora-da-main") return `${plural(s.pendencia.commits, "commit", "commits")} fora da main · fechar?`;
  if (s.pendencia?.tipo === "sem-commit") return `${s.pendencia.soltos} sem commit · fechar?`;
  if (s.pendencia?.tipo === "encerrar") return `encerrar o ${s.programa}?`;
  if (s.pendencia?.tipo === "retomar") return `${quandoFechou(agora - s.pendencia.fechadaEm)} · retomar?`;
  if (s.pendencia?.tipo === "do-disco") return "abrir de novo";
  if (!s.terminal) return s.codigoDeSaida !== undefined ? `encerrada · saiu com ${s.codigoDeSaida}` : "encerrada";
  switch (s.estado) {
    case "pediu-permissao":
      return `pediu permissão há ${ha}`;
    case "terminou":
      return `terminou há ${ha} · espera você`;
    case "parada":
      return `parada há ${ha}`;
    case "abrindo":
      return "abrindo…";
    case "sem-resposta":
      return `sem resposta há ${ha} · a CLI não mostrou o prompt`;
  }
  if (s.ultimaFala) {
    const f = s.ultimaFala.replace(/\s+/g, " ").trim();
    return `“${f.length > 140 ? f.slice(0, 139) + "…" : f}”`;
  }
  return s.pasta.split("/").filter(Boolean).slice(-2).join("/");
}

/** O que vai à direita da linha: "sua vez" ou o programa. */
export function direitaDaLinha(s: SessaoDaBancada): string {
  if (esperaVoce(s)) return "sua vez";
  if (s.programa === "comando") return (s.comando ?? "").split(/\s+/)[0] || "comando";
  return s.programa;
}

interface Menu {
  id: string;
}

export function ListaDeSessoes(p: { bancada: Bancada; ativa: string | null; ir: (id: string) => void }) {
  const bancada = useBancada(p.bancada);
  const sessoes = bancada.sessoes();
  const [busca, setBusca] = useState("");
  const [recolhida, setRecolhida] = useState(false);
  const [selecao, setSelecao] = useState<string[]>([]);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [rolagem, setRolagem] = useState(0);
  const [altura, setAltura] = useState(ALTURA_PADRAO);
  const regiao = useRef<HTMLDivElement>(null);

  const lista: Lista = useMemo(() => {
    const base = abrirLista({
      nome: "sessoes",
      itens: sessoes.map((s) => ({ id: s.id, titulo: s.nome, espaco: "bancada" })),
      acesso: ["bancada"],
      relogio: new Date(bancada.agora()).toISOString(),
      fuso: "UTC",
    });
    return trocarBusca(base, busca).lista;
  }, [sessoes, busca, bancada]);

  // A busca do núcleo diz quem fica; a ordem continua a da pessoa.
  const achadas = useMemo(() => {
    const ids = new Set(visiveis(lista).map((i) => i.id));
    return sessoes.filter((s) => ids.has(s.id));
  }, [lista, sessoes]);

  useEffect(() => {
    const r = regiao.current;
    if (!r || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(() => setAltura(r.clientHeight || ALTURA_PADRAO));
    o.observe(r);
    return () => o.disconnect();
  }, [recolhida]);

  const janela = janelaVisivel({ alturaLinha: ALTURA_DA_LINHA, alturaRegiao: altura, rolagem, grupos: [{ nome: "sessoes", quantos: achadas.length }] });
  const aVista = achadas.slice(janela.inicio, janela.fim + 1);
  const contagem = busca.trim() ? `${achadas.length} de ${sessoes.length}` : plural(sessoes.length, "sessão", "sessões");
  const selecionadasAbertas = selecao.filter((id) => bancada.sessao(id)?.terminal);

  const teclas = (e: React.KeyboardEvent, s: SessaoDaBancada) => {
    if (e.ctrlKey && e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      bancada.mover(s.id, e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "Enter") p.ir(s.id);
  };

  const clicar = (e: React.MouseEvent, s: SessaoDaBancada) => {
    if (e.ctrlKey || e.metaKey) {
      setSelecao((sel) => (sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id]));
      return;
    }
    setSelecao([]);
    p.ir(s.id);
  };

  const encerrarSelecionadas = async () => {
    const ids = selecionadasAbertas;
    setSelecao([]);
    await bancada.encerrar(ids);
  };

  const s = menu ? bancada.sessao(menu.id) : undefined;
  const posicao = s ? sessoes.findIndex((x) => x.id === s.id) : -1;

  return (
    <div className="lista-sessoes">
      <div className="cabeca-da-lista">
        <input
          className="busca"
          type="search"
          aria-label="Buscar sessão"
          placeholder="Buscar sessão"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setSelecao([]);
            setRolagem(0);
          }}
        />
        <span className="contagem" data-regiao="contagem">
          {contagem}
        </span>
        <button type="button" className="icone" aria-label={recolhida ? "Mostrar as sessões" : "Recolher as sessões"} aria-expanded={!recolhida} onClick={() => setRecolhida(!recolhida)}>
          {recolhida ? "▸" : "▾"}
        </button>
      </div>
      <div
        className="regiao-da-lista"
        data-rolagem="sessoes"
        ref={regiao}
        onScroll={(e) => setRolagem(e.currentTarget.scrollTop)}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Sessões"
      >
        {recolhida ? null : achadas.length === 0 ? (
          <p className="lista-vazia">{sessoes.length ? "Nenhuma sessão com esse nome." : "Nenhuma sessão aberta."}</p>
        ) : (
          <div className="trilho-da-lista" style={{ height: `${achadas.length * ALTURA_DA_LINHA}px` }}>
            {aVista.map((x, i) => {
              const classes = ["linha-da-sessao", x.id === p.ativa ? "ativa" : "", selecao.includes(x.id) ? "selecionada" : ""].join(" ").trim();
              return (
                <div
                  key={x.id}
                  data-sessao={x.id}
                  className={classes}
                  role="option"
                  aria-selected={selecao.includes(x.id)}
                  tabIndex={0}
                  title={detalheDaSessao(x, bancada.agora())}
                  style={{ top: `${(janela.inicio + i) * ALTURA_DA_LINHA}px` }}
                  onClick={(e) => clicar(e, x)}
                  onKeyDown={(e) => teclas(e, x)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ id: x.id });
                  }}
                >
                  <Ponto estado={x.terminal || x.estado === "encerrando" ? x.estado : "encerrada"} />
                  <span className="nome-da-sessao">{x.nome}</span>
                  <span className={esperaVoce(x) ? "direita ambar" : "direita"} aria-label={ROTULO_DO_ESTADO[x.estado]}>
                    {direitaDaLinha(x)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="lote" data-regiao="lote" aria-live="polite">
        {selecao.length > 0 ? (
          <>
            <span>{plural(selecao.length, "selecionada", "selecionadas")}</span>
            <button type="button" className="perigo" disabled={!selecionadasAbertas.length} onClick={encerrarSelecionadas}>
              {selecionadasAbertas.length === 1 ? "Encerrar 1 sessão" : `Encerrar ${selecionadasAbertas.length} sessões`}
            </button>
            <button type="button" className="secundario" onClick={() => setSelecao([])}>
              Limpar
            </button>
          </>
        ) : null}
      </div>
      {menu && s ? (
        <div className="menu" role="menu" onKeyDown={(e) => e.key === "Escape" && setMenu(null)}>
          <button type="button" role="menuitem" onClick={() => (setMenu(null), p.ir(s.id))}>
            Ir para a sessão
          </button>
          {!s.terminal ? (
            <button type="button" role="menuitem" onClick={() => (setMenu(null), void bancada.reabrir(s.id))}>
              Abrir de novo
            </button>
          ) : null}
          <button type="button" role="menuitem" disabled={posicao <= 0} onClick={() => (setMenu(null), bancada.mover(s.id, -1))}>
            Subir a sessão
          </button>
          <button type="button" role="menuitem" disabled={posicao >= sessoes.length - 1} onClick={() => (setMenu(null), bancada.mover(s.id, 1))}>
            Descer a sessão
          </button>
          {s.terminal ? (
            <button type="button" role="menuitem" className="perigo" disabled={s.estado === "encerrando"} onClick={() => (setMenu(null), void bancada.fechar(s.id))}>
              Fechar a sessão
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => (setMenu(null), bancada.esquecer(s.id))}>
              Tirar da lista
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => setMenu(null)}>
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}
