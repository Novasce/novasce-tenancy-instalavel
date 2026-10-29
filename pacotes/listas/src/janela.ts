// A janela visível da lista: quais linhas estão à vista e qual cabeçalho de
// grupo fica preso no topo. A rolagem é interna à região da lista; o cabeçalho
// fica por cima das linhas e não ocupa linha.

export interface Grupo {
  nome: string;
  quantos: number;
}

export interface PedidoDeJanela {
  alturaLinha: number;
  alturaRegiao: number;
  rolagem: number;
  grupos: Grupo[];
}

export interface Janela {
  inicio: number;
  fim: number;
  grupoPreso: string | null;
  rotulo: string;
}

export function janelaVisivel(p: PedidoDeJanela): Janela {
  const total = p.grupos.reduce((s, g) => s + g.quantos, 0);
  if (!total || p.alturaLinha <= 0 || p.alturaRegiao <= 0) {
    return { inicio: 0, fim: -1, grupoPreso: null, rotulo: rotulo(total, 0) };
  }
  const maxRolagem = Math.max(total * p.alturaLinha - p.alturaRegiao, 0);
  const rolagem = Math.min(Math.max(p.rolagem, 0), maxRolagem);
  const inicio = Math.floor(rolagem / p.alturaLinha);
  const fim = Math.min(Math.ceil((rolagem + p.alturaRegiao) / p.alturaLinha) - 1, total - 1);
  return { inicio, fim, grupoPreso: grupoDaLinha(p.grupos, inicio), rotulo: rotulo(total, fim - inicio + 1) };
}

export function grupoDaLinha(grupos: Grupo[], linha: number): string | null {
  let ate = 0;
  for (const g of grupos) {
    ate += g.quantos;
    if (linha < ate) return g.nome;
  }
  return null;
}

function rotulo(total: number, aVista: number): string {
  return `${total === 1 ? "1 item" : `${total} itens`} · ${aVista} à vista`;
}
