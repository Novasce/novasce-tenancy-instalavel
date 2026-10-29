import { ehDia } from "./nome";

/** O dia (AAAA-MM-DD) de um instante no fuso dado. */
export function hojeNoFuso(instante: string, fuso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(instante));
  const de = (t: string) => partes.find((p) => p.type === t)!.value;
  return `${de("year")}-${de("month")}-${de("day")}`;
}

const DIA_MS = 86_400_000;
const emUtc = (dia: string) => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)));

/** Dias de segunda a sexta depois do envio, até hoje inclusive. Feriado conta como útil. */
export function diasUteis(enviadaEm: string, hoje: string): number | null {
  if (!ehDia(enviadaEm) || !ehDia(hoje)) return null;
  let n = 0;
  for (let t = emUtc(enviadaEm) + DIA_MS; t <= emUtc(hoje); t += DIA_MS) {
    const semana = new Date(t).getUTCDay();
    if (semana !== 0 && semana !== 6) n++;
  }
  return n;
}

export function cobrar(estado: string, enviadaEm: string | null, hoje: string, prazo = 3): boolean {
  if (estado !== "aguardando-resposta" || !enviadaEm) return false;
  const n = diasUteis(enviadaEm, hoje);
  return n !== null && n >= Math.max(1, prazo);
}

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** O lembrete de cobrança, sem travessão. */
export function lembrete(pessoa: string, enviadaEm: string | null): string {
  if (!enviadaEm || !ehDia(enviadaEm)) return `Oi, ${pessoa}! Voltando à minha mensagem. Conseguiu ver? Fico no aguardo.`;
  const dia = SEMANA[new Date(emUtc(enviadaEm)).getUTCDay()];
  return `Oi, ${pessoa}! Voltando à minha mensagem de ${dia}, ${enviadaEm.slice(8, 10)}/${enviadaEm.slice(5, 7)}. Conseguiu ver? Fico no aguardo.`;
}
