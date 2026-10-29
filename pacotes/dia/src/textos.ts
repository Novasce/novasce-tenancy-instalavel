// Os textos dos cinco dias: o pedido do "O dia" e as habilidades que o app leva.
// founder, vendas e time são os do Tenancy (macOS); marketing e design, o texto cortado em
// 26/10. Gerado das fontes, não editar à mão: o caso de prova confere os bytes.

import type { Rotina } from "./rotina";

export type Dia = "founder" | "vendas" | "marketing" | "design" | "time";

function oDia(pedido: string, habilidade: string, permite: string[]): Rotina {
  return { id: "o-dia", nome: "O dia", quando: "dias úteis 07:15", pedido, ia: "claude", habilidade, avisa: false, onde: "topo", permite, ligada: true, rascunho: false };
}

export const ROTINAS_DO_DIA: Record<Dia, Rotina> = {
  founder: oDia(
    "faça o briefing do dia em até 8 linhas, para o topo da minha nota de hoje: a uma coisa que fecha um ciclo ou traz dinheiro, o que apodrece e o que andou sem mim. Não grave nada: a resposta vai para a nota.",
    "briefing-do-dia",
    ["Read", "mcp__tenancy__dashboard_hoje", "mcp__tenancy__list_tickets_abertos", "mcp__tenancy__caixa", "mcp__tenancy__fila_de_pagamento"],
  ),
  vendas: oDia(
    "faça o briefing de vendas do dia em até 8 linhas, para o topo da minha nota de hoje: as ligações de hoje, em ordem, com o porquê e o próximo passo de cada uma, e o que andou sem mim. As ligações vêm no fim deste pedido, do seu painel no Tenancy. Não grave nada: a resposta vai para a nota.",
    "briefing-de-vendas",
    ["Read", "mcp__tenancy__search_customers", "mcp__tenancy__get_customer"],
  ),
  marketing: oDia(
    "faça o briefing de marketing do dia em até 8 linhas, para o topo da minha nota de hoje: o que vai ao ar hoje e se está pronto, o que espera aprovação, o ritual do dia da semana e o que andou sem mim. A pauta é do quadro: não proponha peça nova. Não grave nada: a resposta vai para a nota.",
    "briefing-de-marketing",
    ["Read", "mcp__tenancy__list_tasks", "mcp__tenancy__get_task", "mcp__tenancy__list_market_studies"],
  ),
  design: oDia(
    "faça o briefing de design do dia em até 8 linhas, para o topo da minha nota de hoje: a arte que entrego hoje e a que vence nos próximos três dias, o que espera aprovação, a direção criativa parada e o que andou sem mim. Não grave nada: a resposta vai para a nota.",
    "briefing-de-design",
    ["Read", "mcp__tenancy__list_tasks", "mcp__tenancy__get_task", "mcp__tenancy__list_brand_references", "mcp__tenancy__brand_review", "mcp__tenancy__get_brand"],
  ),
  time: oDia(
    "faça o briefing do dia em até 8 linhas, para o topo da minha nota de hoje: a uma coisa que fecha hoje, o que está parado e o que andou sem mim. Não grave nada: a resposta vai para a nota.",
    "briefing-do-dia",
    ["Read", "mcp__tenancy__list_tasks", "mcp__tenancy__get_task"],
  ),
};

