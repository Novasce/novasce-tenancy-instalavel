// Encerramento e órfãos (UC22, casos CP-PRC). Decisão pura sobre uma tabela de
// processos; os sinais saem por uma mão que quem chama entrega (de mentira nos
// testes). Nada é encerrado sozinho: órfão só é oferecido.

import { duracao, mb } from "./formato";

export type Sinal = "HUP" | "TERM" | "KILL";

export interface Processo {
  pid: number;
  ppid: number;
  pgid: number;
  sid: number;
  /** Quando o processo começou. Pid igual com início diferente é outro processo. */
  inicio: string;
  argv?: string[];
  ambiente?: Record<string, string>;
  mb?: number;
}

export interface MaoDeProcessos {
  tabela(): Processo[];
  sinalAoGrupo(grupo: number, sinal: Sinal): void;
  sinalAoPid(pid: number, sinal: Sinal): void;
  esperar(ms: number): Promise<void>;
}

/** O app e os pais dele, até o processo 1. Nunca entram nos alvos. */
export function protegidos(pidDoApp: number, tabela: Processo[]): Set<number> {
  const por = new Map(tabela.map((p) => [p.pid, p]));
  const set = new Set<number>([pidDoApp]);
  let atual = por.get(pidDoApp);
  while (atual && atual.ppid > 1 && !set.has(atual.ppid)) {
    set.add(atual.ppid);
    atual = por.get(atual.ppid);
  }
  return set;
}

/**
 * A raiz, a sessão dela e os descendentes (inclusive quem abriu sessão
 * própria). Pid reaproveitado (início diferente) não atinge ninguém. Raiz que já
 * saiu ainda deixa a sessão dela como alvo.
 */
export function alvos(raiz: number, inicio: string, tabela: Processo[], prot: Set<number>): Processo[] {
  if (raiz <= 1) return [];
  const daRaiz = tabela.find((p) => p.pid === raiz);
  if (daRaiz && daRaiz.inicio !== inicio) return [];
  const conjunto = new Set<number>([raiz]);
  for (const p of tabela) if (p.sid === raiz) conjunto.add(p.pid);
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const p of tabela) if (!conjunto.has(p.pid) && conjunto.has(p.ppid)) {
      conjunto.add(p.pid);
      cresceu = true;
    }
  }
  return tabela.filter((p) => conjunto.has(p.pid) && p.pid > 1 && !prot.has(p.pid));
}

/**
 * Por grupo quando o grupo é só de alvos vivos; pelo pid quem divide o grupo
 * com o app ou com um protegido. Nunca o grupo do app, 0 ou 1.
 */
export function planoDeSinais(
  vivos: Processo[],
  prot: Set<number>,
  grupoDoApp: number,
  pidDoApp: number,
): { grupos: number[]; avulsos: number[] } {
  const alvo = vivos.filter((p) => p.pid > 1 && !prot.has(p.pid));
  const grupos = [...new Set(alvo.map((p) => p.pgid))]
    .filter((g) => g > 1 && g !== grupoDoApp && !prot.has(g))
    .sort((a, b) => a - b);
  const set = new Set(grupos);
  const avulsos = alvo.filter((p) => !set.has(p.pgid) && p.pid !== pidDoApp).map((p) => p.pid);
  return { grupos, avulsos };
}

export const PRAZO_DO_PEDIDO_MS = 3_000;
const PASSO_MS = 100;

export interface Encerramento {
  alvos: number;
  precisouDoKill: boolean;
  sobrou: Processo[];
}

/**
 * Pede com HUP e TERM, olha a cada 100 ms por até 3 s (quem nasce de um alvo no
 * meio também recebe o pedido), depois força com KILL quem sobrou.
 */
export async function encerrar(
  raizes: { pid: number; inicio: string }[],
  mao: MaoDeProcessos,
  o: { protegidos: Set<number>; grupoDoApp: number; pidDoApp: number },
): Promise<Encerramento> {
  const chave = (p: Processo) => `${p.pid}@${p.inicio}`;
  const conhecidos = new Map<string, Processo>();
  const juntar = (tabela: Processo[]): Processo[] => {
    const novos: Processo[] = [];
    for (const r of raizes) {
      if (!tabela.some((p) => p.pid === r.pid && p.inicio === r.inicio) && !conhecidos.size) continue;
      for (const p of alvos(r.pid, r.inicio, tabela, o.protegidos)) {
        if (!conhecidos.has(chave(p))) {
          conhecidos.set(chave(p), p);
          novos.push(p);
        }
      }
    }
    // Quem nasceu de um alvo ainda vivo.
    let cresceu = true;
    while (cresceu) {
      cresceu = false;
      const pids = new Set([...conhecidos.values()].map((p) => p.pid));
      for (const p of tabela) if (!conhecidos.has(chave(p)) && pids.has(p.ppid) && p.pid > 1 && !o.protegidos.has(p.pid)) {
        conhecidos.set(chave(p), p);
        novos.push(p);
        cresceu = true;
      }
    }
    return novos;
  };
  const vivosDe = (tabela: Processo[]) => {
    const agora = new Set(tabela.map(chave));
    return [...conhecidos.values()].filter((p) => agora.has(chave(p)));
  };
  const mandar = (lista: Processo[], sinais: Sinal[]) => {
    const plano = planoDeSinais(lista, o.protegidos, o.grupoDoApp, o.pidDoApp);
    for (const s of sinais) {
      for (const g of plano.grupos) mao.sinalAoGrupo(g, s);
      for (const pid of plano.avulsos) mao.sinalAoPid(pid, s);
    }
  };

  const iniciais = juntar(mao.tabela());
  if (!iniciais.length) return { alvos: 0, precisouDoKill: false, sobrou: [] };
  mandar(iniciais, ["HUP", "TERM"]);
  for (let t = 0; t < PRAZO_DO_PEDIDO_MS; t += PASSO_MS) {
    await mao.esperar(PASSO_MS);
    const tabela = mao.tabela();
    const novos = juntar(tabela);
    if (novos.length) mandar(novos, ["HUP", "TERM"]);
    if (!vivosDe(tabela).length) return { alvos: conhecidos.size, precisouDoKill: false, sobrou: [] };
  }
  const tabela = mao.tabela();
  juntar(tabela);
  const restantes = vivosDe(tabela);
  mandar(restantes, ["KILL"]);
  let sobrou = restantes;
  for (let i = 0; i < 20 && sobrou.length; i++) {
    await mao.esperar(50);
    sobrou = vivosDe(mao.tabela());
  }
  return { alvos: conhecidos.size, precisouDoKill: true, sobrou };
}

