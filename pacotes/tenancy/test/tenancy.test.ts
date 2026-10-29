import { describe, expect, it } from "vitest";
import {
  ClienteTenancy,
  acoesDoCartao,
  classificar,
  decodificarEnvelope,
  enviarLote,
  faltaProduto,
  lerData,
  linhasAutorizadas,
  maisNova,
  mensagemDeErro,
  papelDe,
  papelDoRegistro,
  planejarLote,
  portao,
  problemaAoMover,
  reagirAoErro,
  restrito,
  sessaoDoToken,
  somenteLeitura,
  textoDoErro,
  type Http,
  type Pedido,
  type Resposta,
} from "../src/index";
import { idsEsperados, lerCasos, type Caso } from "./ler-casos";

const glob = import.meta.glob("../../../casos-de-prova/{api,papel,versao,lote}/*.json", { eager: true, import: "default" });
const todos = Object.fromEntries(Object.entries(glob).map(([k, v]) => [k, v]));
const doGrupo = (pasta: string, prefixo: string) =>
  lerCasos(Object.fromEntries(Object.entries(todos).filter(([k]) => k.includes(`/${pasta}/`))), prefixo);

const api = doGrupo("api", "CP-API-");
const papel = doGrupo("papel", "CP-PAP-");
const versao = doGrupo("versao", "CP-ATU-");
const lote = doGrupo("lote", "CP-LOT-");

function caso(lista: Caso[], id: string): Caso {
  const c = lista.find((x) => x.id === id);
  if (!c) throw new Error(`falta o caso ${id}`);
  return c;
}

