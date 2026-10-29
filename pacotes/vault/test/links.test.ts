import { describe, expect, it } from "vitest";
import { ArquivosNaMemoria, desfazer, mover, renomear, type MudancaNoVault } from "../src/index";
import { caso } from "./casos";

interface Cenario {
  raiz: string;
  ignoraCaixa?: boolean;
  arquivos: Record<string, string>;
  passos: Record<string, any>[];
}

function rodar(c: Cenario) {
  const disco = new ArquivosNaMemoria(
    Object.fromEntries(Object.entries(c.arquivos).map(([k, v]) => [`${c.raiz}/${k}`, v])),
    { ignoraCaixa: c.ignoraCaixa },
  );
  const mudancas: MudancaNoVault[] = [];
  let erro: string | undefined;
  let ficaram: string[] | undefined;
  for (const p of c.passos) {
    try {
      if ("renomear" in p) mudancas.push(renomear(disco, c.raiz, p.renomear, p.nome));
      else if ("mover" in p) mudancas.push(mover(disco, c.raiz, p.mover, p.pasta));
      else if ("editar" in p) disco.gravar(`${c.raiz}/${p.editar}`, p.texto);
      else if ("desfazer" in p) ficaram = desfazer(disco, mudancas[p.desfazer]);
    } catch (e) {
      erro = (e as Error).message;
    }
  }
  const arquivos = Object.fromEntries(
    Object.entries(disco.tudo()).map(([k, v]) => [k.slice(c.raiz.length + 1), v]),
  );
  const ultima = mudancas.at(-1);
  return { arquivos, erro, ficaram, religadas: ultima?.religadas };
}

describe("renomear e mover levam os links (contrato 3)", () => {
  it("CP-LNK-01 renomear reescreve pelo nome, com apelido e âncora; código fica", () => {
    const c = caso("CP-LNK-01");
    const r = rodar(c.entrada);
    expect(r.erro).toBeUndefined();
    expect(r.arquivos).toEqual(c.esperado.arquivos);
    expect(r.religadas).toBe(c.esperado.religadas);
  });

  it("CP-LNK-02 mover troca só o que tem caminho", () => {
    const c = caso("CP-LNK-02");
    const r = rodar(c.entrada);
    expect(r.erro).toBeUndefined();
    expect(r.arquivos).toEqual(c.esperado.arquivos);
    expect(r.religadas).toBe(c.esperado.religadas);
  });

  it("CP-LNK-03 desfazer sem pisar no que a pessoa mudou", () => {
    const c = caso("CP-LNK-03");
    const r = rodar(c.entrada);
    expect(r.erro).toBeUndefined();
    expect(r.arquivos).toEqual(c.esperado.arquivos);
    expect(r.ficaram).toEqual(c.esperado.ficaram);
  });

  it("CP-LNK-04 nome tomado recusa sem mexer; só a caixa funciona", () => {
    const c = caso("CP-LNK-04");
    const tomado = rodar(c.entrada.tomado);
    expect(tomado.erro).toBe(c.esperado.tomado.erro);
    expect(tomado.arquivos).toEqual(c.esperado.tomado.arquivos);
    const caixa = rodar(c.entrada.caixa);
    expect(caixa.erro).toBeUndefined();
    expect(caixa.arquivos).toEqual(c.esperado.caixa.arquivos);
    expect(caixa.religadas).toBe(c.esperado.caixa.religadas);
  });
});
