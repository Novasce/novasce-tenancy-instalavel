import type { Arquivos } from "./arquivos";
import { lerLeia, secao } from "./leia";
import { compararNomes, ehDia, moverSemSobrescrever, nomeDe, paiDe, partesDoNome } from "./nome";

export type EstadoDoEnvio = "a-enviar" | "aguardando-resposta" | "enviados";

const DA_PASTA = new Set(["LEIA.txt", "mensagem.txt", "enviado-em.txt"]);
const NAO_ESPERA = ["nada", "nenhum", "nenhuma", "não espera", "não precisa", "sem resposta", "sem volta"];

export interface Envio {
  caminho: string;
  estado: string;
  pessoa: string;
  assunto: string | null;
  data: string | null;
  anexos: string[];
  paraQuem: string | null;
  porOnde: string | null;
  temMensagem: boolean;
  enviadaEm: string | null;
  /** O LEIA tem a seção do que volta. */
  disseOQueVolta: boolean;
  esperaResposta: boolean;
}

export function lerEnvio(arquivos: Arquivos, caminho: string): Envio {
  const partes = partesDoNome(nomeDe(caminho));
  const leia = lerLeia(arquivos.ler(`${caminho}/LEIA.txt`) ?? "");
  const volta = secao(leia, ["PRECISA VOLTAR", "DE VOLTA", "O QUE ESPERA"]);
  const primeira = volta?.linhas[0]?.toLowerCase();
  const esperaResposta = !volta ? true : primeira === undefined ? false : !NAO_ESPERA.some((n) => primeira.startsWith(n));
  const data = (arquivos.ler(`${caminho}/enviado-em.txt`) ?? "").split("\n")[0].trim();
  return {
    caminho,
    estado: nomeDe(paiDe(caminho)),
    pessoa: partes.antes,
    assunto: partes.depois,
    data: partes.data,
    anexos: arquivos
      .listar(caminho)
      .map((e) => e.nome)
      .filter((n) => !DA_PASTA.has(n) && !n.startsWith("."))
      .sort(compararNomes),
    paraQuem: secao(leia, ["PARA QUEM", "PRA QUEM"])?.linhas[0] ?? null,
    porOnde: secao(leia, ["POR ONDE"])?.linhas[0] ?? null,
    temMensagem: arquivos.existe(`${caminho}/mensagem.txt`),
    enviadaEm: ehDia(data) ? data : null,
    disseOQueVolta: volta !== null,
    esperaResposta,
  };
}

/**
 * "Enviei": grava o dia em enviado-em.txt se ele não existe e move a pasta. Se o LEIA não diz o
 * que volta, pergunta antes (`resposta` vem da pessoa). Se mover falha, apaga a data que gravou.
 */
export function enviei(
  arquivos: Arquivos,
  caminho: string,
  hoje: string,
  resposta?: boolean,
): { pergunta: boolean; pasta: string; gravouAData?: boolean } {
  const envio = lerEnvio(arquivos, caminho);
  if (!envio.disseOQueVolta && resposta === undefined) return { pergunta: true, pasta: caminho };
  const espera = envio.disseOQueVolta ? envio.esperaResposta : resposta!;
  const data = `${caminho}/enviado-em.txt`;
  const gravouAData = !arquivos.existe(data);
  if (gravouAData) arquivos.gravar(data, `${hoje}\n`);
  const destino = `${paiDe(paiDe(caminho))}/${espera ? "aguardando-resposta" : "enviados"}`;
  try {
    return { pergunta: false, pasta: moverSemSobrescrever(arquivos, caminho, destino), gravouAData };
  } catch (erro) {
    if (gravouAData) arquivos.apagar(data);
    throw erro;
  }
}

/** O dia do envio informado pelo app: só em Aguardando, sem data e não depois de hoje. */
export function informarDia(arquivos: Arquivos, caminho: string, dia: string, hoje: string): { gravou: string } | { recusa: string } {
  if (nomeDe(paiDe(caminho)) !== "aguardando-resposta")
    return { recusa: "só a pasta em Aguardando resposta recebe o dia do envio" };
  const data = `${caminho}/enviado-em.txt`;
  const atual = arquivos.ler(data);
  if (atual !== null) {
    return ehDia(atual.split("\n")[0].trim())
      ? { recusa: "o enviado-em.txt já existe: a data dele fica" }
      : { recusa: "o enviado-em.txt existe sem uma data AAAA-MM-DD: corrija o arquivo na pasta" };
  }
  if (!ehDia(dia)) return { recusa: "o dia do envio precisa ser AAAA-MM-DD" };
  if (dia > hoje) return { recusa: "o dia do envio não pode ser depois de hoje" };
  arquivos.gravar(data, `${dia}\n`);
  return { gravou: data };
}

/** O desfazer do dia informado: apaga só esse arquivo. */
export function desfazerDia(arquivos: Arquivos, caminho: string): void {
  arquivos.apagar(caminho);
}

/** Os blocos "MENSAGEM n" do mensagem.txt; com menos de dois, um bloco com o arquivo inteiro. */
export function blocosDaMensagem(texto: string): { titulo: string; texto: string }[] {
  const blocos: { titulo: string; linhas: string[] }[] = [];
  let logoDepoisDoTitulo = false;
  for (const linha of texto.split("\n")) {
    const t = linha.trim();
    const titulo = /^MENSAGEM (\d{1,2})(?!\d)/.exec(t);
    if (titulo) {
      blocos.push({ titulo: "Mensagem " + t.slice("MENSAGEM ".length), linhas: [] });
      logoDepoisDoTitulo = true;
      continue;
    }
    if (logoDepoisDoTitulo && [...t].length >= 3 && /^[-=─]+$/.test(t)) {
      logoDepoisDoTitulo = false;
      continue;
    }
    logoDepoisDoTitulo = false;
    if (blocos.length) blocos[blocos.length - 1].linhas.push(linha);
  }
  if (blocos.length < 2) return [{ titulo: "Mensagem", texto: texto.trim() }];
  return blocos.map((b) => ({ titulo: b.titulo, texto: b.linhas.join("\n").trim() }));
}
