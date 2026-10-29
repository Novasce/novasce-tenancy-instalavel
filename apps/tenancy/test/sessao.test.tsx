// Abrir, trabalhar, renomear e Sua vez (E5: UC16, UC17, UC19, UC21, UC48), pela
// tela, com a mão de ensaio e o xterm headless no lugar do xterm.js.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { Bancada } from "../src/bancada/bancada";
import { colarPergunta } from "../src/bancada/vigia";
import { preferenciasNaMemoria } from "../src/casca/preferencias";
import { maoDeEnsaio, telaDeEnsaio, type MaoDeEnsaio } from "../src/mao/ensaio";
import { criarHeadless, montar, type Montado } from "./montar";

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

interface Cena {
  mao: MaoDeEnsaio;
  bancada: Bancada;
  relogio: { agora: number };
  m: Montado;
  /** Uma volta da leitura de 2 s da Bancada. */
  ler(ms?: number): Promise<void>;
}

async function cena(o: { arquivos?: Record<string, string> } = {}): Promise<Cena> {
  const mao = maoDeEnsaio({ arquivos: o.arquivos });
  const relogio = { agora: Date.parse("2026-10-28T12:00:00Z") };
  const bancada = new Bancada(mao, () => relogio.agora, undefined, (ms) => mao.ensaio.esperar(ms));
  const montado = await montar(
    <App mao={mao} preferencias={preferenciasNaMemoria({ modoAvancado: true })} bancada={bancada} criarTerminal={criarHeadless} semRelogio />,
  );
  m = montado;
  return {
    mao,
    bancada,
    relogio,
    m: montado,
    async ler(ms = 2000) {
      relogio.agora += ms;
      await act(async () => {
        window.dispatchEvent(new CustomEvent("tenancy:ler"));
      });
      await montado.esperar();
    },
  };
}

async function abrirPelaFolha(c: Cena, ia: string) {
  await c.m.clicar("Nova sessão");
  await c.m.clicar(ia);
  await c.m.clicar("Abrir");
  await c.m.esperar();
}

