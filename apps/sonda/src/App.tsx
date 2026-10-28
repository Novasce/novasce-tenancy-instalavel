import { useCallback, useEffect, useRef, useState } from "react";
import { contrastes } from "./contraste";
import { comparar, esperarQuadros, medirAcoes, retratar, rolagemHorizontal, type Retrato } from "./medir";
import { abrirRepositorio, imprimirESair, info as lerInfo, type Info } from "./ponte";

// Os seis estados de toda tela (carregando, vazio, erro, sem permissão, offline, desatualizado),
// com a copy do canvas. Dados fictícios.
const ESTADOS = [
  { id: "carregando", rotulo: "Carregando", titulo: "Lendo o seu espaço", texto: "Na primeira leitura, o esqueleto ocupa o lugar do conteúdo." },
  { id: "vazio", rotulo: "Vazio", titulo: "Nenhuma rotina ainda", texto: "Uma rotina é um pedido feito no horário que você escolher." },
  { id: "erro", rotulo: "Erro", titulo: "A pasta não foi encontrada.", texto: "A sessão não abriu porque o caminho mudou." },
  { id: "sem-permissao", rotulo: "Sem permissão", titulo: "Esta área não está no seu acesso.", texto: "Quem administra a linha pode conferir o seu papel." },
  { id: "offline", rotulo: "Offline", titulo: "Sem internet", texto: "Última leitura às 10:15. Notas locais continuam disponíveis." },
  { id: "desatualizado", rotulo: "Desatualizado", titulo: "Dados da última leitura", texto: "Não foi possível atualizar agora." },
] as const;

type EstadoId = (typeof ESTADOS)[number]["id"];

const NAVEGACAO = ["Início", "Espaços", "Trabalho", "Rotinas", "Ajustes"];

const MISSOES = [
  { titulo: "Concluir a arte da peça A", detalhe: "Vence hoje · Ateliê de exemplo" },
  { titulo: "Revisar o texto da peça B", detalhe: "Em Review há 2 dias" },
  { titulo: "Conferir a lista de materiais", detalhe: "Sem prazo" },
  { titulo: "Responder o convite do espaço C", detalhe: "Espera você" },
  { titulo: "Guardar a referência da semana", detalhe: "Pessoal" },
];

