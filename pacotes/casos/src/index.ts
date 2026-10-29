// Formato dos casos de prova: carrega os JSON de casos-de-prova/ e confere cada um
// contra o esquema.json. A validação é própria e cobre só o pedaço de JSON Schema
// que o esquema usa (type, required, properties, additionalProperties, enum,
// pattern, minLength), para não trazer dependência nova.

export interface Arquivo {
  /** Caminho relativo a casos-de-prova/, como "vault/CP-VLT-01.json". */
  caminho: string;
  texto: string;
}

export interface Caso {
  id: string;
  contrato: string;
  regra: string;
  relogio: string;
  fuso: string;
  entrada: Record<string, unknown>;
  esperado: Record<string, unknown>;
  mac: string;
}

interface Campo {
  type?: "string" | "object";
  enum?: string[];
  pattern?: string;
  minLength?: number;
}

export interface Esquema {
  type: "object";
  required: string[];
  additionalProperties: boolean;
  properties: Record<string, Campo>;
}

/** Cada prefixo de id pertence a um contrato só. */
export const CONTRATO_DO_PREFIXO: Record<string, string> = {
  "CP-API": "api",
  "CP-PAP": "papel",
  "CP-DIA": "dia",
  "CP-VLT": "vault",
  "CP-ESP": "espacos",
  "CP-CNV": "canvas",
  "CP-TEL": "tela",
  "CP-GIT": "git",
  "CP-PRC": "processos",
  "CP-CON": "continuar",
  "CP-ENV": "envios",
  "CP-ATU": "versao",
  "CP-DES": "desfazer",
  "CP-LOT": "lote",
  "CP-LNK": "links",
  "CP-REG": "registro",
  "CP-LST": "lista",
};

function tipo(valor: unknown): string {
  if (valor === null) return "null";
  if (Array.isArray(valor)) return "array";
  return typeof valor;
}

/** Erros do caso contra o esquema, em português; lista vazia quando está certo. */
export function validar(valor: unknown, esquema: Esquema): string[] {
  if (tipo(valor) !== "object") return ["o caso tem que ser object"];
  const caso = valor as Record<string, unknown>;
  const erros: string[] = [];
  for (const nome of esquema.required) {
    if (!(nome in caso)) erros.push(`falta o campo ${nome}`);
  }
  for (const [nome, v] of Object.entries(caso)) {
    const campo = esquema.properties[nome];
    if (!campo) {
      if (!esquema.additionalProperties) erros.push(`campo que não existe no formato: ${nome}`);
      continue;
    }
    if (campo.type && tipo(v) !== campo.type) {
      erros.push(`${nome} tem que ser ${campo.type}`);
      continue;
    }
    if (typeof v !== "string") continue;
    if (campo.minLength !== undefined && v.length < campo.minLength) erros.push(`${nome} vazia`);
    else if (campo.enum && !campo.enum.includes(v)) erros.push(`${nome} desconhecido: ${v}`);
    else if (campo.pattern && !new RegExp(campo.pattern, "u").test(v)) erros.push(`${nome} fora do padrão: ${v}`);
  }
  return erros;
}

function nomeDoArquivo(caminho: string): string {
  return caminho.slice(caminho.lastIndexOf("/") + 1);
}

/**
 * Lê os arquivos, confere o formato, o nome do arquivo, o contrato do prefixo,
 * a lista de ids e a repetição. Arquivo com erro não vira caso.
 */
export function carregar(arquivos: Arquivo[], esquema: Esquema, ids: string[]): { casos: Caso[]; erros: string[] } {
  const casos: Caso[] = [];
  const erros: string[] = [];
  const onde = new Map<string, string>();
  const conhecidos = new Set(ids);
  // A ordem de entrada decide quem é "o primeiro" na mensagem de repetição.
  for (const arquivo of arquivos) {
    let valor: unknown;
    try {
      valor = JSON.parse(arquivo.texto);
    } catch (e) {
      erros.push(`${arquivo.caminho}: JSON quebrado (${(e as Error).message})`);
      continue;
    }
    const doFormato = validar(valor, esquema);
    if (doFormato.length > 0) {
      for (const erro of doFormato) erros.push(`${arquivo.caminho}: ${erro}`);
      continue;
    }
    const caso = valor as Caso;
    const proprios: string[] = [];
    if (nomeDoArquivo(arquivo.caminho) !== `${caso.id}.json`) {
      proprios.push(`o arquivo tem que se chamar ${caso.id}.json`);
    }
    const doPrefixo = CONTRATO_DO_PREFIXO[caso.id.slice(0, 6)];
    if (doPrefixo !== caso.contrato) {
      proprios.push(`${caso.id.slice(0, 6)} é do contrato ${doPrefixo ?? "nenhum"}, não ${caso.contrato}`);
    }
    if (!conhecidos.has(caso.id)) proprios.push(`id fora do ids.json: ${caso.id}`);
    if (proprios.length > 0) {
      for (const erro of proprios) erros.push(`${arquivo.caminho}: ${erro}`);
      continue;
    }
    const primeiro = onde.get(caso.id);
    if (primeiro !== undefined) {
      erros.push(`id repetido: ${caso.id} em ${primeiro} e ${arquivo.caminho}`);
      continue;
    }
    onde.set(caso.id, arquivo.caminho);
    casos.push(caso);
  }
  return { casos, erros };
}

/** Ids da lista que nenhum caso cobre, na ordem da lista. */
export function faltam(casos: Caso[], ids: string[]): string[] {
  const tem = new Set(casos.map((c) => c.id));
  return ids.filter((id) => !tem.has(id));
}
