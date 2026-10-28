import { describe, expect, it } from "vitest";
import { contrastes, lerCor, luminancia, razao } from "./contraste";

describe("lerCor", () => {
  it("lê rgb e rgba", () => {
    expect(lerCor("rgb(0, 102, 108)")).toEqual([0, 102, 108, 1]);
    expect(lerCor("rgba(255, 255, 255, 0)")).toEqual([255, 255, 255, 0]);
  });
  it("devolve nulo para o que não entende", () => {
    expect(lerCor("transparent")).toBeNull();
  });
});

describe("razao", () => {
  it("preto no branco é 21:1", () => {
    expect(razao(luminancia([0, 0, 0]), luminancia([255, 255, 255]))).toBeCloseTo(21, 5);
  });
  it("o teal da casa no branco passa de 4,5:1", () => {
    expect(razao(luminancia([0, 102, 108]), luminancia([255, 255, 255]))).toBeCloseTo(6.74, 1);
  });
});

describe("contrastes", () => {
  it("mede cada texto marcado contra o primeiro fundo opaco acima dele", () => {
    const raiz = document.createElement("div");
    raiz.style.backgroundColor = "rgb(255, 255, 255)";
    const cartao = document.createElement("div");
    cartao.style.backgroundColor = "rgba(0, 0, 0, 0)";
    const texto = document.createElement("span");
    texto.dataset.contraste = "titulo";
    texto.style.color = "rgb(29, 29, 31)";
    cartao.append(texto);
    raiz.append(cartao);
    document.body.append(raiz);
    const [medido] = contrastes(raiz);
    expect(medido.nome).toBe("titulo");
    expect(medido.razao).toBeGreaterThan(16);
    raiz.remove();
  });
});
