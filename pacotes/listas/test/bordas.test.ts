import { describe, expect, it } from "vitest";
import { abrirLista, pressionar } from "../src/index";

describe("bordas da lista", () => {
  it("Esc com a busca vazia não mexe na seleção", () => {
    let lista = abrirLista({
      nome: "x",
      itens: [{ id: "a", titulo: "A", espaco: "E" }],
      acesso: ["E"],
      relogio: "2026-10-28T09:00:00-03:00",
      fuso: "America/Maceio",
    });
    lista = pressionar(lista, " ").lista;
    const r = pressionar(lista, "Escape");
    expect(r.lista.selecao).toEqual(["a"]);
    expect(r.aviso).toBeUndefined();
  });
});
