// As faixas da sessão (UC20, UC22, decisão 11), uma por vez, numa área própria
// acima do terminal. Rótulo, texto numa linha e botões de 76 px, como o Mac.
import { useState } from "react";
import { nomeDaPasta, type Bancada, type SessaoDaBancada } from "./bancada";
import { abrirPR, mesclar, NOME_DO_PROGRAMA, opcoesDeRetomar, quandoFechou } from "./guardas";

interface Botao {
  rotulo: string;
  fazer: () => Promise<void> | void;
  primario?: boolean;
}

export function Faixa(p: { rotulo: string; texto: string; botoes: Botao[]; cor?: "ambar" | "acento"; regiao?: string }) {
  const [ocupada, setOcupada] = useState(false);
  return (
    <div className={`faixa ${p.cor ?? "ambar"}`} data-regiao={p.regiao ?? "faixa"}>
      <span className="rotulo-da-faixa">{p.rotulo}</span>
      <span className="texto-da-faixa" title={p.texto}>
        {p.texto}
      </span>
      {p.botoes.map((b) => (
        <button
          key={b.rotulo}
          type="button"
          className={b.primario ? "botao-da-faixa primario" : "botao-da-faixa"}
          disabled={ocupada}
          onClick={async () => {
            setOcupada(true);
            try {
              await b.fazer();
            } finally {
              setOcupada(false);
            }
          }}
        >
          {b.rotulo}
        </button>
      ))}
    </div>
  );
}

function plural(n: number, um: string, varios: string) {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`;
}

export function FaixasDaSessao({ bancada, s }: { bancada: Bancada; s: SessaoDaBancada }) {
  const p = s.pendencia;
  if (!p) return null;
  const home = bancada.mao.arquivos.home();
  const nomeDoAgente = NOME_DO_PROGRAMA[s.programa];
  const abrirDiff = () =>
    void bancada.abrir({ programa: "comando", pasta: s.pasta, nome: `diff · ${s.pasta.split("/").pop()}`, comando: "git status; git --no-pager diff --stat; exec $SHELL -l" });

  if (p.tipo === "fora-da-main" && s.worktree) {
    const w = s.worktree;
    const partes = [`${plural(p.commits, "commit", "commits")} fora da main`];
    if (s.terminal && nomeDoAgente) partes.push(`o ${nomeDoAgente} sai junto`);
    partes.push(w.branch);
    return (
      <Faixa
        rotulo="fora da main"
        texto={partes.join(" · ")}
        botoes={[
          { rotulo: "abrir PR", primario: true, fazer: async () => void ((await abrirPR(bancada, w.repo, w.branch)) && (await bancada.encerrarDeixando(s.id))) },
          { rotulo: "mesclar", fazer: async () => void ((await mesclar(bancada, w.repo, w.branch)) && (await bancada.encerrar([s.id]))) },
          { rotulo: "deixar", fazer: () => bancada.encerrarDeixando(s.id) },
          { rotulo: "ficar", fazer: () => bancada.ficar(s.id) },
        ]}
      />
    );
  }
  if (p.tipo === "sem-commit") {
    return (
      <Faixa
        rotulo="sem commit"
        texto={`${plural(p.soltos, "arquivo mudado", "arquivos mudados")} em ${nomeDaPasta(s.pasta, home)} e nenhum commit. Fechar mesmo assim?`}
        botoes={[
          { rotulo: "ver o diff", fazer: abrirDiff },
          { rotulo: "fechar", primario: true, fazer: () => bancada.encerrarDeixando(s.id) },
          { rotulo: "ficar", fazer: () => bancada.ficar(s.id) },
        ]}
      />
    );
  }
  if (p.tipo === "encerrar") {
    return (
      <Faixa
        rotulo="encerrar"
        texto={`Encerrar o ${nomeDoAgente ?? s.programa} desta aba?`}
        botoes={[
          { rotulo: "encerrar", primario: true, fazer: async () => void (await bancada.encerrar([s.id])) },
          { rotulo: "ficar", fazer: () => bancada.ficar(s.id) },
        ]}
      />
    );
  }
  if (p.tipo === "retomar") {
    return (
      <Faixa
        rotulo="retomar"
        texto={`${s.programa} · ${quandoFechou(bancada.agora() - p.fechadaEm)}, quando o app fechou. Retomar devolve a conversa onde estava.`}
        botoes={[
          {
            rotulo: "retomar onde parou",
            primario: true,
            fazer: async () => {
              const opcoes = await opcoesDeRetomar(bancada, s.programa);
              if (!opcoes) bancada.recado(`O ${s.programa} deste computador não aceitou retomar: a sessão abriu do zero.`, true);
              await bancada.reabrir(s.id, opcoes ?? undefined);
            },
          },
          { rotulo: "começar do zero", fazer: () => bancada.reabrir(s.id) },
        ]}
      />
    );
  }
  return (
    <Faixa
      rotulo="do disco"
      cor="acento"
      texto={`${s.programa === "comando" ? (s.comando ?? "comando") : s.programa} em ${nomeDaPasta(s.pasta, home)} veio de volta. Abrir de novo?`}
      botoes={[{ rotulo: "abrir", primario: true, fazer: () => bancada.reabrir(s.id) }]}
    />
  );
}
