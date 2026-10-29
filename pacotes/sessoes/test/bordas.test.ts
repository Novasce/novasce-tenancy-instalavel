import { describe, expect, it } from "vitest";
import { duracao, encerrar, lerTela, type MaoDeProcessos, normalizar, type Processo, sessaoJaAberta, trabalhoForaDaMain } from "../src/index";

describe("bordas das sessões", () => {
  it("linhas vazias abaixo do rodapé não tiram a caixa da janela", () => {
    const tela = ["⏺ ok", "", "──────", "❯ ", "──────", "  ? for shortcuts", ...Array(15).fill("")].join("\n");
    expect(lerTela(tela).caixa).not.toBeNull();
  });

  it("raiz que já tinha saído não leva a sessão de um pid reaproveitado", async () => {
    // 200 morreu antes de começar; um processo novo da sessão 200 não é alvo.
    const tabela: Processo[] = [
      { pid: 100, ppid: 1, pgid: 100, sid: 100, inicio: "a" },
      { pid: 201, ppid: 1, pgid: 201, sid: 200, inicio: "c" },
    ];
    const sinais: string[] = [];
    let vivos = [...tabela];
    const mao: MaoDeProcessos = {
      tabela: () => vivos,
      sinalAoGrupo: (g, s) => {
        sinais.push(`${g}:${s}`);
        vivos = vivos.filter((p) => p.pgid !== g);
      },
      sinalAoPid: (pid, s) => {
        sinais.push(`${pid}:${s}`);
        vivos = vivos.filter((p) => p.pid !== pid);
      },
      esperar: async () => {},
    };
    const r = await encerrar([{ pid: 100, inicio: "a" }, { pid: 200, inicio: "b" }], mao, { protegidos: new Set(), grupoDoApp: 50, pidDoApp: 50 });
    expect(sinais).toEqual(["100:HUP", "100:TERM"]);
    expect(r.alvos).toBe(1);
  });

  it("no Windows a barra e a caixa do disco não mudam a pasta", () => {
    expect(normalizar("C:\\Users\\Lia Pereira\\Brain\\", "C:\\Users\\Lia Pereira")).toBe("c:/Users/Lia Pereira/Brain");
    expect(normalizar("~\\Brain", "C:\\Users\\Lia Pereira")).toBe("c:/Users/Lia Pereira/Brain");
    expect(
      sessaoJaAberta({
        pasta: "c:/Users/Lia Pereira/Brain",
        temGit: true,
        abertas: [{ pasta: "C:\\Users\\Lia Pereira\\Brain", programa: "claude", desde: "2026-10-28T08:00:00-03:00", viva: true }],
        espacos: ["C:\\Users\\Lia Pereira\\Brain"],
        home: "C:\\Users\\Lia Pereira",
      }),
    ).toBeNull();
  });

  it("trabalho fora da main vem do mais novo para o mais antigo", () => {
    const r = trabalhoForaDaMain(
      [
        { nome: "sessao-1-2026-10-27", commitsForaDaMain: 1, data: 100 },
        { nome: "sessao-2-2026-10-28", commitsForaDaMain: 2, data: 300 },
        { nome: "sessao-3-2026-10-28", commitsForaDaMain: 1, data: 200 },
      ],
      [],
    );
    expect(r.lista.map((b) => b.nome)).toEqual(["sessao-2-2026-10-28", "sessao-3-2026-10-28", "sessao-1-2026-10-27"]);
  });

  it("duração nunca fica negativa", () => {
    expect(duracao(-3)).toBe("0 s");
    expect(duracao(3 * 3600 + 5 * 60)).toBe("3 h 05");
  });
});
