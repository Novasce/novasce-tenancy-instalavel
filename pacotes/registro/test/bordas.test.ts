import { describe, expect, it } from "vitest";
import { aplicar, desfazer, type Entrada, venceEm } from "../src/index";

describe("bordas do registro", () => {
  it("30 dias de calendário atravessam a troca de horário do fuso", () => {
    // Em Lisboa a hora muda em 25/10/2026: 10:00 local continua 10:00 local.
    const item = { id: "n1", tipo: "nota" as const, espaco: "Pessoal", origem: "Pessoal/Notas/x.md", apagadoEm: "2026-10-01T10:00:00+01:00" };
    expect(venceEm(item, "Europe/Lisbon").toISOString()).toBe("2026-10-31T10:00:00.000Z");
  });

  it("desfazer recusa quando o arquivo mudou depois da ação", () => {
    const e: Entrada = {
      id: "a1",
      hora: "2026-10-28T09:00:00-03:00",
      autor: "Lia Pereira",
      acao: "editar",
      titulo: "Editou Plano",
      mudancas: [{ caminho: "Plano.md", antes: "a\n", depois: "b\n" }],
    };
    const volta = desfazer([e], "a1", "2026-10-28T09:10:00-03:00", "Lia Pereira");
    expect(() => aplicar({ "Plano.md": "c\n" }, volta)).toThrow(/mudou desde/);
    expect(aplicar({ "Plano.md": "b\n" }, volta)).toEqual({ "Plano.md": "a\n" });
  });

  it("irreversível não desfaz", () => {
    const e: Entrada = { id: "a1", hora: "2026-10-28T09:00:00-03:00", autor: "Lia Pereira", acao: "esvaziar-lixeira", titulo: "Esvaziou", mudancas: [] };
    expect(() => desfazer([e], "a1", "2026-10-28T09:00:01-03:00", "Lia Pereira")).toThrow(/não tem Desfazer/);
  });
});

describe("exportar", () => {
  it("título com cara de fórmula não vira fórmula no CSV", async () => {
    const { exportar } = await import("../src/index");
    const e = { id: "a1", hora: "2026-10-28T09:00:00-03:00", autor: "Lia Pereira", acao: "editar" as const, titulo: "=SOMA(A1)", mudancas: [] };
    expect(exportar([e], "csv", "2026-10-28", "2026-10-28", "America/Maceio").conteudo).toContain("'=SOMA(A1)");
  });
});
