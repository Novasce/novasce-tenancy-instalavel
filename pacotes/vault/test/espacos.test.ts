import { describe, expect, it } from "vitest";
import { ArquivosNaMemoria, buscar, negadas, normalizar, pode, registrar, type Espaco } from "../src/index";
import { caso } from "./casos";

describe("espaços", () => {
  it("CP-VLT-06 a mesma pasta por ~, link simbólico e barra final é um espaço só", () => {
    const c = caso("CP-VLT-06");
    const disco = new ArquivosNaMemoria({}, { links: c.entrada.links });
    const ctx = { home: c.entrada.home, arquivos: disco };
    expect(c.entrada.pastas.map((p: string) => normalizar(p, ctx))).toEqual(c.esperado.normalizadas);
    let lista: Espaco[] = [];
    let recusados = 0;
    c.entrada.pastas.forEach((pasta: string, i: number) => {
      const r = registrar(lista, { id: `e${i}`, nome: "Ateliê de exemplo", tipo: "trabalho", pasta }, ctx);
      if (r.registrado) lista = r.lista;
      else recusados++;
    });
    expect(lista.map((e) => e.pasta)).toEqual(c.esperado.registrados);
    expect(recusados).toBe(c.esperado.recusados);
  });

  it("CP-ESP-01 busca e sessão de um espaço não leem o outro", () => {
    const c = caso("CP-ESP-01");
    const espacos: Espaco[] = c.entrada.espacos.map((e: Omit<Espaco, "nome">) => ({ ...e, nome: e.id }));
    for (const e of espacos) {
      expect(buscar(c.entrada.notas, c.entrada.busca, e.id, espacos), e.id).toEqual(c.esperado.busca[e.id]);
      expect(negadas(e.pasta, espacos), e.id).toEqual(c.esperado.negadas[e.id]);
    }
    for (const p of c.esperado.pode) {
      expect(pode(p.caminho, p.irPara, espacos), `${p.caminho} → ${p.irPara}`).toBe(p.pode);
    }
  });
});
