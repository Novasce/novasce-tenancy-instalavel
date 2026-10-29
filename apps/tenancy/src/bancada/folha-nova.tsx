// A folha "Nova sessão" do Mac (UC16): onde, qual IA, nome e o comando por trás.
import { useEffect, useMemo, useState } from "react";
import { linhaDaCli, nomeDaPasta, type Bancada, type Programa } from "./bancada";

type Onde = "brain" | "recentes" | "outra";
const ABAS: { id: Onde; rotulo: string }[] = [
  { id: "brain", rotulo: "brain e repos" },
  { id: "recentes", rotulo: "recentes" },
  { id: "outra", rotulo: "outra pasta" },
];
const IAS: { id: Programa; rotulo: string }[] = [
  { id: "shell", rotulo: "shell" },
  { id: "claude", rotulo: "claude" },
  { id: "codex", rotulo: "codex" },
  { id: "agy", rotulo: "agy" },
  { id: "comando", rotulo: "comando…" },
];
const CLIS = ["claude", "codex", "agy"] as const;
type EstadoDaCli = "pronto" | "não instalado" | "conferindo…";

/** Memória por IA aberta e quantas cabem bem. A medir na sede (Parte F); hoje, os números do Mac. */
export const MB_POR_CLI = 250;
export const CONFORTAVEL = 3;

export function avisoDeMemoria(iasAbertas: number): string | null {
  if (iasAbertas < CONFORTAVEL) return null;
  return `Já há ${iasAbertas} IAs abertas. Com mais uma, são cerca de ${(iasAbertas + 1) * MB_POR_CLI} MB: nesta máquina ela começa a trocar memória com o disco.`;
}

