// Trabalho fora da main: branches de sessão com commit que a main não tem
// (CP-GIT-09). Atualiza ao abrir, a cada 5 min e depois de cada ação.
import { duracao } from "@novasce/sessoes";
import { useState } from "react";
import { nomeDaPasta, type Bancada } from "./bancada";
import { abrirPR, mesclar, type ForaDaMain } from "./guardas";

export const ATUALIZAR_FORA_DA_MAIN_MS = 300_000;

export function TelaForaDaMain(p: { bancada: Bancada; lista: ForaDaMain[]; atualizar: () => Promise<void> }) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const home = p.bancada.mao.arquivos.home();
  const chave = (b: ForaDaMain) => `${b.repo}|${b.nome}`;
  const verCommits = (b: ForaDaMain) =>
    void p.bancada.abrir({
      programa: "comando",
      pasta: b.repo,
      nome: `${b.nome} · ${b.repo.split("/").pop()}`,
      comando: `git --no-pager log --oneline --stat 'main..${b.nome}'; exec $SHELL -l`,
    });
  return (
    <div className="pagina fora-da-main" data-pagina="fora-da-main">
      <h1>Trabalho fora da main</h1>
      <p className="explica">Branches de sessão com commit que a main não tem. Nada aqui some sozinho.</p>
      {p.lista.length === 0 ? (
        <div className="estado-da-tela" data-estado="vazio">
          <div className="estado-marca" aria-hidden="true" />
          <strong>Nada fora da main.</strong>
          <p>Quando uma sessão em worktree fecha com commit e a branch fica, ela aparece aqui.</p>
          <div />
        </div>
      ) : (
        <div className="cartoes-fora">
          {p.lista.map((b) => (
            <article key={chave(b)} className="cartao-fora" data-branch={b.nome}>
              <div className="linha">
                <span className="etiqueta-ambar">{b.commitsForaDaMain === 1 ? "1 commit" : `${b.commitsForaDaMain} commits`}</span>
                <strong className="mono-forte">{b.nome}</strong>
                <span className="explica">{nomeDaPasta(b.repo, home)}</span>
                <span className="espaco-flex" />
                <span className="mono">último há {duracao(p.bancada.agora() / 1000 - (b.data ?? 0))}</span>
              </div>
              <p className="explica">
                <span className="mono">último commit</span> {b.assunto || "sem assunto"}
              </p>
              <div className="linha">
                {confirmar === chave(b) ? (
                  <>
                    <span className="texto-da-faixa">{`Mesclar ${b.nome} na main de ${nomeDaPasta(b.repo, home)}?`}</span>
                    <button type="button" className="secundario" onClick={() => setConfirmar(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="primario"
                      title="Merge commit na pasta principal do repo, só quando ela está na main e limpa. Não manda para o GitHub."
                      onClick={async () => {
                        setConfirmar(null);
                        await mesclar(p.bancada, b.repo, b.nome);
                        await p.atualizar();
                      }}
                    >
                      Mesclar
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="secundario" onClick={() => verCommits(b)}>
                      Ver os commits
                    </button>
                    <span className="espaco-flex" />
                    <button
                      type="button"
                      className="secundario"
                      title="Merge commit na pasta principal do repo, sem PR e sem revisão. Pede um segundo clique."
                      onClick={() => setConfirmar(chave(b))}
                    >
                      Mesclar na main
                    </button>
                    <button
                      type="button"
                      className="primario"
                      title="Manda a branch para o GitHub e abre a página do PR. O PR é você quem cria, lá."
                      onClick={async () => {
                        await abrirPR(p.bancada, b.repo, b.nome);
                        await p.atualizar();
                      }}
                    >
                      Abrir PR
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
