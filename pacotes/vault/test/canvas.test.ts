import { describe, expect, it } from "vitest";
import { arquivoNoVault, escreverCanvas, lerCanvas } from "../src/index";
import { caso } from "./casos";

function abrir(texto: string): { texto: string } | { erro: string } {
  try {
    return { texto: escreverCanvas(lerCanvas(texto)) };
  } catch (e) {
    return { erro: (e as Error & { motivo?: string }).motivo ?? String(e) };
  }
}

describe("canvas", () => {
  it("CP-CNV-01 ler nunca vira vazio por engano e guarda a chave desconhecida", () => {
    const c = caso("CP-CNV-01");
    for (const [nome, texto] of Object.entries<string>(c.entrada.textos)) {
      expect(abrir(texto), nome).toEqual(c.esperado.textos[nome]);
    }
  });

  it("CP-CNV-02 escrita canônica", () => {
    const c = caso("CP-CNV-02");
    expect(abrir(c.entrada.texto)).toEqual({ texto: c.esperado.texto });
    // Gravar o que já é canônico não muda nada.
    expect(abrir(c.esperado.texto)).toEqual({ texto: c.esperado.texto });
  });

  it("CP-CNV-03 arquivo de nó fora do espaço é recusado", () => {
    const c = caso("CP-CNV-03");
    const caminhos: string[] = c.entrada.caminhos;
    expect(caminhos.filter((p) => arquivoNoVault(p) === null)).toEqual(c.esperado.recusados);
    expect(caminhos.filter((p) => arquivoNoVault(p) !== null)).toEqual(c.esperado.aceitos);
  });
});