const ESCAPAR = /([ '"\\()[\]{}$&;|<>*?!#~`])/g;

/** `cd <onde> && <o quê>`, como a folha do Mac mostra. */
export function comandoPorTras(o: { pasta: string; home: string; shell: string; programa: Programa; comando?: string }): string {
  const casa = o.home.replace(/\/+$/, "");
  const onde =
    o.pasta === casa ? "~" : o.pasta.startsWith(casa + "/") ? "~/" + o.pasta.slice(casa.length + 1).replace(ESCAPAR, "\\$1") : o.pasta.replace(ESCAPAR, "\\$1");
  const oque = linhaDaCli(o) ?? `${o.shell.split("/").pop()} -l`;
  return `cd ${onde} && ${oque}`;
}

export function FolhaNova(p: { bancada: Bancada; escuro: boolean; aberta: (id: string) => void; cancelar: () => void }) {
  const mao = p.bancada.mao;
  const home = mao.arquivos.home();
  const brain = mao.arquivos.brain();
  const [aba, setAba] = useState<Onde>("brain");
  const [pasta, setPasta] = useState(brain);
  const [outra, setOutra] = useState("");
  const [ia, setIa] = useState<Programa>("shell");
  const [comando, setComando] = useState("");
  const [nome, setNome] = useState("");
  const [filtro, setFiltro] = useState("");
  const [repos, setRepos] = useState<string[]>([]);
  const [recentes, setRecentes] = useState<string[]>([]);
  const [clis, setClis] = useState<Record<string, EstadoDaCli>>({ claude: "conferindo…", codex: "conferindo…", agy: "conferindo…" });
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void mao.arquivos.repos().then((r) => vivo && setRepos(r));
    void mao.arquivos.recentes().then((r) => vivo && setRecentes(r.slice(0, 8)));
    for (const c of CLIS) {
      void mao.cli.versao(c).then((r) => {
        if (vivo) setClis((x) => ({ ...x, [c]: "codigo" in r && r.codigo === 0 ? "pronto" : "esgotou" in r ? "conferindo…" : "não instalado" }));
      });
    }
    return () => {
      vivo = false;
    };
  }, [mao]);

  const lugares = useMemo(() => {
    const todos = [brain, ...repos];
    const f = filtro.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return todos.filter((x) => !f || x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(f)).slice(0, 9);
  }, [brain, repos, filtro]);

  const onde = aba === "outra" ? outra.trim().replace(/^~(?=\/|$)/, home) || brain : pasta;
  const ehAgente = ia === "claude" || ia === "codex" || ia === "agy";
  const ausente = ehAgente && clis[ia] === "não instalado";
  const iasAbertas = p.bancada.abertas().filter((s) => s.programa === "claude" || s.programa === "codex" || s.programa === "agy").length;
  const aviso = ausente
    ? "Esta CLI não está instalada neste computador. A instalação assistida chega com as ferramentas."
    : ehAgente
      ? avisoDeMemoria(iasAbertas)
      : null;
  const podeAbrir = !abrindo && !ausente && !(ia === "comando" && !comando.trim());

  const abrir = async () => {
    if (!podeAbrir) return;
    setAbrindo(true);
    const s = await p.bancada.abrir({ programa: ia, pasta: onde, nome, comando: ia === "comando" ? comando : undefined, escuro: p.escuro });
    p.aberta(s.id);
  };

  const nomeCurto = (x: string) => (x === brain ? "Brain" : x.split("/").pop() ?? x);

  return (
    <div
      className="pagina folha-nova"
      data-pagina="nova-sessao"
      onKeyDown={(e) => {
        if (e.key === "Escape") p.cancelar();
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") void abrir();
      }}
    >
      <div className="folha">
        <h1>Nova sessão</h1>
        <p className="explica">Uma sessão é uma IA trabalhando numa pasta. Você conversa com ela direto, na CLI.</p>

        <span className="rotulo-de-campo">1 · onde</span>
        <div className="segmentado" role="tablist" aria-label="Onde">
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? "seg ativo" : "seg"} onClick={() => setAba(a.id)}>
              {a.rotulo}
            </button>
          ))}
        </div>
        <div className="lugares">
          {aba === "brain" ? (
            <>
              <input className="campo" aria-label="filtrar" placeholder="filtrar: brain, atelie…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              <div className="lista-de-lugares">
                {lugares.length ? (
                  lugares.map((x) => (
                    <button key={x} type="button" aria-label={nomeCurto(x)} className={x === pasta ? "lugar ativo" : "lugar"} onClick={() => setPasta(x)}>
                      <span>{nomeCurto(x)}</span>
                    </button>
                  ))
                ) : (
                  <p className="explica">{repos.length ? "Nenhum repo com esse nome." : `Sem brain em ${nomeDaPasta(brain, home)}. Escolha a pasta em "outra pasta".`}</p>
                )}
              </div>
            </>
          ) : aba === "recentes" ? (
            <div className="lista-de-lugares">
              {recentes.length ? (
                recentes.map((x) => (
                  <button key={x} type="button" aria-label={nomeDaPasta(x, home)} className={x === pasta ? "lugar ativo" : "lugar"} onClick={() => setPasta(x)}>
                    <span>{nomeDaPasta(x, home)}</span>
                  </button>
                ))
              ) : (
                <p className="explica">Ainda não há sessões anteriores.</p>
              )}
            </div>
          ) : (
            <input className="campo mono" aria-label="pasta" placeholder="~/caminho/da/pasta" value={outra} onChange={(e) => setOutra(e.target.value)} />
          )}
        </div>
        <p className="vai-abrir">
          <span className="rotulo-de-campo">vai abrir em</span> <span className="mono acento">{nomeDaPasta(onde, home)}</span>
        </p>

        <span className="rotulo-de-campo">2 · qual ia</span>
        <div className="segmentado" role="radiogroup" aria-label="Qual IA">
          {IAS.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={ia === x.id} className={ia === x.id ? "seg ativo" : "seg"} onClick={() => setIa(x.id)}>
              {x.rotulo}
            </button>
          ))}
        </div>
        <div className="comando-livre">
          {ia === "comando" ? (
            <input className="campo mono" aria-label="comando" placeholder="npm run dev" value={comando} onChange={(e) => setComando(e.target.value)} />
          ) : null}
        </div>
        <p className="estado-das-clis mono" data-regiao="clis">
          {CLIS.map((c) => `${c}: ${clis[c]}`).join(" · ")} · a assinatura é sua
        </p>

        <span className="rotulo-de-campo">nome</span>
        <div className="nome-da-folha">
          <input className="campo" aria-label="nome" placeholder={nomeDaPasta(onde, home)} value={nome} onChange={(e) => setNome(e.target.value)} />
          <span className="mono explica">= pasta</span>
        </div>

        <span className="rotulo-de-campo">o comando por trás</span>
        <code className="comando-por-tras" data-regiao="comando">
          {comandoPorTras({ pasta: onde, home, shell: mao.cli.shell(), programa: ia, comando })}
        </code>

        <p className="aviso-da-folha" data-regiao="aviso-da-folha" aria-live="polite">
          {aviso ?? ""}
        </p>

        <div className="botoes fim">
          <button type="button" className="secundario" onClick={p.cancelar}>
            Cancelar
          </button>
          <button type="button" className="primario" disabled={!podeAbrir} onClick={() => void abrir()}>
            Abrir
          </button>
        </div>
      </div>
    </div>
  );
}
