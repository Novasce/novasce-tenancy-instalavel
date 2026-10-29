// O teclado da lista como tabela de tecla para ação. Delete só arquiva, que é
// reversível; nenhuma tecla apaga permanente. Ctrl no lugar do ⌘ do Mac.

import { type Lista, trocarBusca, visiveis } from "./lista";

export type AcaoDeTecla =
  | "foco-acima"
  | "foco-abaixo"
  | "abrir"
  | "selecionar"
  | "estender-acima"
  | "estender-abaixo"
  | "arquivar"
  | "desfazer"
  | "ir-a-busca"
  | "limpar-busca";

const TECLAS: Record<string, AcaoDeTecla> = {
  ArrowUp: "foco-acima",
  ArrowDown: "foco-abaixo",
  Enter: "abrir",
  " ": "selecionar",
  "Shift+ArrowUp": "estender-acima",
  "Shift+ArrowDown": "estender-abaixo",
  Delete: "arquivar",
  "Shift+Delete": "arquivar",
  "Ctrl+Shift+Delete": "arquivar",
  "Ctrl+Z": "desfazer",
  "/": "ir-a-busca",
  Escape: "limpar-busca",
};

/** Ações que apagariam sem volta. Nenhuma tecla da tabela leva a elas. */
export const ACOES_QUE_APAGAM: readonly string[] = ["apagar-permanente", "esvaziar-lixeira"];

export function acaoDaTecla(tecla: string): AcaoDeTecla | null {
  return TECLAS[tecla] ?? null;
}

export type Efeito =
  | { tipo: "abrir"; id: string }
  | { tipo: "arquivar"; ids: string[] }
  | { tipo: "desfazer" }
  | { tipo: "ir-a-busca" };

export interface Pressionado {
  lista: Lista;
  efeito?: Efeito;
  aviso?: string;
}

export function pressionar(lista: Lista, tecla: string): Pressionado {
  const acao = acaoDaTecla(tecla);
  const itens = visiveis(lista);
  const ultimo = Math.max(itens.length - 1, 0);
  const foco = Math.min(lista.foco, ultimo);
  const focado = itens[foco];
  switch (acao) {
    case null:
      return { lista };
    case "foco-acima":
      return { lista: { ...lista, foco: Math.max(foco - 1, 0) } };
    case "foco-abaixo":
      return { lista: { ...lista, foco: Math.min(foco + 1, ultimo) } };
    case "abrir":
      return focado ? { lista, efeito: { tipo: "abrir", id: focado.id } } : { lista };
    case "selecionar": {
      if (!focado) return { lista };
      const tinha = lista.selecao.includes(focado.id);
      const selecao = tinha ? lista.selecao.filter((id) => id !== focado.id) : [...lista.selecao, focado.id];
      return { lista: { ...lista, selecao: naOrdem(selecao, itens), ancora: focado.id, foco } };
    }
    case "estender-acima":
    case "estender-abaixo": {
      if (!focado) return { lista };
      const novoFoco = acao === "estender-acima" ? Math.max(foco - 1, 0) : Math.min(foco + 1, ultimo);
      const ancora = lista.ancora ?? focado.id;
      const de = Math.max(itens.findIndex((i) => i.id === ancora), 0);
      const [a, b] = de <= novoFoco ? [de, novoFoco] : [novoFoco, de];
      return { lista: { ...lista, selecao: itens.slice(a, b + 1).map((i) => i.id), ancora, foco: novoFoco } };
    }
    case "arquivar": {
      // Um lote só, com um Desfazer. Sem seleção, arquiva o focado.
      const ids = lista.selecao.length ? lista.selecao : focado ? [focado.id] : [];
      if (!ids.length) return { lista };
      return { lista: { ...lista, selecao: [], ancora: null }, efeito: { tipo: "arquivar", ids } };
    }
    case "desfazer":
      return { lista, efeito: { tipo: "desfazer" } };
    case "ir-a-busca":
      return { lista, efeito: { tipo: "ir-a-busca" } };
    case "limpar-busca": {
      const r = trocarBusca(lista, "");
      return { lista: r.lista, aviso: r.aviso };
    }
  }
}

function naOrdem(ids: string[], itens: { id: string }[]): string[] {
  const pos = new Map(itens.map((i, n) => [i.id, n]));
  return [...ids].sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
}
