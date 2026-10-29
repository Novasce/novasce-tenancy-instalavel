// Leitor pequeno dos casos de prova deste pacote. O formato completo é
// conferido pelo pacote casos; aqui só o mínimo para rodar cada caso.
export interface Caso<E = any, S = any> {
  id: string;
  contrato: string;
  regra: string;
  relogio: string;
  fuso: string;
  entrada: E;
  esperado: S;
  mac: string;
}

const CAMPOS = ["id", "contrato", "regra", "relogio", "fuso", "entrada", "esperado", "mac"];

export function lerCasos(arquivos: Record<string, unknown>, prefixo: string): Caso[] {
  const casos = Object.entries(arquivos).map(([caminho, bruto]) => {
    const caso = bruto as Record<string, unknown>;
    for (const campo of CAMPOS) {
      if (!(campo in caso)) throw new Error(`${caminho}: falta o campo ${campo}`);
    }
    if (!caminho.endsWith(`/${caso.id}.json`)) throw new Error(`${caminho}: o nome não bate com o id ${caso.id}`);
    return caso as unknown as Caso;
  });
  const fora = casos.filter((c) => !c.id.startsWith(prefixo));
  if (fora.length) throw new Error(`casos fora de ${prefixo}: ${fora.map((c) => c.id).join(", ")}`);
  return casos.sort((a, b) => a.id.localeCompare(b.id));
}

export function idsEsperados(prefixo: string, ate: number): string[] {
  return Array.from({ length: ate }, (_, i) => `${prefixo}${String(i + 1).padStart(2, "0")}`);
}
