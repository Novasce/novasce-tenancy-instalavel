// A leitura da tela da sessão, como o Mac: as últimas 24 linhas do buffer do
// terminal, a cada 2 s. Serve ao xterm.js da tela e ao headless dos testes.

export interface BufferDeTerminal {
  buffer: { active: { length: number; getLine(y: number): { translateToString(trimRight?: boolean): string } | undefined } };
}

export const LINHAS_LIDAS = 24;
export const LER_A_CADA_MS = 2_000;
export const PROCESSOS_A_CADA_MS = 5_000;

/** As últimas linhas com texto do buffer, sem as vazias do fim. */
export function ultimasLinhas(t: BufferDeTerminal, quantas = LINHAS_LIDAS): string {
  const b = t.buffer.active;
  let fim = b.length;
  while (fim > 0 && !(b.getLine(fim - 1)?.translateToString(true) ?? "")) fim--;
  const linhas: string[] = [];
  for (let y = Math.max(0, fim - quantas); y < fim; y++) linhas.push(b.getLine(y)?.translateToString(true) ?? "");
  return linhas.join("\n");
}
