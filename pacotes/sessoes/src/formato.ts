// Formatos da casa usados nas frases das sessões.

/** "40 s", "12 min", "3 h", "3 h 05" (até 10 h), "14 h". */
export function duracao(segundos: number): string {
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (h < 10 && resto) return `${h} h ${String(resto).padStart(2, "0")}`;
  return `${h} h`;
}

/** "80 MB", ou "1,5 GB" a partir de 1024 MB. */
export function mb(valor: number): string {
  if (valor < 1024) return `${Math.round(valor)} MB`;
  return `${(valor / 1024).toFixed(1).replace(".", ",")} GB`;
}
