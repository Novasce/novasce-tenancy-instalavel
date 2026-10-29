// Os seis estados de toda tela (UC53), de um componente só e numa área
// reservada: trocar de estado nunca muda a geometria em volta.
export const ESTADOS_DA_TELA = ["carregando", "vazio", "erro", "sem-permissao", "offline", "desatualizado"] as const;
export type EstadoDaTelaId = (typeof ESTADOS_DA_TELA)[number];

export function EstadoDaTela(p: {
  estado: EstadoDaTelaId;
  titulo: string;
  texto: string;
  acao?: { rotulo: string; fazer: () => void };
}) {
  return (
    <section className="estado-da-tela" data-regiao="estado" data-estado={p.estado} aria-live="polite" aria-busy={p.estado === "carregando"}>
      <div className="estado-marca" aria-hidden="true" />
      <strong>{p.titulo}</strong>
      <p>{p.texto}</p>
      <div className="estado-acao">
        {p.acao ? (
          <button type="button" className="secundario" onClick={p.acao.fazer}>
            {p.acao.rotulo}
          </button>
        ) : null}
      </div>
    </section>
  );
}