// MARK: órfãos

export type RotuloDeRaiz = "claude" | "codex" | "agy" | "shell" | "node" | "npm exec";
const AGENTES = new Set(["claude", "codex", "agy"]);
const SHELLS = new Set(["zsh", "bash", "sh", "fish"]);

function base(caminho: string): string {
  return caminho.split("/").pop() ?? caminho;
}

/** Como o app sobe uma sessão; o resto (daemon por caminho, tmux, shell de outro terminal) não é dele. */
export function rotuloDaRaiz(argv: string[]): RotuloDeRaiz | null {
  const [a0, a1] = argv;
  if (!a0) return null;
  if (AGENTES.has(a0)) return a0 as RotuloDeRaiz;
  if (base(a0) === "node") return a1 && AGENTES.has(base(a1)) ? (base(a1) as RotuloDeRaiz) : "node";
  if (a0.startsWith("/") && SHELLS.has(base(a0)) && a1 === "-l") return "shell";
  if (a0 === "npm exec" || a0.startsWith("npm exec ")) return "npm exec";
  return null;
}

export interface Orfao {
  raiz: number;
  inicio: string;
  rotulo: RotuloDeRaiz;
  /** Só o script ou o pacote, nunca os argumentos. */
  script: string | null;
  processos: Processo[];
}

/**
 * Processos de uma abertura anterior do app que seguem rodando sem aba: pai
 * morto, líder da própria sessão (ou sessão sem líder vivo), com a marca da
 * sessão do app no ambiente (dele ou, no npm exec, de um filho). Só oferece.
 */
export function orfaos(tabela: Processo[], prot: Set<number>, app: { marca: string; pacoteDoApp: string }): Orfao[] {
  const ehDoApp = (amb?: Record<string, string>) =>
    !!amb && (app.marca in amb || amb.__CFBundleIdentifier === app.pacoteDoApp || amb.FLATPAK_ID === app.pacoteDoApp);
  const pids = new Set(tabela.map((p) => p.pid));
  const achados: Orfao[] = [];
  for (const p of tabela) {
    if (p.ppid !== 1 || p.pid <= 1 || prot.has(p.pid)) continue;
    const lider = p.sid === p.pid;
    if (!lider && pids.has(p.sid)) continue;
    const rotulo = p.argv ? rotuloDaRaiz(p.argv) : null;
    if (!rotulo) continue;
    if (lider && (rotulo === "node" || rotulo === "npm exec")) continue;
    if (!lider && rotulo === "shell") continue;
    const prova =
      ehDoApp(p.ambiente) || (rotulo === "npm exec" && tabela.some((f) => f.ppid === p.pid && ehDoApp(f.ambiente)));
    if (!prova) continue;
    const grupo = alvos(p.pid, p.inicio, tabela, new Set());
    if (grupo.some((g) => prot.has(g.pid))) continue;
    const script = rotulo === "node" ? oQueRoda(p.argv!) : rotulo === "npm exec" ? pacoteDoNpx(p.argv!) : null;
    achados.push({ raiz: p.pid, inicio: p.inicio, rotulo, script, processos: grupo });
  }
  return achados;
}

/** O script do node, com só os três últimos trechos do caminho. */
export function oQueRoda(argv: string[]): string {
  const script = argv.slice(1).find((a) => !a.startsWith("-"));
  if (!script) return "node sem script";
  return script.split("/").slice(-3).join("/");
}

const OPCOES_COM_VALOR = new Set([
  "--registry",
  "--userconfig",
  "--cache",
  "--prefix",
  "--workspace",
  "-w",
  "--call",
  "-c",
  "--scope",
  "--node-options",
  "--script-shell",
  "--globalconfig",
]);

/** Só o nome do pacote do npm exec; argumentos e endereços nunca saem. */
export function pacoteDoNpx(argv: string[]): string {
  const tokens = argv.join(" ").split(/\s+/).filter(Boolean);
  let i = tokens.indexOf("exec");
  if (i < 0) return "npm exec sem pacote";
  for (i++; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "--") continue;
    if (OPCOES_COM_VALOR.has(t)) {
      i++;
      continue;
    }
    if (t.startsWith("-")) continue;
    if (t.includes("://") || (t.includes(":") && t.includes("@") && !t.startsWith("@"))) return "npm exec (endereço oculto)";
    return t;
  }
  return "npm exec sem pacote";
}

/** "node · servidor-exemplo/dist/index.js · há 1 h · 80 MB": um órfão por linha. */
export function linhaDoOrfao(o: Orfao, agora: number): string {
  const partes: string[] = [o.rotulo];
  if (o.script) partes.push(o.script);
  const inicio = Date.parse(o.inicio);
  if (inicio > 0) partes.push(`há ${duracao((agora - inicio) / 1000)}`);
  partes.push(mb(o.processos.reduce((s, p) => s + (p.mb ?? 0), 0)));
  return partes.join(" · ");
}
