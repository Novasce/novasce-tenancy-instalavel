import { describe, expect, it } from "vitest";
import esquemaJson from "../../../casos-de-prova/esquema.json";
import idsJson from "../../../casos-de-prova/ids.json";
import { CONTRATO_DO_PREFIXO, carregar, faltam, validar, type Arquivo, type Esquema } from "../src/index";

const esquema = esquemaJson as Esquema;
const ids: string[] = idsJson.ids;

// Todos os JSON de casos-de-prova/, menos o esquema e a lista de ids, como texto.
const daPasta = import.meta.glob(
  ["../../../casos-de-prova/**/*.json", "!../../../casos-de-prova/esquema.json", "!../../../casos-de-prova/ids.json"],
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;
const arquivosDaPasta: Arquivo[] = Object.entries(daPasta).map(([caminho, texto]) => ({
  caminho: caminho.replace("../../../casos-de-prova/", ""),
  texto,
}));

function exemplo(mudar: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "CP-VLT-01",
    contrato: "vault",
    regra: "Caminho e título da nota do dia",
    relogio: "2026-10-23T09:00:00-03:00",
    fuso: "America/Maceio",
    entrada: { dia: "2026-10-23" },
    esperado: { caminho: "Diário/2026-10-23.md" },
    mac: "passa",
    ...mudar,
  };
}

function arquivo(caso: Record<string, unknown>, caminho = `vault/${caso.id}.json`): Arquivo {
  return { caminho, texto: JSON.stringify(caso) };
}

describe("validar contra o esquema", () => {
  it("aceita o caso no formato", () => {
    expect(validar(exemplo(), esquema)).toEqual([]);
  });

  it("recusa campo que falta e campo a mais", () => {
    const { mac: _mac, ...semMac } = exemplo();
    expect(validar(semMac, esquema)).toEqual(["falta o campo mac"]);
    expect(validar(exemplo({ nota: "x" }), esquema)).toEqual(["campo que não existe no formato: nota"]);
  });

  it("recusa id, relógio, fuso e mac fora do padrão", () => {
    expect(validar(exemplo({ id: "CP-VLT-1" }), esquema)).toEqual(["id fora do padrão: CP-VLT-1"]);
    expect(validar(exemplo({ relogio: "2026-10-23T09:00:00" }), esquema)).toEqual([
      "relogio fora do padrão: 2026-10-23T09:00:00",
    ]);
    expect(validar(exemplo({ fuso: "-03:00" }), esquema)).toEqual(["fuso fora do padrão: -03:00"]);
    expect(validar(exemplo({ mac: "pendente" }), esquema)).toEqual(["mac fora do padrão: pendente"]);
    expect(validar(exemplo({ mac: "pendente: fim de linha" }), esquema)).toEqual([]);
  });

  it("recusa tipo errado e contrato desconhecido", () => {
    expect(validar(exemplo({ entrada: [] }), esquema)).toEqual(["entrada tem que ser object"]);
    expect(validar(exemplo({ regra: "" }), esquema)).toEqual(["regra vazia"]);
    expect(validar(exemplo({ contrato: "notas" }), esquema)).toEqual(["contrato desconhecido: notas"]);
    expect(validar([], esquema)).toEqual(["o caso tem que ser object"]);
  });
});

describe("carregar a pasta", () => {
  it("carrega e devolve os casos", () => {
    const { casos, erros } = carregar([arquivo(exemplo())], esquema, ids);
    expect(erros).toEqual([]);
    expect(casos.map((c) => c.id)).toEqual(["CP-VLT-01"]);
  });

  it("falha com o caso fora da pasta do contrato", () => {
    expect(carregar([arquivo(exemplo(), "espacos/CP-VLT-01.json")], esquema, ids).erros).toEqual([
      "espacos/CP-VLT-01.json: CP-VLT fica na pasta vault/, não em espacos/",
    ]);
  });

  it("falha com id repetido", () => {
    const { erros } = carregar(
      [arquivo(exemplo()), arquivo(exemplo(), "vault/copia/CP-VLT-01.json")],
      esquema,
      ids,
    );
    expect(erros).toEqual(["id repetido: CP-VLT-01 em vault/CP-VLT-01.json e vault/copia/CP-VLT-01.json"]);
  });

  it("falha com id que não está no ids.json", () => {
    const caso = exemplo({ id: "CP-VLT-99" });
    expect(carregar([arquivo(caso)], esquema, ids).erros).toEqual([
      "vault/CP-VLT-99.json: id fora do ids.json: CP-VLT-99",
    ]);
  });

  it("falha quando o nome do arquivo não é o id", () => {
    expect(carregar([arquivo(exemplo(), "vault/nota-do-dia.json")], esquema, ids).erros).toEqual([
      "vault/nota-do-dia.json: o arquivo tem que se chamar CP-VLT-01.json",
    ]);
  });

  it("falha quando o prefixo do id é de outro contrato", () => {
    expect(carregar([arquivo(exemplo({ contrato: "canvas" }))], esquema, ids).erros).toEqual([
      "vault/CP-VLT-01.json: CP-VLT é do contrato vault, não canvas",
    ]);
  });

  it("falha com JSON quebrado, sem virar caso", () => {
    const { casos, erros } = carregar([{ caminho: "vault/CP-VLT-01.json", texto: "{ \"id\": " }], esquema, ids);
    expect(casos).toEqual([]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/^vault\/CP-VLT-01\.json: JSON quebrado/);
  });

  it("diz quais ids faltam", () => {
    const { casos } = carregar([arquivo(exemplo())], esquema, ids);
    expect(faltam(casos, ["CP-VLT-01", "CP-VLT-02"])).toEqual(["CP-VLT-02"]);
  });
});

describe("a lista de ids", () => {
  it("tem os 85 ids das tabelas 6.3 e 6.5, sem repetição, cada um com contrato", () => {
    expect(ids).toHaveLength(85);
    expect(new Set(ids).size).toBe(85);
    const semContrato = ids.filter((id) => !(id.slice(0, 6) in CONTRATO_DO_PREFIXO));
    expect(semContrato).toEqual([]);
  });
});

describe("os casos de casos-de-prova/", () => {
  it("todos no formato, sem id repetido e sem id fora da lista", () => {
    const { erros } = carregar(arquivosDaPasta, esquema, ids);
    expect(erros).toEqual([]);
  });

  it("nenhum id do ids.json falta", () => {
    const { casos } = carregar(arquivosDaPasta, esquema, ids);
    expect(faltam(casos, ids)).toEqual([]);
  });
});