async function mostrar(c: Cena, tela: string) {
  const t = c.mao.ensaio.terminais().at(-1)!;
  await act(async () => {
    c.mao.ensaio.mostrar(t.id, telaDeEnsaio(tela));
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("folha Nova sessão (UC16)", () => {
  it("onde, qual IA com o estado de cada CLI, nome, o comando por trás", async () => {
    const c = await cena();
    await c.m.clicar("Nova sessão");
    expect(c.m.textos()).toContain("Uma sessão é uma IA trabalhando numa pasta. Você conversa com ela direto, na CLI.");
    for (const aba of ["brain e repos", "recentes", "outra pasta"]) expect(c.m.temBotao(aba)).toBe(true);
    for (const ia of ["shell", "claude", "codex", "agy", "comando…"]) expect(c.m.temBotao(ia)).toBe(true);
    expect(c.m.raiz.querySelector("[data-regiao=clis]")?.textContent).toBe("claude: pronto · codex: pronto · agy: não instalado · a assinatura é sua");
    const nome = c.m.raiz.querySelector<HTMLInputElement>("input[aria-label='nome']")!;
    expect(nome.placeholder).toBe("Brain");
    expect(c.m.raiz.querySelector("[data-regiao=comando]")?.textContent).toBe("cd ~/Brain && bash -l");
    await c.m.clicar("claude");
    expect(c.m.raiz.querySelector("[data-regiao=comando]")?.textContent).toBe("cd ~/Brain && claude");
    await c.m.clicar("atelie-site");
    expect(c.m.raiz.querySelector("[data-regiao=comando]")?.textContent).toBe("cd ~/Brain/repos/atelie-site && claude");
    expect(nome.placeholder).toBe("repos/atelie-site");
  });

  it("CLI ausente desabilita Abrir com a ficha como texto", async () => {
    const c = await cena();
    await c.m.clicar("Nova sessão");
    await c.m.clicar("agy");
    expect(c.m.botao("Abrir").disabled).toBe(true);
    expect(c.m.raiz.querySelector("[data-regiao=aviso-da-folha]")?.textContent).toBe(
      "Esta CLI não está instalada neste computador. A instalação assistida chega com as ferramentas.",
    );
  });

  it("aviso de memória com três IAs abertas, sem bloquear", async () => {
    const c = await cena();
    for (let i = 0; i < 3; i++) await c.bancada.abrir({ programa: "claude", pasta: `/home/lia/Brain/repos/atelie-api` });
    await c.m.clicar("Nova sessão");
    await c.m.clicar("codex");
    expect(c.m.raiz.querySelector("[data-regiao=aviso-da-folha]")?.textContent).toBe(
      "Já há 3 IAs abertas. Com mais uma, são cerca de 1000 MB: nesta máquina ela começa a trocar memória com o disco.",
    );
    expect(c.m.botao("Abrir").disabled).toBe(false);
  });

  it("abrir sobe a CLI no shell de login, com a marca e a cabeça da sessão", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "claude");
    const t = c.mao.ensaio.terminais()[0];
    expect(t.pedido.args).toEqual(["-l", "-c", "exec claude"]);
    expect(t.pedido.ambiente.TENANCY_SESSAO).toBe(c.bancada.sessoes()[0].id);
    const cabeca = c.m.raiz.querySelector("[data-regiao=cabeca-da-sessao]")!;
    expect(cabeca.querySelector(".nome")?.textContent).toBe("Brain");
    expect(cabeca.querySelector(".programa")?.textContent).toBe("claude · Brain");
    expect(cabeca.querySelector(".ponto")?.getAttribute("data-estado")).toBe("abrindo");
  });
});

describe("estados e Sua vez (UC17, UC19)", () => {
  it("cada estado do CP-TEL chega ao ponto pela leitura de 2 s", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "claude");
    const ponto = () => c.m.raiz.querySelector("[data-regiao=cabeca-da-sessao] .ponto")?.getAttribute("data-estado");
    await mostrar(c, "CP-TEL-01.txt");
    await c.ler();
    expect(ponto()).toBe("livre");
    await mostrar(c, "CP-TEL-03-a.txt");
    await c.ler();
    expect(ponto()).toBe("trabalhando");
    await mostrar(c, "CP-TEL-02-a.txt");
    await c.ler();
    expect(ponto()).toBe("livre");
    expect(c.m.raiz.querySelector("[data-regiao=cabeca-da-sessao]")?.textContent).not.toContain("encerrada");
    await mostrar(c, "CP-TEL-05-a.txt");
    await c.ler();
    await c.ler();
    expect(ponto()).toBe("pediu-permissao");
  });

  it("sua vez: a faixa responde pela tecla; Sempre só para regra que pode", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "claude");
    expect(c.m.raiz.querySelector("[data-regiao=sua-vez]")?.textContent).toBe("Ninguém espera você.");
    expect(c.m.textos()).toContain("QUEM ESPERA · FILA ÚNICA");
    await mostrar(c, "CP-TEL-05-a.txt");
    await c.ler();
    await c.ler();
    const faixa = c.m.raiz.querySelector("[data-regiao=sua-vez]")!;
    expect(faixa.textContent).toContain("SUA VEZ · 1");
    expect(faixa.textContent).toContain("quer rodar npm test -w pacotes/registro");
    expect(c.m.temBotao("Sempre para npm test aqui")).toBe(true);
    await c.m.clicar("Sim, só agora");
    expect(c.mao.ensaio.escrito(c.mao.ensaio.terminais()[0].id)).toEqual(["1"]);

    await mostrar(c, "CP-TEL-05-b.txt");
    await c.ler();
    await c.ler();
    expect(c.m.temBotao(/^Sempre para/)).toBe(false);
    expect(c.m.temBotao("Não")).toBe(true);
  });

  it("a pergunta mudou: a tecla não vai", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "claude");
    await mostrar(c, "CP-TEL-05-a.txt");
    await c.ler();
    await c.ler();
    await mostrar(c, "CP-TEL-05-b.txt");
    await c.m.clicar("Sim, só agora");
    expect(c.mao.ensaio.escrito(c.mao.ensaio.terminais()[0].id)).toEqual([]);
    expect(c.m.raiz.querySelector("[data-regiao=sua-vez]")?.textContent).toContain("A pergunta mudou. Olhe a sessão.");
  });

  it("Codex pedindo: responde na CLI", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "codex");
    await mostrar(c, "CP-TEL-05-a.txt");
    await c.ler();
    await c.ler();
    expect(c.m.raiz.querySelector("[data-regiao=sua-vez]")?.textContent).toContain("Responda na CLI, abaixo.");
    expect(c.m.temBotao("Sim, só agora")).toBe(false);
  });
});

