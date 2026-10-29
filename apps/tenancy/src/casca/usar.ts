import { useEffect, useReducer } from "react";
import type { Bancada } from "../bancada/bancada";

/** Redesenha quando a Bancada muda. */
export function useBancada(bancada: Bancada): Bancada {
  const [, mudou] = useReducer((n: number) => n + 1, 0);
  useEffect(() => bancada.ouvir(mudou), [bancada]);
  return bancada;
}
