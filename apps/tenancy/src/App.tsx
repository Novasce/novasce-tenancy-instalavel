import { useEffect, useMemo, useState } from "react";
import { Bancada } from "./bancada/bancada";
import { Ajustes } from "./casca/Ajustes";
import { EstadoDaTela } from "./casca/estado";
import { Lateral, type Pagina } from "./casca/Lateral";
import type { Escolhas, Preferencias } from "./casca/preferencias";
import type { MaoDoHost } from "./mao/tipos";

export function App(p: { mao: MaoDoHost; preferencias: Preferencias; bancada?: Bancada }) {
  const bancada = useMemo(() => p.bancada ?? new Bancada(p.mao), [p.bancada, p.mao]);
  const [escolhas, setEscolhas] = useState<Escolhas>(() => p.preferencias.ler());
  const [pagina, setPagina] = useState<Pagina>("agentes");

  useEffect(() => {
    document.documentElement.dataset.tema = escolhas.tema;
  }, [escolhas.tema]);

  const mudar = (e: Escolhas) => {
    p.preferencias.gravar(e);
    setEscolhas(e);
  };

  const sessoesVisiveis = escolhas.modoAvancado;
  const atual: Pagina = !sessoesVisiveis && pagina !== "agentes" && pagina !== "ajustes" ? "agentes" : pagina;

  return (
    <div className="janela">
      <Lateral pagina={atual} ir={setPagina} modoAvancado={escolhas.modoAvancado} bancada={bancada} espaco="Brain" conta="lia" />
      <main className="conteudo">
        {atual === "ajustes" ? (
          <Ajustes escolhas={escolhas} mudar={mudar} bancada={bancada} />
        ) : atual === "agentes" ? (
          <div className="pagina" data-pagina="agentes">
            <EstadoDaTela estado="carregando" titulo="Abrindo os agentes" texto="A página dos agentes do Tenancy abre numa janela própria." />
          </div>
        ) : (
          <div className="pagina" data-pagina={atual}>
            <EstadoDaTela estado="vazio" titulo="Nenhuma sessão aberta" texto="Abra uma sessão de Claude Code, Codex, agy ou do terminal." />
          </div>
        )}
      </main>
    </div>
  );
}
