// Contas de calendário num fuso IANA, só com Intl (sem Node e sem biblioteca).

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const formatos = new Map<string, Intl.DateTimeFormat>();

function formato(fuso: string): Intl.DateTimeFormat {
  let f = formatos.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatos.set(fuso, f);
  }
  return f;
}

export function partesNoFuso(ms: number, fuso: string): Partes {
  const p: Record<string, number> = {};
  for (const { type, value } of formato(fuso).formatToParts(new Date(ms))) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute, segundo: p.second };
}

function comoUtc(p: Partes): number {
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
}

/** A hora local `p` no fuso, em milissegundos. */
export function deHoraLocal(p: Partes, fuso: string): number {
  const alvo = comoUtc(p);
  let t = alvo;
  for (let i = 0; i < 3; i++) {
    const deslocamento = comoUtc(partesNoFuso(t, fuso)) - t;
    const proximo = alvo - deslocamento;
    if (proximo === t) break;
    t = proximo;
  }
  return t;
}

/** Soma dias de calendário no fuso, mantendo a hora da parede. */
export function somarDias(ms: number, dias: number, fuso: string): number {
  const p = partesNoFuso(ms, fuso);
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + dias));
  return deHoraLocal({ ...p, ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() }, fuso);
}

/** AAAA-MM-DD no fuso. */
export function diaNoFuso(ms: number, fuso: string): string {
  const p = partesNoFuso(ms, fuso);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

/** HH:MM no fuso. */
export function horaNoFuso(ms: number, fuso: string): string {
  const p = partesNoFuso(ms, fuso);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}

function dois(n: number): string {
  return String(n).padStart(2, "0");
}
