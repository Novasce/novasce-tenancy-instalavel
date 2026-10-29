// A aba Agentes (E3, AG01, UC34): a página do web numa janela própria, entrando
// pela troca do token do OS por um código de uso único. Na Parte E a troca é a
// da mão de ensaio e a página é uma local fictícia: nenhum endereço real.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { enderecoDosAgentes, estadoPelaUrl } from "../src/agentes/agentes";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

async function cena(o: { login?: boolean; online?: boolean; troca?: "recusado" | "sessao-vencida" } = {}) {
  const mao = maoDeEnsaio();
  mao.ensaio.login.tem = o.login ?? true;
  if (o.troca) mao.ensaio.login.troca = { falha: o.troca };
  const abertas: string[] = [];
  m = await montar(
    <App
      mao={mao}
      preferencias={preferenciasNaMemoria()}
      criarTerminal={criarHeadless}
      semRelogio
      online={() => o.online ?? true}
      abrirJanelaDosAgentes={async (url) => {
        abertas.push(url);
      }}
    />,
  );
  await m.esperar();
  return { mao, abertas, m };
}

const estado = () => m!.raiz.querySelector("[data-regiao=estado]");

describe("aba Agentes (E3)", () => {
  it("o app abre na aba Agentes e entra sem digitar: troca o login por um código e abre a janela", async () => {
    const { abertas } = await cena();
    expect(abertas).toEqual(["agentes-ensaio.html?codigo=codigo-de-ensaio"]);
    expect(estado()?.getAttribute("data-estado")).toBe("vazio");
    expect(m!.textos()).toContain("A página dos agentes do Tenancy está aberta numa janela própria.");
    await m!.clicar("Trazer a janela para a frente");
    expect(abertas).toHaveLength(2);
  });

  it("o endereço leva só o código, nunca o token, e vai para a rota que resgata", () => {
    expect(enderecoDosAgentes("https://web.exemplo.invalid", "abc 1")).toBe("https://web.exemplo.invalid/entrar/app?codigo=abc%201");
    expect(enderecoDosAgentes("https://web.exemplo.invalid/", "x")).toBe("https://web.exemplo.invalid/entrar/app?codigo=x");
    expect(enderecoDosAgentes(null, "x")).toBe("agentes-ensaio.html?codigo=x");
  });

  it("sem login do OS: o caminho é o Começar do sistema, nunca verifique a conexão", async () => {
    const { abertas } = await cena({ login: false });
    expect(abertas).toEqual([]);
    expect(estado()?.getAttribute("data-estado")).toBe("sem-permissao");
    expect(m!.textos()).toContain("Entre pelo Começar do sistema");
    expect(m!.textos()).not.toMatch(/verifique a conex/i);
  });

  it("sem rede: estado offline da casca, a janela não tenta", async () => {
    const { abertas } = await cena({ online: false });
    expect(abertas).toEqual([]);
    expect(estado()?.getAttribute("data-estado")).toBe("offline");
  });

  it("sessão vencida (UC34): a página cai no login e a casca diz Sessão vencida", async () => {
    await cena();
    await act(async () => {
      window.dispatchEvent(new CustomEvent("agentes:navegou", { detail: "https://web.exemplo.invalid/login?de=%2Fia%2Fagentes" }));
    });
    await m!.esperar();
    expect(estado()?.getAttribute("data-estado")).toBe("erro");
    expect(m!.textos()).toContain("Sessão vencida");
    expect(m!.textos()).toContain("Entre de novo pelo Começar do sistema.");
    expect(m!.textos()).not.toMatch(/verifique a conex/i);
  });

  it("a troca recusada pelo web vira sessão vencida, sem abrir a janela", async () => {
    const { abertas } = await cena({ troca: "sessao-vencida" });
    expect(abertas).toEqual([]);
    expect(m!.textos()).toContain("Sessão vencida");
  });

  it("pela URL: login é sessão vencida; o resto da origem é a página", () => {
    expect(estadoPelaUrl("https://web.exemplo.invalid/login")).toBe("vencida");
    expect(estadoPelaUrl("https://web.exemplo.invalid/ia/agentes")).toBe("aberta");
    expect(estadoPelaUrl("https://web.exemplo.invalid/ia/agentes/mapa")).toBe("aberta");
  });
});
