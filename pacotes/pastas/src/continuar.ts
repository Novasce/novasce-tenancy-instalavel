import type { Arquivos } from "./arquivos";
import { dobrar, juntar, lerLeia, secao, type Leia } from "./leia";
import { compararNomes, moverSemSobrescrever, desfazerMover, pastasEm } from "./nome";

export type EstadoDaPasta = "a-continuar" | "continuados" | "em-espera";

export interface PastaParaContinuar {
  brain: string;
  estado: EstadoDaPasta;
  nome: string;
  caminho: string;
  /** Só a pasta de a-continuar abre sessão. */
  podeAbrir: boolean;
  /** Lido do LEIA nas pastas em espera, que aparecem com ele. */
  ondeParou?: string[];
}

/** Quantas pastas de continuados cada brain mostra: as mais novas pelo nome. */
export const HISTORICO = 60;

/** Caminho absoluto, sem "~", sem barra no fim e com os atalhos resolvidos. */
export function normalizarPasta(arquivos: Arquivos, caminho: string, home: string): string {
  let p = caminho === "~" ? home : caminho.startsWith("~/") ? home + caminho.slice(1) : caminho;
  p = arquivos.caminhoReal(p);
  while (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

export function listarParaContinuar(arquivos: Arquivos, brains: string[], home: string) {
  const unicos: string[] = [];
  for (const b of brains) {
    const n = normalizarPasta(arquivos, b, home);
    if (!unicos.includes(n)) unicos.push(n);
  }
  const item = (brain: string, estado: EstadoDaPasta, nome: string): PastaParaContinuar => ({
    brain,
    estado,
    nome,
    caminho: `${brain}/continuar/${estado}/${nome}`,
    podeAbrir: estado === "a-continuar",
  });
  const aContinuar: PastaParaContinuar[] = [];
  const continuados: PastaParaContinuar[] = [];
  const emEspera: PastaParaContinuar[] = [];
  for (const brain of unicos) {
    for (const nome of pastasEm(arquivos, `${brain}/continuar/a-continuar`)) aContinuar.push(item(brain, "a-continuar", nome));
    for (const nome of pastasEm(arquivos, `${brain}/continuar/continuados`).slice(-HISTORICO))
      continuados.push(item(brain, "continuados", nome));
    for (const nome of pastasEm(arquivos, `${brain}/continuar/em-espera`)) {
      const p = item(brain, "em-espera", nome);
      p.ondeParou = ondeParou(lerLeia(arquivos.ler(`${p.caminho}/LEIA.txt`) ?? ""));
      emEspera.push(p);
    }
  }
  continuados.sort((a, b) => compararNomes(b.nome, a.nome));
  return { brains: unicos, aContinuar, continuados, emEspera };
}

/** Onde parou: ONDE PAROU, ou ASSUNTO, ou o texto antes do primeiro título, ou a primeira seção que não é espera. */
export function ondeParou(leia: Leia): string[] {
  const s = secao(leia, ["ONDE PAROU", "ONDE PARAMOS"]) ?? secao(leia, ["ASSUNTO"]);
  if (s) return s.linhas;
  if (leia.preambulo.length) return leia.preambulo;
  return leia.secoes.find((x) => !x.titulo.includes("ESPERA"))?.linhas ?? [];
}

export function oQueEspera(leia: Leia): string[] {
  return juntar(leia, "ESPERA");
}

// Modelo e esforço para abrir.

export type Motor = "claude" | "codex" | "agy";
export type Esforco = "baixo" | "médio" | "alto" | "altíssimo" | "máximo";

export interface ModeloParaAbrir {
  modelo: string | null;
  rotulo: string;
  esforco: Esforco | null;
}

const NIVEIS: Record<string, Esforco> = {
  baixo: "baixo", low: "baixo", medio: "médio", medium: "médio", alto: "alto", high: "alto",
  altissimo: "altíssimo", xhigh: "altíssimo", maximo: "máximo", max: "máximo",
};

const NA_CLI: Record<Esforco, string> = { baixo: "low", médio: "medium", alto: "high", altíssimo: "xhigh", máximo: "max" };

function lerEsforco(texto: string): Esforco | null {
  const palavras = dobrar(texto).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (let i = 0; i < palavras.length - 1; i++) {
    if (["esforco", "raciocinio", "effort", "reasoning"].includes(palavras[i]) && NIVEIS[palavras[i + 1]]) {
      return NIVEIS[palavras[i + 1]];
    }
  }
  return null;
}

function versao(p: string): string | null {
  const v = p.replace(/,/g, ".").replace(/^\.+|\.+$/g, "");
  return /^\d(?:[\d.]*\d)?$/.test(v) ? v : null;
}

function lerModelo(texto: string, motor: Motor): { modelo: string | null; rotulo: string } {
  const palavras = dobrar(texto).split(/[ ,;()]+/).filter(Boolean);
  if (motor === "claude") {
    for (let i = 0; i < palavras.length; i++) {
      const p = palavras[i];
      if (!["opus", "sonnet", "haiku", "fable"].includes(p)) continue;
      const nome = p[0].toUpperCase() + p.slice(1);
      const v = i + 1 < palavras.length ? versao(palavras[i + 1]) : null;
      return v ? { modelo: `claude-${p}-${v.replace(/\./g, "-")}`, rotulo: `${nome} ${v}` } : { modelo: p, rotulo: nome };
    }
    return { modelo: null, rotulo: "padrão do Claude Code" };
  }
  const id = palavras.find((p) => p.startsWith("gpt-") || p.startsWith("gemini-") || p.startsWith("claude-"));
  if (id) return { modelo: id, rotulo: id };
  return { modelo: null, rotulo: `padrão do ${motor === "codex" ? "Codex" : "agy"}` };
}

/** A seção MODELO E ESFORÇO do LEIA, para uma CLI. A linha dos subagentes e o porquê não contam. */
export function modeloDoLeia(leia: Leia, motor: Motor): ModeloParaAbrir | null {
  const s = secao(leia, ["MODELO E ESFORÇO", "MODELO E ESFORCO"]);
  if (!s) return null;
  for (const linha of s.linhas) {
    const dois = linha.indexOf(":");
    if (dois < 0) continue;
    const quem = dobrar(linha.slice(0, dois));
    if (quem.includes("subagente")) continue;
    if (!quem.includes(motor) && !(motor === "agy" && quem.includes("antigravity"))) continue;
    let valor = linha.slice(dois + 1);
    const ponto = valor.indexOf(". ");
    if (ponto >= 0) valor = valor.slice(0, ponto);
    return { ...lerModelo(valor, motor), esforco: lerEsforco(valor) };
  }
  return null;
}

export interface Aceita {
  modelo: boolean;
  esforco: boolean;
}

/** As opções da linha de comando; a que a CLI não aceita fica de fora e vale o padrão dela. */
export function opcoesDaCli(
  motor: Motor,
  escolha: { modelo: string | null; esforco: Esforco | null },
  aceita: Aceita,
): string[] {
  const opcoes: string[] = [];
  if (escolha.modelo && aceita.modelo) opcoes.push(motor === "codex" ? "-m" : "--model", escolha.modelo);
  if (escolha.esforco && aceita.esforco) {
    const valor = NA_CLI[escolha.esforco];
    if (motor === "codex") opcoes.push("-c", `model_reasoning_effort="${valor}"`);
    else opcoes.push("--effort", valor);
  }
  return opcoes;
}

/** Quanto a conferência do --help espera antes de abrir no padrão. */
export const PRAZO_DA_AJUDA_MS = 5000;

export type RespostaDaAjuda = { codigo: number; saida: string } | { esgotou: true };
export type Aviso = "ajuda-sem-resposta" | "nao-aceita-modelo" | "nao-aceita-esforco" | "nao-aceita-modelo-nem-esforco";

/** Roda `<cli> --help` com prazo e diz o que a CLI aceita. */
export async function conferirAjuda(
  motor: Motor,
  executavel: string,
  rodar: (comando: string[], prazoMs: number) => Promise<RespostaDaAjuda>,
): Promise<Aceita & { semResposta: boolean }> {
  const r = await rodar([executavel, "--help"], PRAZO_DA_AJUDA_MS);
  if ("esgotou" in r) return { modelo: false, esforco: false, semResposta: true };
  const ok = r.codigo === 0;
  return {
    modelo: ok && r.saida.includes("--model"),
    esforco: ok && r.saida.includes(motor === "codex" ? "--config" : "--effort"),
    semResposta: false,
  };
}

/** O aviso ao abrir, só pelo que o LEIA pediu e a CLI não aceitou. */
export function avisoDaAbertura(
  escolha: { modelo: string | null; esforco: Esforco | null },
  aceita: Aceita & { semResposta?: boolean },
): Aviso | null {
  const semModelo = !!escolha.modelo && !aceita.modelo;
  const semEsforco = !!escolha.esforco && !aceita.esforco;
  if (!semModelo && !semEsforco) return null;
  if (aceita.semResposta) return "ajuda-sem-resposta";
  return semModelo && semEsforco ? "nao-aceita-modelo-nem-esforco" : semModelo ? "nao-aceita-modelo" : "nao-aceita-esforco";
}

/** O texto do aviso, com o nome da CLI. */
export function textoDoAviso(aviso: Aviso, cli: string): string {
  if (aviso === "ajuda-sem-resposta") return `O ${cli} não respondeu ao --help em 5 s: ficou o padrão dele.`;
  const oque = { "nao-aceita-modelo": "o modelo", "nao-aceita-esforco": "o esforço", "nao-aceita-modelo-nem-esforco": "o modelo nem o esforço" }[aviso];
  return `O ${cli} deste computador não aceita ${oque} pela linha de comando: ficou o padrão dele.`;
}

// Abrir sessão com a pasta.

export const LIMITE_DO_PROMPT = 256 * 1024;

function bytesUtf8(texto: string): number {
  let n = 0;
  for (const c of texto) {
    const p = c.codePointAt(0)!;
    n += p < 0x80 ? 1 : p < 0x800 ? 2 : p < 0x10000 ? 3 : 4;
  }
  return n;
}

export type MotivoDeNaoAbrir = "sem-prompt" | "prompt-grande" | "cli-ausente" | "nao-moveu" | "sessao-falhou";

export interface ResultadoDeAbrir {
  abriu: boolean;
  motivo?: MotivoDeNaoAbrir;
  /** Onde a pasta ficou. */
  pasta: string;
  /** A ficha da CLI em Ferramentas abriu. */
  ficha?: boolean;
}

/**
 * Abre a sessão com o prompt da pasta. A pasta vai para continuados antes da CLI, a sessão recebe a
 * linha "já moveu" e, se a sessão não abrir, a pasta volta ao caminho exato.
 */
export async function abrirPasta(
  arquivos: Arquivos,
  p: {
    brain: string;
    pasta: string;
    app: string;
    cliExiste: () => Promise<boolean>;
    iniciar: (prompt: string) => Promise<boolean>;
  },
): Promise<ResultadoDeAbrir> {
  const prompt = arquivos.ler(`${p.pasta}/prompt.txt`) ?? "";
  if (!prompt) return { abriu: false, motivo: "sem-prompt", pasta: p.pasta };
  if (bytesUtf8(prompt) > LIMITE_DO_PROMPT) return { abriu: false, motivo: "prompt-grande", pasta: p.pasta };
  if (!(await p.cliExiste().catch(() => false))) return { abriu: false, motivo: "cli-ausente", pasta: p.pasta, ficha: true };
  let destino: string;
  try {
    destino = moverSemSobrescrever(arquivos, p.pasta, `${p.brain}/continuar/continuados`);
  } catch {
    return { abriu: false, motivo: "nao-moveu", pasta: p.pasta };
  }
  const relativo = destino.slice(p.brain.length + 1);
  const texto = `(O ${p.app} já moveu esta pasta para ${relativo}/: o primeiro passo está feito.)\n\n${prompt}`;
  if (await p.iniciar(texto).catch(() => false)) return { abriu: true, pasta: destino };
  try {
    desfazerMover(arquivos, destino, p.pasta);
    return { abriu: false, motivo: "sessao-falhou", pasta: p.pasta };
  } catch {
    return { abriu: false, motivo: "sessao-falhou", pasta: destino };
  }
}

/** Copiar o prompt não move a pasta. */
export function copiarPrompt(arquivos: Arquivos, pasta: string): string {
  return arquivos.ler(`${pasta}/prompt.txt`) ?? "";
}
