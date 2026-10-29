// Leitor pequeno dos casos de prova deste pacote: só as pastas que ele confere.
export interface CasoDeProva<E = any, S = any> {
  id: string;
  contrato: string;
  regra: string;
  relogio: string;
  fuso: string;
  entrada: E;
  esperado: S;
  mac: string;
}

const todos = import.meta.glob(
  [
    "../../../casos-de-prova/vault/*.json",
    "../../../casos-de-prova/espacos/*.json",
    "../../../casos-de-prova/canvas/*.json",
    "../../../casos-de-prova/links/*.json",
  ],
  { eager: true, import: "default" },
) as Record<string, CasoDeProva>;

export function caso<E = any, S = any>(id: string): CasoDeProva<E, S> {
  const achado = Object.values(todos).find((c) => c.id === id);
  if (!achado) throw new Error(`caso ${id} não está em casos-de-prova/`);
  return achado as CasoDeProva<E, S>;
}