function px(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function App() {
  const [dados, setDados] = useState<Info | null>(null);
  const [estado, setEstado] = useState<EstadoId>("carregando");
  const [resultado, setResultado] = useState("Ainda não medido.");
  const [manual, setManual] = useState(false);
  const [manualTexto, setManualTexto] = useState("Desligada.");
  const raiz = useRef<HTMLDivElement>(null);
  const base = useRef<Retrato | null>(null);
  const contagem = useRef({ n: 0, maior: 0 });

  useEffect(() => {
    lerInfo().then(setDados);
  }, []);

  const medir = useCallback(async () => {
    const r = raiz.current;
    if (!r) return null;
    await document.fonts.ready;
    setEstado("carregando");
    await esperarQuadros();
    const botoes = Array.from(r.querySelectorAll<HTMLButtonElement>("button"));
    const geo = await medirAcoes(r, [
      ...ESTADOS.map((e) => ({ nome: `estado: ${e.id}`, fazer: () => setEstado(e.id) })),
      ...botoes.map((b) => ({ nome: `foco: ${b.textContent?.trim() ?? ""}`, fazer: () => b.focus() })),
      { nome: "estado: carregando", fazer: () => setEstado("carregando") },
    ]);
    (document.activeElement as HTMLElement | null)?.blur();
    const cs = contrastes(r);
    return {
      sonda: dados?.versao ?? "",
      runtime: dados?.runtime ?? "",
      flatpak: dados?.flatpak ?? false,
      navegador: navigator.userAgent,
      reduzMovimento: matchMedia("(prefers-reduced-motion: reduce)").matches,
      escala: devicePixelRatio,
      janela: { largura: innerWidth, altura: innerHeight },
      maiorDeslocamento: geo.maior,
      rolagemHorizontal: rolagemHorizontal(document),
      contrasteMinimo: cs.length ? Math.min(...cs.map((c) => c.razao)) : null,
      contrastes: cs,
      acoes: geo.acoes,
      hora: new Date().toISOString(),
    };
  }, [dados]);

  useEffect(() => {
    if (!dados?.medir) return;
    medir().then((saida) => imprimirESair(JSON.stringify(saida)));
  }, [dados, medir]);

  const medirAgora = async () => {
    const saida = await medir();
    if (!saida) return;
    const contraste = saida.contrasteMinimo === null ? "sem texto marcado" : `${px(saida.contrasteMinimo)}:1`;
    setResultado(
      `Maior deslocamento: ${px(saida.maiorDeslocamento)} px · rolagem horizontal: ${saida.rolagemHorizontal ? "sim" : "não"} · contraste mínimo: ${contraste}`,
    );
  };

  useEffect(() => {
    const r = raiz.current;
    if (!manual || !r) return;
    base.current = retratar(r);
    const aoInteragir = async () => {
      await esperarQuadros();
      if (!base.current) return;
      const d = comparar(base.current, retratar(r));
      contagem.current = { n: contagem.current.n + 1, maior: Math.max(contagem.current.maior, d.maior) };
      setManualTexto(`${contagem.current.n} interações medidas · maior deslocamento ${px(contagem.current.maior)} px`);
    };
    const eventos = ["pointerover", "pointerdown", "pointerup", "focusin"] as const;
    eventos.forEach((e) => r.addEventListener(e, aoInteragir));
    return () => eventos.forEach((e) => r.removeEventListener(e, aoInteragir));
  }, [manual, estado]);

  const alternarManual = () => {
    contagem.current = { n: 0, maior: 0 };
    setManualTexto(manual ? "Desligada." : "Passe o ponteiro, clique e use o Tab.");
    setManual(!manual);
  };

  const atual = ESTADOS.find((e) => e.id === estado) ?? ESTADOS[0];

  return (
    <div className="janela" ref={raiz}>
      <header className="diagnostico" data-regiao="diagnostico">
        <strong data-contraste="sonda">Sonda do Tenancy · teste</strong>
        <span data-contraste="diagnostico">Versão {dados?.versao ?? "…"}</span>
        <span data-contraste="diagnostico">{dados?.flatpak ? `Flatpak · ${dados.runtime || "runtime não lido"}` : "Fora do Flatpak"}</span>
        <span data-contraste="diagnostico">Escala {px(devicePixelRatio)}</span>
      </header>

      <nav className="navegacao" data-regiao="navegacao" aria-label="Navegação de exemplo">
        {NAVEGACAO.map((item, i) => (
          <button key={item} type="button" className={i === 0 ? "nav ativo" : "nav"} data-contraste={`nav-${i}`}>
            {item}
          </button>
        ))}
      </nav>

      <main className="mesa">
        <section className="saudacao" data-regiao="saudacao">
          <h1 data-contraste="saudacao">Bom dia, Lia.</h1>
          <p data-contraste="data">Quarta, 28 de outubro · Ateliê de exemplo</p>
        </section>

        <section className="progresso" data-regiao="progresso" aria-label="Progresso de exemplo">
          <span data-contraste="progresso">2 de 5 missões</span>
          <div className="trilho" aria-hidden="true">
            <div className="barra" />
          </div>
        </section>

        <section className="missoes" data-regiao="missoes" aria-label="Missões de exemplo">
          <div className="rolavel" data-rolagem="missoes">
            {MISSOES.map((m) => (
              <div key={m.titulo} className="missao">
                <div>
                  <strong data-contraste="missao">{m.titulo}</strong>
                  <small data-contraste="missao-detalhe">{m.detalhe}</small>
                </div>
                <button type="button" className="acao">Abrir</button>
              </div>
            ))}
          </div>
        </section>

        <section className={`estado estado-${estado}`} data-regiao="estado" aria-live="polite">
          <div className="estado-texto">
            <strong data-contraste="estado-titulo">{atual.titulo}</strong>
            <p data-contraste="estado-texto">{atual.texto}</p>
          </div>
          <div className="estado-botoes" role="group" aria-label="Estados da tela">
            {ESTADOS.map((e) => (
              <button
                key={e.id}
                type="button"
                className={e.id === estado ? "chip ativo" : "chip"}
                aria-pressed={e.id === estado}
                onClick={() => setEstado(e.id)}
              >
                {e.rotulo}
              </button>
            ))}
          </div>
        </section>
      </main>

      <aside className="lado">
        <section className="briefing" data-regiao="briefing">
          <h2 data-contraste="briefing-titulo">O dia</h2>
          <ul>
            <li data-contraste="briefing">A peça A vai ao ar hoje e está pronta.</li>
            <li data-contraste="briefing">A peça B espera aprovação há 2 dias.</li>
            <li data-contraste="briefing">Quarta é dia da pergunta da semana.</li>
          </ul>
        </section>
        <section className="pessoal" data-regiao="pessoal">
          <h2 data-contraste="pessoal-titulo">Pessoal</h2>
          <p data-contraste="pessoal">Nota de hoje · 3 linhas</p>
          <p data-contraste="pessoal">Entrada · 2 capturas</p>
        </section>
      </aside>

      <footer className="medicao" data-regiao="medicao">
        <div className="medicao-botoes">
          <button type="button" className="primario" onClick={medirAgora}>
            Medir agora
          </button>
          <button type="button" className="secundario" onClick={alternarManual} aria-pressed={manual}>
            {manual ? "Desligar a medição manual" : "Ligar a medição manual"}
          </button>
          <button type="button" className="secundario" onClick={() => abrirRepositorio()}>
            Abrir o repositório
          </button>
        </div>
        <div className="medicao-textos">
          <span data-contraste="resultado">{resultado}</span>
          <span data-contraste="manual">Medição manual: {manualTexto}</span>
        </div>
      </footer>
    </div>
  );
}
