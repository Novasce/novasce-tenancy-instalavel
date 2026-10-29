import { describe, expect, it } from "vitest";
import { HABILIDADES, ROTINAS_DO_DIA, escolherDia, lerRotina, pedidoDoDia, prepararODia, rotinaParaMarkdown } from "../src/index";

interface CasoDeProva {
  id: string;
  entrada: any;
  esperado: any;
}

const todos = import.meta.glob("../../../casos-de-prova/dia/*.json", { eager: true, import: "default" }) as Record<string, CasoDeProva>;
function caso(id: string): CasoDeProva {
  const c = Object.values(todos).find((x) => x.id === id);
  if (!c) throw new Error(`caso ${id} não está em casos-de-prova/dia/`);
  return c;
}

describe("o dia pela ficha e pelo papel", () => {
  for (const id of ["CP-DIA-01", "CP-DIA-02", "CP-DIA-07"]) {
    it(`${id} a ficha escolhe o dia e o Pessoal recebe a rotina e as habilidades`, () => {
      const c = caso(id);
      const dia = escolherDia(c.entrada.pessoa, c.entrada.founder);
      expect(dia).toBe(c.esperado.dia);
      const r = prepararODia(c.entrada.pessoal, dia);
      expect(r.arquivos).toEqual(c.esperado.arquivos);
      expect(r.nasceram).toEqual(c.esperado.nasceram);
      expect(r.gravouODia).toBe(c.esperado.gravouODia);
    });
  }

  it("CP-DIA-03 sem ficha, pelo papel; o founder só pelo id fixo", () => {
    const c = caso("CP-DIA-03");
    expect(c.entrada.pessoas.map((p: any) => escolherDia(p, c.entrada.founder))).toEqual(c.esperado.dias);
  });

  it("CP-DIA-04 o que a pessoa mudou fica", () => {
    const c = caso("CP-DIA-04");
    const dia = escolherDia(c.entrada.pessoa, c.entrada.founder);
    for (const k of ["mexido", "deFabrica"]) {
      expect(prepararODia(c.entrada[k], dia), k).toEqual(c.esperado[k]);
    }
  });

  it("CP-DIA-05 leitura da rotina", () => {
    const c = caso("CP-DIA-05");
    expect(lerRotina(c.entrada.markdown, c.entrada.id)).toEqual(c.esperado.rotina);
  });

  it("CP-DIA-06 dia de vendas com as ligações do painel", () => {
    const c = caso("CP-DIA-06");
    const dia = escolherDia(c.entrada.pessoa, c.entrada.founder);
    expect(dia).toBe(c.esperado.dia);
    expect(prepararODia(c.entrada.pessoal, dia).arquivos).toEqual(c.esperado.arquivos);
    const rotina = lerRotina(c.esperado.arquivos["rotinas/o-dia.md"], "o-dia")!;
    expect(rotina.onde).toBe(c.esperado.onde);
    expect(pedidoDoDia(rotina, c.entrada.ligacoes)).toBe(c.esperado.pedido);
  });
});

describe("os textos dos cinco dias", () => {
  const todosOsTextos = [
    ...Object.values(ROTINAS_DO_DIA).map(rotinaParaMarkdown),
    ...Object.values(HABILIDADES),
  ];

  it("ler e escrever a rotina devolve os mesmos bytes", () => {
    for (const r of Object.values(ROTINAS_DO_DIA)) expect(rotinaParaMarkdown(lerRotina(rotinaParaMarkdown(r), "o-dia")!)).toBe(rotinaParaMarkdown(r));
  });

  it("nenhum texto tem travessão, nem cita pessoa ou cliente", () => {
    for (const t of todosOsTextos) {
      expect(t).not.toContain("—");
      // Só papéis e lugares da casa: nada de nome próprio de gente.
      expect(t).not.toMatch(/\b(Lia|Pereira)\b/u);
    }
  });
});
