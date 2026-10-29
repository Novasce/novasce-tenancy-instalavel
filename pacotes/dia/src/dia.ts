// Qual "O dia" cada pessoa recebe e o que ele põe no Pessoal. A ficha "Meu dia" do colaborador no
// Tenancy manda; sem ficha, vale o papel. O dia do founder é só do founder, pelo id fixo da
// configuração: ADMIN deixa de ser critério.

import { HABILIDADES, ROTINAS_DO_DIA, type Dia } from "./textos";
import { pedidoFinal, rotinaParaMarkdown, type Rotina } from "./rotina";

export interface Pessoa {
  usuario: string;
  /** O papel da conta na Casa: VENDEDOR, MARKETING, ADMIN, DEV, SOCIO... */
  papel: string;
  /** O campo "Meu dia" da ficha, quando existe. */
  meuDia?: string;
}

const DIAS: Dia[] = ["founder", "vendas", "marketing", "design", "time"];

export function escolherDia(p: Pessoa, founder: string): Dia {
  if (p.usuario === founder) return "founder";
  // A ficha não faz ninguém virar founder.
  if (p.meuDia && p.meuDia !== "founder" && (DIAS as string[]).includes(p.meuDia)) return p.meuDia as Dia;
  if (p.papel === "VENDEDOR") return "vendas";
  if (p.papel === "MARKETING") return "marketing";
  return "time";
}

/** As habilidades que o dia leva: o briefing do dia, base de todos, e a do dia. */
export function habilidadesDoDia(dia: Dia): string[] {
  return [...new Set(["briefing-do-dia", ROTINAS_DO_DIA[dia].habilidade!])];
}

const DE_FABRICA = new Set(Object.values(ROTINAS_DO_DIA).map(rotinaParaMarkdown));

/**
 * Põe no Pessoal (caminhos relativos a ele) o `rotinas/o-dia.md` do dia e as habilidades. O
 * `o-dia.md` só é gravado quando falta ou ainda é um de fábrica; a habilidade nasce uma vez só,
 * pela marca em `.ia/`: a que a pessoa mudou não é reescrita, a que ela apagou não volta.
 */
export function prepararODia(pessoal: Record<string, string>, dia: Dia) {
  const arquivos = { ...pessoal };
  const alvo = rotinaParaMarkdown(ROTINAS_DO_DIA[dia]);
  const atual = arquivos["rotinas/o-dia.md"];
  let gravouODia = false;
  if (atual === undefined || (DE_FABRICA.has(atual) && atual !== alvo)) {
    arquivos["rotinas/o-dia.md"] = alvo;
    gravouODia = true;
  }
  const nasceram: string[] = [];
  for (const id of habilidadesDoDia(dia)) {
    const marca = `.ia/semeada-${id}`;
    if (marca in arquivos) continue;
    const skill = `.agents/skills/${id}/SKILL.md`;
    if (!(skill in arquivos)) {
      arquivos[skill] = HABILIDADES[id];
      nasceram.push(id);
    }
    arquivos[marca] = "";
  }
  return { arquivos, nasceram, gravouODia };
}

export interface Ligacao {
  cliente: string;
  /** Há quantos dias a negociação está aberta; nulo quando o painel não diz. */
  dias: number | null;
  /** A etapa do funil como a API manda (CustomerStage). */
  etapa?: string | null;
}

export function etapa(stage: string | null | undefined): string {
  const s = (stage ?? "").toUpperCase();
  const nomes: Record<string, string> = {
    "": "",
    LEAD: "contato novo",
    BRIEFING: "briefing",
    DEMO: "demonstração",
    PROPOSTA_ENVIADA: "proposta enviada",
    NEGOCIACAO: "negociação",
  };
  return s in nomes ? nomes[s] : (stage ?? "").toLowerCase().replace(/_/g, " ");
}

function contexto(l: Ligacao): string {
  const quando = l.dias === null ? "aberta" : l.dias === 0 ? "aberta hoje" : l.dias === 1 ? "aberta há 1 dia" : `aberta há ${l.dias} dias`;
  const e = etapa(l.etapa);
  return `${l.cliente} (negociação ${quando}` + (e === "" ? ")" : `, ${e})`);
}

/** O pedido do "O dia". Em vendas, as ligações do painel vão no fim, na ordem do painel. */
export function pedidoDoDia(r: Rotina, ligacoes: Ligacao[] = []): string {
  const base = pedidoFinal(r);
  if (r.habilidade !== "briefing-de-vendas" || ligacoes.length === 0) return base;
  return `${base} As ligações de hoje, do seu painel no Tenancy: ${ligacoes.map(contexto).join("; ")}.`;
}
