// Para continuar (RC01, VL09): o prompt pronto para uma sessão nova, lido de
// continuar/ do brain e dos espaços. Abrir move para continuados antes da CLI
// subir; copiar não move; em espera fica à parte, sem abrir.
import {
  abrirPasta,
  avisoDaAbertura,
  conferirAjuda,
  copiarPrompt,
  lerLeia,
  listarParaContinuar,
  modeloDoLeia,
  moverSemSobrescrever,
  nomeDe,
  ondeParou,
  opcoesDaCli,
  oQueEspera,
  textoDoAviso,
  type Motor,
  type PastaParaContinuar,
} from "@novasce/pastas";
import { useState } from "react";
import type { Bancada } from "../bancada/bancada";
import { useBancada } from "../casca/usar";

type Aba = "a-continuar" | "continuados" | "em-espera";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "a-continuar", rotulo: "A continuar" },
  { id: "continuados", rotulo: "Continuados" },
  { id: "em-espera", rotulo: "Em espera" },
];
const MOTORES: Motor[] = ["claude", "codex", "agy"];
const NOME: Record<Motor, string> = { claude: "Claude", codex: "Codex", agy: "agy" };

function Cartao(p: { bancada: Bancada; pasta: PastaParaContinuar; aberta: (id: string) => void; mudou: () => void }) {
  const mao = p.bancada.mao;
  const arquivos = mao.arquivos.arquivos();
  const leia = lerLeia(arquivos.ler(`${p.pasta.caminho}/LEIA.txt`) ?? "");
  const [abrindo, setAbrindo] = useState(false);
  const [motor, setMotor] = useState<Motor>("claude");
  const [ocupado, setOcupado] = useState(false);
  const modelo = modeloDoLeia(leia, motor);
  const espera = oQueEspera(leia);

  const abrir = async () => {
    setOcupado(true);
    try {
      const escolha = { modelo: modelo?.modelo ?? null, esforco: modelo?.esforco ?? null };
      let opcoesDoMotor: string[] = [];
      const r = await abrirPasta(arquivos, {
        brain: p.pasta.brain,
        pasta: p.pasta.caminho,
        app: "Tenancy",
        cliExiste: async () => {
          const v = await mao.cli.versao(motor);
          return "codigo" in v && v.codigo === 0;
        },
        iniciar: async (prompt) => {
          const aceita = await conferirAjuda(motor, motor, () => mao.cli.ajuda(motor));
          const aviso = avisoDaAbertura(escolha, aceita);
          if (aviso) p.bancada.recado(textoDoAviso(aviso, motor), true);
          opcoesDoMotor = opcoesDaCli(motor, escolha, aceita);
          const s = await p.bancada.abrir({
            programa: motor,
            pasta: p.pasta.brain,
            nome: nomeDe(p.pasta.caminho),
            opcoes: [...opcoesDoMotor, ...(motor === "agy" ? ["-i"] : []), prompt],
          });
          s.origem = `${p.pasta.brain}/continuar/continuados/${nomeDe(p.pasta.caminho)}`;
          p.aberta(s.id);
          return true;
        },
      });
      if (!r.abriu) {
        const texto = {
          "sem-prompt": "O prompt.txt desta pasta está vazio: nada para abrir.",
          "prompt-grande": "O prompt.txt passa de 256 KB: abra a sessão e cole o que precisar.",
          "cli-ausente": `O ${motor} não está instalado neste computador. A instalação assistida chega com as ferramentas.`,
          "nao-moveu": "A pasta não saiu de a-continuar: a sessão não abriu.",
          "sessao-falhou": "A sessão não abriu; a pasta voltou para a-continuar.",
        }[r.motivo!];
        p.bancada.recado(texto, true);
      }
    } finally {
      setOcupado(false);
      setAbrindo(false);
      p.mudou();
    }
  };

  const voltar = () => {
    const destino = moverSemSobrescrever(arquivos, p.pasta.caminho, `${p.pasta.brain}/continuar/a-continuar`);
    const aberta = p.bancada.abertas().find((s) => s.origem === p.pasta.caminho);
    p.bancada.recado(
      aberta
        ? `A sessão ${aberta.nome} segue aberta; a pasta voltou para a-continuar como ${nomeDe(destino)}.`
        : `A pasta voltou para a-continuar como ${nomeDe(destino)}.`,
      false,
    );
    p.mudou();
  };

  return (
    <article className="cartao-continuar" data-pasta={p.pasta.caminho}>
      <strong className="titulo">{p.pasta.nome}</strong>
      <p className="explica" data-regiao="onde-parou">
        {(p.pasta.ondeParou ?? ondeParou(leia)).join(" ")}
      </p>
      {espera.length ? (
        <ul className="espera" data-regiao="espera">
          {espera.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {p.pasta.estado === "a-continuar" ? (
        <p className="mono" data-regiao="modelo">
          {modelo ? `${NOME[motor]}: ${modelo.rotulo}${modelo.esforco ? ` · esforço ${modelo.esforco}` : ""}` : `${NOME[motor]}: padrão da CLI`}
        </p>
      ) : null}
      <div className="linha botoes">
        {p.pasta.estado === "a-continuar" ? (
          abrindo ? (
            <>
              <div className="segmentado" role="radiogroup" aria-label="Qual IA">
                {MOTORES.map((x) => (
                  <button key={x} type="button" role="radio" aria-checked={motor === x} className={motor === x ? "seg ativo" : "seg"} onClick={() => setMotor(x)}>
                    {x}
                  </button>
                ))}
              </div>
              <button type="button" className="secundario" onClick={() => setAbrindo(false)}>
                Cancelar
              </button>
              <button type="button" className="primario" disabled={ocupado} onClick={() => void abrir()}>
                Abrir
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  void mao.copiar(copiarPrompt(arquivos, p.pasta.caminho));
                  p.bancada.recado("Prompt copiado. A pasta não saiu do lugar.", false);
                }}
              >
                Copiar prompt
              </button>
              <button
                type="button"
                className="primario"
                onClick={() => {
                  setMotor("claude");
                  setAbrindo(true);
                }}
              >
                Abrir…
              </button>
            </>
          )
        ) : p.pasta.estado === "continuados" ? (
          <button type="button" className="secundario" onClick={voltar}>
            Voltar para a-continuar
          </button>
        ) : (
          <button
            type="button"
            className="secundario"
            onClick={() => {
              void mao.copiar(copiarPrompt(arquivos, p.pasta.caminho));
              p.bancada.recado("Prompt copiado. A pasta não saiu do lugar.", false);
            }}
          >
            Copiar prompt
          </button>
        )}
      </div>
    </article>
  );
}

export function ParaContinuar(p: { bancada: Bancada; aberta: (id: string) => void }) {
  useBancada(p.bancada);
  const [aba, setAba] = useState<Aba>("a-continuar");
  const [, mudou] = useState(0);
  const mao = p.bancada.mao;
  const lista = listarParaContinuar(mao.arquivos.arquivos(), [mao.arquivos.brain(), ...mao.arquivos.espacos()], mao.arquivos.home());
  const daAba = aba === "a-continuar" ? lista.aContinuar : aba === "continuados" ? lista.continuados : lista.emEspera;
  const quantos: Record<Aba, number> = { "a-continuar": lista.aContinuar.length, continuados: lista.continuados.length, "em-espera": lista.emEspera.length };
  return (
    <div className="pagina para-continuar" data-pagina="para-continuar">
      <h1>Para continuar</h1>
      <p className="explica">continuar/ do brain: o prompt pronto para seguir numa sessão nova.</p>
      <div className="segmentado abas-largas" role="tablist" aria-label="Para continuar">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} aria-label={a.rotulo} className={aba === a.id ? "seg ativo" : "seg"} onClick={() => setAba(a.id)}>
            <span className="rotulo-reservado" data-rotulo={a.rotulo}>
              {a.rotulo}
            </span>
            <span className="contador">{quantos[a.id]}</span>
          </button>
        ))}
      </div>
      {daAba.length === 0 ? (
        <div className="estado-da-tela" data-estado="vazio">
          <div className="estado-marca" aria-hidden="true" />
          <strong>{aba === "a-continuar" ? "Nada para continuar." : aba === "em-espera" ? "Nada em espera." : "Nada retomado ainda."}</strong>
          <p>{aba === "a-continuar" ? "Quando uma sessão para no meio, o prompt dela aparece aqui." : ""}</p>
          <div />
        </div>
      ) : (
        <div className="cartoes-continuar">
          {daAba.map((x) => (
            <Cartao key={x.caminho} bancada={p.bancada} pasta={x} aberta={p.aberta} mudou={() => mudou((n) => n + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}
