// O ponto de estado, sempre 12 × 12: o estado muda a cor e o traço, nunca o tamanho.
import { ROTULO_DO_ESTADO, type EstadoDaSessao } from "./bancada";

export function Ponto({ estado }: { estado: EstadoDaSessao }) {
  return <span className="ponto" data-estado={estado} role="img" aria-label={ROTULO_DO_ESTADO[estado]} />;
}
