// O autoteste de geometria da 0.1, levado da sonda ao app: todas as telas e
// estados com a mão de ensaio, medindo que nada sai do lugar ao trocar de
// página, de estado, de sessão e ao receber foco. Roda no CI com `--autoteste`
// (WebKitGTK sem tela) e imprime o JSON; no jsdom roda para provar o roteiro.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { comparar, esperarQuadros, retratar, rolagemHorizontal, type ResultadoDaAcao } from "../../../sonda/src/medir";
import { App } from "../App";
import { Bancada, type EstadoDaSessao } from "../bancada/bancada";
import type { CriarTerminal } from "../bancada/terminal";
import { EstadoDaTela, ESTADOS_DA_TELA } from "../casca/estado";
import { preferenciasNaMemoria, type Tema } from "../casca/preferencias";
import { maoDeEnsaio } from "../mao/ensaio";

export function roteiroDoAutoteste() {
  return {
    janelas: [
      { largura: 1024, altura: 728 },
      { largura: 1264, altura: 728 },
    ],
    escalas: [1, 1.25],
    temas: ["claro", "escuro"] as Tema[],
    paginas: ["agentes", "ajustes", "bancada", "nova-sessao", "para-continuar", "fora-da-main"],
    estados: ["abrindo", "trabalhando", "livre", "pediu-permissao", "terminou", "parada", "sem-resposta", "encerrada"] as EstadoDaSessao[],
    estadosDaTela: [...ESTADOS_DA_TELA],
    sessoesNaLista: 300,
    linhasNoTerminal: 10_000,
  };
}

export interface SaidaDoAutoteste {
  mao: string;
  tema: Tema;
  janela: { largura: number; altura: number };
  escala: number;
  navegador: string;
  maiorDeslocamento: number;
  rolagemHorizontal: boolean;
  acoes: ResultadoDaAcao[];
  lista300: { linhasDesenhadas: number; larguraDaLateral: number; paginaRolou: boolean };
  terminal10k: { linhas: number; ms: number };
  hora: string;
}

interface Opcoes {
  criarTerminal: CriarTerminal;
  esperar?: () => Promise<void>;
  tema: Tema;
}