describe("colar, renomear e dividir (UC21)", () => {
  it("colar grande pergunta; pequeno vai direto", () => {
    expect(colarPergunta("uma linha")).toBeNull();
    expect(colarPergunta(Array.from({ length: 60 }, (_, i) => `linha ${i}`).join("\n"))).toBe("colar 60 linhas?");
    expect(colarPergunta("x".repeat(11 * 1024))).toBe("colar 1 linhas?");
    expect(colarPergunta(Array.from({ length: 10000 }, () => "a").join("\n"))).toBe("colar 10.000 linhas?");
  });

  it("colar 60 linhas mostra a faixa; não, nada vai; colar, vai", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "shell");
    const area = c.m.raiz.querySelector<HTMLElement>("[data-regiao=terminal]")!;
    const texto = Array.from({ length: 60 }, (_, i) => `linha ${i}`).join("\n");
    await act(async () => {
      const e = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(e, "clipboardData", { value: { getData: () => texto } });
      area.dispatchEvent(e);
    });
    expect(c.m.textos()).toContain("colar 60 linhas?");
    await c.m.clicar("não");
    expect(c.mao.ensaio.escrito(c.mao.ensaio.terminais()[0].id)).toEqual([]);
  });

  it("renomear: vazio devolve o automático; nome dado não é trocado pela fala", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "claude");
    await c.m.clicar("Renomear a sessão");
    const campo = c.m.raiz.querySelector<HTMLInputElement>("input[placeholder='nome da sessão']")!;
    await c.m.digitar(campo, "Peça A");
    await act(async () => {
      campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const s = c.bancada.sessoes()[0];
    expect(s.nome).toBe("Peça A");
    c.bancada.nomeAutomatico(s.id, "Resumo das notas de hoje");
    expect(c.bancada.sessoes()[0].nome).toBe("Peça A");
    c.bancada.renomear(s.id, "");
    expect(c.bancada.sessoes()[0].nome).toBe("Resumo das notas de hoje");
    const outra = await c.bancada.abrir({ programa: "claude", pasta: "/home/lia/Brain/repos/atelie-api" });
    c.bancada.renomear(outra.id, "");
    expect(c.bancada.sessao(outra.id)!.nome).toBe("repos/atelie-api");
  });

  it("dividir abre um shell na mesma pasta, ao lado", async () => {
    const c = await cena();
    await abrirPelaFolha(c, "claude");
    await c.m.clicar("Dividir o painel");
    const ts = c.mao.ensaio.terminais();
    expect(ts).toHaveLength(2);
    expect(ts[1].pedido.args).toEqual(["-l"]);
    expect(ts[1].pedido.pasta).toBe(ts[0].pedido.pasta);
    expect(c.m.raiz.querySelectorAll("[data-regiao=terminal]")).toHaveLength(2);
  });
});

describe("persona e regras (UC48)", () => {
  it("Ajustes lista as regras Sempre por pasta e revogar tira na origem", async () => {
    const arquivo = "/home/lia/Brain/.claude/settings.local.json";
    const c = await cena({ arquivos: { [arquivo]: JSON.stringify({ permissions: { allow: ["Bash(npm test:*)", "Bash(git status:*)"], deny: [] } }) } });
    await c.m.clicar("Ajustes");
    expect(c.m.textos()).toContain("O que faz sem perguntar · 2");
    expect(c.m.textos()).toContain("Bash(npm test:*)");
    await c.m.clicar("Revogar Bash(npm test:*)");
    expect(JSON.parse(c.mao.ensaio.arquivos.ler(arquivo)!).permissions.allow).toEqual(["Bash(git status:*)"]);
    expect(c.m.textos()).toContain("O que faz sem perguntar · 1");
  });
});