export const HABILIDADES: Record<string, string> = {
  "briefing-do-dia": "---\nname: briefing-do-dia\ndescription: O briefing da manhã, em até 8 linhas, para o topo da nota do dia. Lê os seus cartões no Tenancy pelo MCP e não grava nada.\n---\n# Briefing do dia\n\n1. Liste os seus cartões no Tenancy (list_tasks) em Fazendo e em Review. Os que vencem hoje ou já venceram vêm primeiro.\n2. Para o que estiver parado há mais tempo, leia o cartão (get_task) e diga o próximo passo numa linha.\n3. Escreva em até 8 linhas: a uma coisa que fecha hoje, o que está parado e o que andou desde ontem.\n4. Se uma ferramenta recusar, diga numa linha o que faltou (por exemplo, a chave do Tenancy) e siga com o resto.\n5. Não grave nada no Tenancy: a resposta vai para a nota do dia.\n",
  "briefing-de-vendas": "---\nname: briefing-de-vendas\ndescription: O briefing da manhã de quem vende, em até 8 linhas: os clientes para ligar, o porquê e o próximo passo de cada um. Parte das ligações do painel, que vêm no pedido, e não grava nada.\n---\n# Briefing de vendas\n\n1. Comece pelas ligações que vêm no fim do pedido: elas saem do seu painel no Tenancy, das negociações abertas há mais tempo.\n2. Para cada uma, tente a ficha do cliente (get_customer, ou search_customers pelo nome): a proposta atual e a última conversa registrada. O papel de vendedor nem sempre abre a ficha.\n3. Escreva em até 8 linhas: as ligações de hoje (quem, por quê e o próximo passo) e o que andou desde ontem nas suas notas.\n4. Se uma ferramenta recusar, diga numa linha o que faltou (por exemplo, a ficha do cliente ou a chave do Tenancy) e siga com o que veio no pedido.\n5. Não grave nada no Tenancy: a resposta vai para a nota do dia.\n",
  "briefing-de-marketing": "---\nname: briefing-de-marketing\ndescription: O briefing da manhã de quem cuida do marketing, em até 8 linhas, para o topo da nota do dia: o que vai ao ar hoje, o que espera aprovação, o ritual do dia e o que andou. Lê o quadro pelo MCP e não grava nada.\n---\n# Briefing de marketing\n\n1. Liste os cartões de conteúdo e de marketing (list_tasks, kind CONTEUDO e depois MARKETING). O quadro é a verdade: não invente pauta nem proponha peça nova.\n2. O que vai ao ar hoje: peças com vencimento hoje. Em FEITO está aprovada e falta agendar ou publicar; em FAZENDO ou REVIEW com vencimento hoje é risco, diga qual. Vencida sem \"no ar\" nos comentários vem primeiro.\n3. O que espera o founder: peças em REVIEW e há quantos dias. Se FAZENDO passar de três, diga.\n4. O ritual do dia da semana, numa linha: segunda, agendar o que está em FEITO; quarta, a pergunta da semana; sexta, os 15 minutos do founder no REVIEW (na primeira sexta do mês, também os três números); sábado, o Radar. Terça e quinta lembram o bastidor cru de 15 s, que é do founder.\n5. Números D+7: peça publicada há sete dias ou mais sem métricas na descrição, até três, pedindo alcance, envios, comentários e DMs. Envio pesa mais que like. Se a pessoa cuida da linha Food, uma linha com os estudos de mercado que pedem decisão (list_market_studies).\n6. Escreva em até 8 linhas, nesta ordem: o que vai ao ar hoje, o que espera aprovação, o ritual do dia, os números pendentes e o que andou desde ontem.\n7. Se uma ferramenta recusar, diga numa linha o que faltou e siga com o resto. Não grave nada no Tenancy: a resposta vai para a nota do dia.\n",
  "briefing-de-design": "---\nname: briefing-de-design\ndescription: O briefing da manhã de quem cuida da marca e do design, em até 8 linhas, para o topo da nota do dia: a arte que entrega hoje, o que espera o founder, a direção criativa e as telas com guia. Lê o Tenancy pelo MCP e não grava nada.\n---\n# Briefing de design\n\n1. Liste os seus cartões (list_tasks) em Fazendo e em Review, e as peças de conteúdo (kind CONTEUDO) dos próximos três dias. Arte vem antes de legenda: peça com arte \"a criar\" e vencimento perto é a primeira coisa do dia.\n2. O que espera o founder: cartões seus em REVIEW e há quantos dias. Peça aprovada (FEITO) com arte ainda por agendar, avise quem publica.\n3. A direção criativa, pela aba Marca (list_brand_references, produto NOVASCE): referências na fila sem decisão e as em prancha paradas há mais de uma semana, até três, com o título. Na primeira segunda do mês, puxe o rascunho da review (brand_review) e diga os números do período numa linha.\n4. Tela e guia: cartão de desenvolvimento ou de revisão de UX do SOPEC que toque uma tela com guia pede o guia conferido no mesmo ciclo (list_tasks com etiqueta design ou ux). Diga qual, numa linha.\n5. Escreva em até 8 linhas, nesta ordem: a arte de hoje, o que espera aprovação, a direção criativa, as telas com guia e o que andou desde ontem.\n6. Se uma ferramenta recusar, diga numa linha o que faltou e siga com o resto. Não grave nada no Tenancy: a resposta vai para a nota do dia.\n",
};
