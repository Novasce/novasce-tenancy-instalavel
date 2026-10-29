import { describe, expect, it } from "vitest";
import { ArquivosNaMemoria, caminhoDaNota, comBriefing, desfazerBloco, diaDaCasa, gravarNota, lerNota, tituloDaNota } from "../src/index";
import { caso } from "./casos";

describe("nota do dia", () => {
  it("CP-VLT-01 caminho e título no fuso da casa", () => {
    const c = caso("CP-VLT-01");
    for (const instante of c.entrada.instantes) {
      expect(caminhoDaNota(diaDaCasa(instante, c.fuso))).toBe(c.esperado.caminho);
      expect(tituloDaNota(instante, c.fuso)).toBe(c.esperado.titulo);
    }
  });

  it("CP-VLT-02 o briefing troca só o bloco", () => {
    const c = caso("CP-VLT-02");
    const titulo = tituloDaNota(c.relogio, c.fuso);
    for (const [nome, atual] of Object.entries<string | null>(c.entrada.notas)) {
      expect(comBriefing(atual, c.entrada.briefing, titulo), nome).toBe(c.esperado.notas[nome]);
    }
  });

  it("CP-VLT-03 desfazer só tira o bloco que está como o app deixou", () => {
    const c = caso("CP-VLT-03");
    for (const [nome, texto] of Object.entries<string>(c.entrada.notas)) {
      expect(desfazerBloco(texto, c.entrada.marca, c.entrada.conteudoGravado), nome).toEqual(c.esperado.notas[nome]);
    }
  });

  it("CP-VLT-04 o fim de linha de cada nota fica", () => {
    const c = caso("CP-VLT-04");
    const titulo = tituloDaNota(c.relogio, c.fuso);
    for (const [nome, atual] of Object.entries<string | null>(c.entrada.notas)) {
      expect(comBriefing(atual, c.entrada.briefing, titulo), nome).toBe(c.esperado.notas[nome]);
    }
  });

  it("CP-VLT-05 nome com acento acha, grava e compara pela forma NFC", () => {
    const c = caso("CP-VLT-05");
    const raiz = "/home/lia";
    const disco = new ArquivosNaMemoria(
      Object.fromEntries(Object.entries<string>(c.entrada.arquivos).map(([k, v]) => [`${raiz}/${k}`, v])),
    );
    const pedido = `${raiz}/${c.entrada.pedido}`;
    const lida = lerNota(disco, pedido);
    expect(lida !== null).toBe(c.esperado.achou);
    expect(lida).toBe(c.esperado.texto);
    expect(pedido.normalize("NFC") === Object.keys(c.entrada.arquivos).map((k) => `${raiz}/${k}`)[0].normalize("NFC")).toBe(
      c.esperado.iguais,
    );
    gravarNota(disco, pedido, c.entrada.gravar);
    const depois = Object.fromEntries(Object.entries(disco.tudo()).map(([k, v]) => [k.slice(raiz.length + 1), v]));
    expect(depois).toEqual(c.esperado.depoisDeGravar);
  });
});
