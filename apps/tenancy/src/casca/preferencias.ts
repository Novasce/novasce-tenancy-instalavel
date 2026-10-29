// As escolhas da pessoa neste computador: modo avançado e tema. Guardadas na
// janela local; leitura que falha volta ao de fábrica.
export type Tema = "claro" | "escuro" | "sistema";

export interface Escolhas {
  /** De fábrica desligado (IN04): sem Bancada. */
  modoAvancado: boolean;
  tema: Tema;
}

export const DE_FABRICA: Escolhas = { modoAvancado: false, tema: "claro" };

export interface Preferencias {
  ler(): Escolhas;
  gravar(e: Escolhas): void;
}

const CHAVE = "tenancy.escolhas";

function validas(bruto: unknown): Escolhas {
  const e = (bruto ?? {}) as Partial<Escolhas>;
  return {
    modoAvancado: e.modoAvancado === true,
    tema: e.tema === "escuro" || e.tema === "sistema" ? e.tema : "claro",
  };
}

export function preferenciasNaMemoria(inicial: Partial<Escolhas> = {}): Preferencias {
  let atual = validas({ ...DE_FABRICA, ...inicial });
  return {
    ler: () => atual,
    gravar: (e) => {
      atual = validas(e);
    },
  };
}

export function preferenciasDoNavegador(): Preferencias {
  return {
    ler() {
      try {
        return validas(JSON.parse(localStorage.getItem(CHAVE) ?? "null"));
      } catch {
        return DE_FABRICA;
      }
    },
    gravar(e) {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(validas(e)));
      } catch {
        // Sem armazenamento, a escolha vale até fechar.
      }
    },
  };
}
