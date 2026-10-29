// Qual mão o app usa. Na Parte E só existe a de ensaio; a do caminho escolhido
// pelos portões (Flatpak, ajudante ou direta) entra na Parte F, aqui.
import { maoDeEnsaio } from "./ensaio";
import type { MaoDoHost } from "./tipos";

export type { MaoDoHost } from "./tipos";

export function maoDoApp(): MaoDoHost {
  return maoDeEnsaio();
}
