/** A versão do servidor é mais nova que a instalada? Número a número; parte que falta vale zero. Nunca desce. */
export function maisNova(servidor: string, instalada: string): boolean {
  const partes = (v: string) => v.split(/[.\-_+]/).filter(Boolean);
  const a = partes(servidor);
  const b = partes(instalada);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? "0";
    const y = b[i] ?? "0";
    const c = /^\d+$/.test(x) && /^\d+$/.test(y) ? Math.sign(Number(x) - Number(y)) : x.localeCompare(y, "en", { numeric: true });
    if (c !== 0) return c > 0;
  }
  return false;
}