/** Monta o token do caso na hora do teste: o repositório não guarda nada com cara de token. */
function token(payload: unknown): string {
  const b64 = (s: string) =>
    btoaSemDom(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64('{"alg":"none"}')}.${b64(JSON.stringify(payload))}.assinatura`;
}

function btoaSemDom(texto: string): string {
  // Os payloads dos casos são ASCII.
  const bytes = [...texto].map((c) => c.charCodeAt(0));
  const tabela = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let saida = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3);
    const n = (a << 16) | (b << 8) | c;
    saida += tabela[(n >> 18) & 63] + tabela[(n >> 12) & 63];
    saida += i + 1 < bytes.length ? tabela[(n >> 6) & 63] : "=";
    saida += i + 2 < bytes.length ? tabela[n & 63] : "=";
  }
  return saida;
}

/** Http de mentira: guarda os pedidos e devolve as respostas na ordem. */
class HttpDeMentira implements Http {
  pedidos: Pedido[] = [];
  constructor(private respostas: (Resposta | ((p: Pedido) => Resposta))[]) {}
  async pedir(p: Pedido): Promise<Resposta> {
    this.pedidos.push(p);
    const r = this.respostas.shift() ?? { status: 200, corpo: '{"data":null}' };
    return typeof r === "function" ? r(p) : r;
  }
}

const agoraDe = (c: Caso) => Date.parse(c.relogio);

describe("casos de prova do tenancy", () => {
  it("tem todos os casos de API, papel, versão e lote", () => {
    expect(api.map((c) => c.id)).toEqual(idsEsperados("CP-API-", 5));
    expect(papel.map((c) => c.id)).toEqual(idsEsperados("CP-PAP-", 6));
    expect(versao.map((c) => c.id)).toEqual(idsEsperados("CP-ATU-", 1));
    expect(lote.map((c) => c.id)).toEqual(idsEsperados("CP-LOT-", 3));
  });
});

describe("API e sessão", () => {
  it("CP-API-01 lê o envelope, as datas e a mensagem de erro", () => {
    const c = caso(api, "CP-API-01");
    const data = decodificarEnvelope<Record<string, string>>(c.entrada.sucesso);
    const lido = { ...data };
    for (const campo of c.entrada.camposDeData) lido[campo] = lerData(data[campo]).toISOString();
    expect(lido).toEqual(c.esperado.data);
    expect(() => lerData(c.entrada.dataFora)).toThrow();
    c.entrada.erros.forEach((e: { status: number; corpo: string }, i: number) => {
      expect(mensagemDeErro(e.corpo)).toBe(c.esperado.mensagens[i]);
      expect(textoDoErro(e.status, e.corpo)).toBe(c.esperado.textos[i]);
    });
  });

  it("CP-API-02 401 vence a sessão, limpa o trabalho e guarda o Pessoal", async () => {
    const c = caso(api, "CP-API-02");
    const http = new HttpDeMentira([c.entrada.resposta]);
    const cliente = new ClienteTenancy(http, { baseDaApi: c.entrada.base }, () => token(c.entrada.estado.sessao.payload));
    const r = await cliente.pedir(c.entrada.pedido.metodo, c.entrada.pedido.rota, { linha: c.entrada.pedido.linha });
    expect(r.tipo).toBe(c.esperado.erro);
    const depois = reagirAoErro(r, c.entrada.estado);
    expect(depois).toMatchObject(c.esperado.estado);
    const login = new ClienteTenancy(new HttpDeMentira([c.entrada.login.resposta]), { baseDaApi: c.entrada.base }, () => null);
    const rl = await login.entrar("lia@exemplo.invalid", "senha-de-exemplo");
    expect(rl.tipo).toBe(c.esperado.login);
  });

  it("CP-API-03 separa rede, 401 e 403; 403 não desloga", async () => {
    const c = caso(api, "CP-API-03");
    for (const [i, resposta] of c.entrada.respostas.entries()) {
      const r = await new ClienteTenancy(
        new HttpDeMentira([resposta]),
        { baseDaApi: c.entrada.base },
        () => token(c.entrada.estado.sessao.payload),
      ).pedir(c.entrada.pedido.metodo, c.entrada.pedido.rota, { linha: c.entrada.pedido.linha });
      const e = c.esperado.respostas[i];
      expect(r.tipo, e.nome).toBe(e.erro);
      const depois = reagirAoErro(r, c.entrada.estado);
      expect(depois.sessao === null, e.nome).toBe(e.desloga);
      expect(depois.online, e.nome).toBe(e.online);
      if (e.foraDoPapel) {
        expect(depois.foraDoPapel).toBe(true);
        expect(depois.tarefas).toEqual(e.tarefas);
        expect(depois.eu).toEqual(c.entrada.estado.eu);
        expect(depois.linhas).toEqual(c.entrada.estado.linhas);
        expect(depois.sessao).toEqual(c.entrada.estado.sessao);
      }
    }
  });

  it("CP-API-04 a sessão nasce do exp e o portão confere validade", () => {
    const c = caso(api, "CP-API-04");
    const agora = c.entrada.agora * 1000;
    expect(agora).toBe(agoraDe(c));
    c.entrada.tokens.forEach((t: { nome: string; payload?: unknown; bruto?: string | null }, i: number) => {
      const bruto = t.payload !== undefined ? token(t.payload) : (t.bruto ?? null);
      const e = c.esperado.tokens[i];
      expect(bruto ? sessaoDoToken(bruto) !== null : false, e.nome).toBe(e.sessao);
      expect(portao(bruto, agora), e.nome).toBe(e.portao);
    });
  });

  it("CP-API-05 só a rota por linha leva X-Linha; base da configuração", async () => {
    const c = caso(api, "CP-API-05");
    const http = new HttpDeMentira([]);
    const cliente = new ClienteTenancy(http, { baseDaApi: c.entrada.base }, () => c.entrada.token);
    for (const p of c.entrada.pedidos) await cliente.pedir(p.metodo, p.rota, { linha: p.linha, corpo: p.corpo });
    expect(
      http.pedidos.map((p) => ({
        url: p.url,
        xLinha: p.cabecalhos["X-Linha"] ?? null,
        contentType: "Content-Type" in p.cabecalhos,
      })),
    ).toEqual(c.esperado.pedidos);
    for (const p of http.pedidos) expect(p.cabecalhos.Authorization).toBe(c.esperado.autorizacao);
  });

  it("sem token, nenhum pedido sai", async () => {
    const http = new HttpDeMentira([]);
    const r = await new ClienteTenancy(http, { baseDaApi: "https://api.exemplo.invalid" }, () => null).pedir("GET", "/tasks");
    expect(r.tipo).toBe("sem-sessao");
    expect(http.pedidos).toEqual([]);
  });
});

describe("papel por linha", () => {
  it("CP-PAP-01 desconhecido e SOCIO são só leitura", () => {
    const c = caso(papel, "CP-PAP-01");
    c.entrada.papeis.forEach((bruto: string | null, i: number) => {
      const p = papelDe(bruto);
      expect({ papel: p, somenteLeitura: p === null ? null : somenteLeitura(p) }).toEqual(c.esperado.papeis[i]);
    });
  });

  it("CP-PAP-02 a Casa só com casaAccess", () => {
    const c = caso(papel, "CP-PAP-02");
    c.entrada.pessoas.forEach((p: { nome: string; eu: any }, i: number) => {
      expect(linhasAutorizadas(p.eu).map((l) => l.slug), p.nome).toEqual(c.esperado.pessoas[i].linhas);
    });
  });

  it("CP-PAP-03 em todas, o papel é o da linha do registro", () => {
    const c = caso(papel, "CP-PAP-03");
    c.entrada.pessoas.forEach((p: { nome: string; eu: any }, i: number) => {
      const papeis = c.entrada.cartoes.map((x: { cartao: any }) => papelDoRegistro(p.eu, x.cartao));
      expect(papeis, p.nome).toEqual(c.esperado.pessoas[i].papeis);
    });
  });

  it("CP-PAP-04 cadeado só com visibleToUserIds preenchido", () => {
    const c = caso(papel, "CP-PAP-04");
    c.entrada.cartoes.forEach((x: { nome: string; cartao: any }, i: number) => {
      expect(restrito(x.cartao), x.nome).toBe(c.esperado.cartoes[i].restrito);
    });
  });

  it("CP-PAP-05 cartão sem produto só com papel na Casa", () => {
    const c = caso(papel, "CP-PAP-05");
    c.entrada.tentativas.forEach((t: any, i: number) => {
      expect(faltaProduto(t.eu, t.produtoId, t.produtos), t.nome).toBe(c.esperado.tentativas[i].recusa);
    });
  });

  it("CP-PAP-06 ações por estado e mover só entre Backlog e Fazendo", () => {
    const c = caso(papel, "CP-PAP-06");
    c.entrada.acoes.forEach((x: any, i: number) => {
      const e = c.esperado.acoes[i];
      expect(acoesDoCartao(x.cartao, x.eu), `${e.pessoa} ${e.kind} ${e.status}`).toEqual(e.acoes);
    });
    c.entrada.mover.forEach((m: { de: string; para: string }, i: number) => {
      expect(problemaAoMover(m.de, m.para), `${m.de} → ${m.para}`).toBe(c.esperado.mover[i]);
    });
  });
});

describe("versão", () => {
  it("CP-ATU-01 só sobe", () => {
    const c = caso(versao, "CP-ATU-01");
    expect(c.entrada.pares.map((p: { servidor: string; instalada: string }) => maisNova(p.servidor, p.instalada))).toEqual(
      c.esperado.atualiza,
    );
  });
});

describe("lote para Review", () => {
  it("CP-LOT-01 cartão sem prova fica de fora antes de qualquer chamada", async () => {
    const c = caso(lote, "CP-LOT-01");
    const plano = planejarLote(c.entrada.cartoes);
    expect(plano.chamadas.map((x) => x.cartao)).toEqual(c.esperado.chamadas);
    expect(plano.foraAntes).toEqual(c.esperado.foraAntes);
    const chamados: string[] = [];
    const r = await enviarLote(plano, async (ch) => {
      chamados.push(ch.cartao);
      return { status: 200, corpo: '{"data":{}}' };
    });
    expect(chamados).toEqual(c.esperado.chamadas);
    expect(r.continuamSelecionados).toEqual(c.esperado.continuamSelecionados);
  });

  it("CP-LOT-02 confirma cartão a cartão e 403 num não para os outros", async () => {
    const c = caso(lote, "CP-LOT-02");
    const plano = planejarLote(c.entrada.cartoes);
    expect(plano.naTela).toEqual(c.esperado.antesDaResposta);
    const linhaDoTempo: string[] = [];
    const r = await enviarLote(
      plano,
      async (ch) => {
        linhaDoTempo.push(`pediu ${ch.cartao}`);
        await Promise.resolve();
        linhaDoTempo.push(`respondeu ${ch.cartao}`);
        return c.entrada.respostas[ch.cartao];
      },
      (id, resultado) => linhaDoTempo.push(`marcou ${id} ${resultado.status}`),
    );
    expect(linhaDoTempo).toEqual(
      c.esperado.chamadas.flatMap((id: string) => [
        `pediu ${id}`,
        `respondeu ${id}`,
        `marcou ${id} ${c.esperado.resultado[id].status}`,
      ]),
    );
    expect(r.chamadas).toEqual(c.esperado.chamadas);
    for (const [id, e] of Object.entries<any>(c.esperado.resultado)) {
      expect(r.resultado[id].status, id).toBe(e.status);
      expect(r.resultado[id].aviso, id).toBe(e.aviso);
      if (e.prova) expect(r.resultado[id].prova).toBe(e.prova);
      if (e.comentario) expect(r.resultado[id].comentario).toBe(e.comentario);
    }
    expect(Object.values(r.resultado).map((x) => x.status)).not.toContain("FEITO");
  });

  it("CP-LOT-03 prova e comentário não se misturam e Review não recebe anexo de novo", () => {
    const c = caso(lote, "CP-LOT-03");
    const plano = planejarLote(c.entrada.cartoes);
    expect(plano.chamadas).toEqual(c.esperado.chamadas);
    const repetir = planejarLote(c.entrada.repetir);
    expect(repetir.chamadas).toEqual(c.esperado.repetir.chamadas);
    expect(repetir.jaEmReview).toEqual(c.esperado.repetir.jaEmReview);
  });

  it("401 no meio do lote para o resto, que fica como estava", async () => {
    const c = caso(lote, "CP-LOT-02");
    const plano = planejarLote(c.entrada.cartoes);
    const r = await enviarLote(plano, async (ch) =>
      ch.cartao === "cartao-a" ? { status: 401, corpo: "{}" } : { status: 200, corpo: "{}" },
    );
    expect(r.chamadas).toEqual(["cartao-a"]);
    expect(r.resultado["cartao-b"]).toMatchObject({ status: "FAZENDO", aviso: "nao-enviado" });
  });
});

describe("lote, fora dos casos", () => {
  it("erro ao enviar um cartão não derruba o lote", async () => {
    const c = caso(lote, "CP-LOT-02");
    const r = await enviarLote(planejarLote(c.entrada.cartoes), async (ch) => {
      if (ch.cartao === "cartao-a") throw new Error("caiu");
      return { status: 200, corpo: "{}" };
    });
    expect(r.resultado["cartao-a"]).toMatchObject({ status: "FAZENDO", aviso: "sem-resposta" });
    expect(r.resultado["cartao-c"]).toMatchObject({ status: "REVIEW", aviso: null });
  });
});

describe("classificação", () => {
  it("403 é sem acesso também no login, como no Mac", async () => {
    const http = new HttpDeMentira([{ status: 403, corpo: "{}" }]);
    const r = await new ClienteTenancy(http, { baseDaApi: "https://api.exemplo.invalid" }, () => null).entrar("lia@exemplo.invalid", "x");
    expect(r.tipo).toBe("sem-acesso");
  });

  it("o veredito do Meu dia também é rota por linha", async () => {
    const http = new HttpDeMentira([]);
    await new ClienteTenancy(http, { baseDaApi: "https://api.exemplo.invalid" }, () => "t").pedir("GET", "/dashboard/meu-dia/veredito", { linha: "EXEMPLO" });
    expect(http.pedidos[0].cabecalhos["X-Linha"]).toBe("EXEMPLO");
  });

  it("2xx é ok e o resto vira erro com tipo", () => {
    expect(classificar({ status: 204, corpo: "" }, true).tipo).toBe("ok");
    expect(classificar({ status: 418, corpo: '{"message":"x"}' }, true)).toMatchObject({ tipo: "http", status: 418 });
    expect(classificar({ status: 401, corpo: "{}" }, false)).toMatchObject({ tipo: "http", status: 401 });
  });
});