function botao(raiz: ParentNode, nome: string): HTMLButtonElement | null {
  return (
    Array.from(raiz.querySelectorAll<HTMLButtonElement>("button")).find((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === nome) ?? null
  );
}

async function montarApp(bancada: Bancada, o: Opcoes) {
  const raiz = document.createElement("div");
  raiz.className = "autoteste-raiz";
  document.body.appendChild(raiz);
  const root = createRoot(raiz);
  flushSync(() =>
    root.render(
      createElement(App, {
        mao: bancada.mao,
        preferencias: preferenciasNaMemoria({ modoAvancado: true, tema: o.tema }),
        bancada,
        criarTerminal: o.criarTerminal,
        semRelogio: true,
      }),
    ),
  );
  return {
    raiz,
    desmontar: () => {
      root.unmount();
      raiz.remove();
    },
  };
}

export async function rodarAutoteste(o: Opcoes): Promise<SaidaDoAutoteste> {
  const esperar = o.esperar ?? esperarQuadros;
  const r = roteiroDoAutoteste();
  const acoes: ResultadoDaAcao[] = [];
  const medir = async (escopo: () => ParentNode, nome: string, fazer: () => void | Promise<void>) => {
    const antes = retratar(escopo());
    await fazer();
    await esperar();
    acoes.push({ nome, ...comparar(antes, retratar(escopo())) });
  };

  // 1. A casca, as páginas e o foco, com três sessões de exemplo.
  const mao = maoDeEnsaio();
  const bancada = new Bancada(mao, () => Date.parse("2026-10-28T12:00:00-03:00"), undefined, async () => {});
  const claude = await bancada.abrir({ programa: "claude", pasta: "/home/lia/Brain", nome: "Peça A" });
  const codex = await bancada.abrir({ programa: "codex", pasta: "/home/lia/Brain/repos/atelie-api", nome: "Peça B" });
  await bancada.abrir({ programa: "shell", pasta: "/home/lia/Brain/repos/atelie-site", nome: "Terminal" });
  const app = await montarApp(bancada, o);
  await esperar();
  const lateral = () => app.raiz.querySelector("[data-regiao=lateral]") ?? app.raiz;
  const conteudo = () => app.raiz.querySelector(".conteudo") ?? app.raiz;
  const rotulos: Record<string, string> = {
    agentes: "Agentes",
    ajustes: "Ajustes",
    bancada: "Bancada",
    "nova-sessao": "Nova sessão",
    "para-continuar": "Para continuar",
    "fora-da-main": "Trabalho fora da main",
  };
  for (const p of r.paginas) await medir(lateral, `pagina: ${p}`, () => flushSync(() => botao(app.raiz, rotulos[p])?.click()));
  for (const nome of ["Agentes", "Bancada", "Ajustes", "Para continuar", "Trabalho fora da main", "Nova sessão"]) {
    await medir(lateral, `foco: ${nome}`, () => botao(app.raiz, nome)?.focus());
  }

  // 2. A Bancada: cada estado da sessão da frente e a troca de sessão.
  flushSync(() => botao(app.raiz, "Bancada")?.click());
  await esperar();
  for (const e of r.estados) await medir(conteudo, `estado: ${e}`, () => flushSync(() => bancada.mudarEstado(claude.id, e)));
  await medir(conteudo, "troca de sessão", () => {
    const linha = app.raiz.querySelector<HTMLElement>(`[data-sessao="${codex.id}"]`);
    flushSync(() => linha?.click());
  });
  for (const nome of ["Renomear a sessão", "Dividir o painel", "Fechar a sessão"]) await medir(conteudo, `foco: ${nome}`, () => botao(app.raiz, nome)?.focus());
  const janela = { largura: innerWidth, altura: innerHeight };
  const horizontal = rolagemHorizontal(document);
  app.desmontar();

  // 3. Os seis estados de tela, na mesma área reservada.
  const area = document.createElement("div");
  area.style.cssText = "position:fixed;left:0;top:0;width:600px;height:300px";
  document.body.appendChild(area);
  const raizDosEstados = createRoot(area);
  flushSync(() => raizDosEstados.render(createElement(EstadoDaTela, { estado: "carregando", titulo: "Lendo o seu espaço", texto: "Na primeira leitura, o esqueleto ocupa o lugar do conteúdo." })));
  for (const e of r.estadosDaTela) {
    await medir(() => area, `estado da tela: ${e}`, () =>
      flushSync(() => raizDosEstados.render(createElement(EstadoDaTela, { estado: e, titulo: "Título de exemplo", texto: "Texto de exemplo com uma frase." }))),
    );
  }
  raizDosEstados.unmount();
  area.remove();

  // 4. Trezentas sessões: a lista rola sozinha e só desenha as linhas à vista.
  const muitas = new Bancada(maoDeEnsaio(), () => Date.parse("2026-10-28T12:00:00-03:00"), undefined, async () => {});
  for (let i = 1; i <= r.sessoesNaLista; i++) await muitas.abrir({ programa: i % 2 ? "shell" : "claude", pasta: `/home/lia/Brain/repos/peca-${i}`, nome: `Peça ${i}` });
  const cheia = await montarApp(muitas, o);
  await esperar();
  const larguraAntes = (cheia.raiz.querySelector("[data-regiao=lateral]") as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
  const regiao = cheia.raiz.querySelector<HTMLElement>("[data-rolagem=sessoes]");
  await medir(() => cheia.raiz.querySelector("[data-regiao=lateral]") ?? cheia.raiz, "lista: 300 sessões", async () => {
    if (regiao) regiao.scrollTop = 150 * 32;
    regiao?.dispatchEvent(new Event("scroll"));
  });
  // A rolagem da lista muda por querer: o que conta é a caixa não mexer.
  const ultima = acoes[acoes.length - 1];
  ultima.rolagemMudou = false;
  const lista300 = {
    linhasDesenhadas: cheia.raiz.querySelectorAll("[data-sessao]").length,
    larguraDaLateral: larguraAntes,
    paginaRolou: (document.scrollingElement?.scrollTop ?? 0) !== 0,
  };
  cheia.desmontar();

  // 5. O terminal desenhando 10.000 linhas.
  const termo = o.criarTerminal({ escuro: o.tema === "escuro" });
  const caixa = document.createElement("div");
  caixa.style.cssText = "position:fixed;left:0;top:0;width:800px;height:480px";
  document.body.appendChild(caixa);
  termo.abrirEm(caixa);
  const texto = Array.from({ length: r.linhasNoTerminal }, (_, i) => `linha ${i + 1} de exemplo, com texto para ocupar a largura`).join("\r\n") + "\r\n";
  const comeco = performance.now();
  await new Promise<void>((pronto) => termo.write(texto, pronto));
  await esperar();
  const terminal10k = { linhas: r.linhasNoTerminal, ms: Math.round(performance.now() - comeco) };
  termo.dispose();
  caixa.remove();

  return {
    mao: mao.tipo,
    tema: o.tema,
    janela,
    escala: devicePixelRatio,
    navegador: navigator.userAgent,
    maiorDeslocamento: Math.max(0, ...acoes.map((a) => a.maior)),
    rolagemHorizontal: horizontal,
    acoes,
    lista300,
    terminal10k,
    hora: new Date().toISOString(),
  };
}
