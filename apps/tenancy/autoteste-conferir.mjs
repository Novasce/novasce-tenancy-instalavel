// Confere os JSON do autoteste de geometria (E9): nada sai do lugar, nada rola
// na horizontal, a lista de 300 só desenha o que está à vista e a lateral
// mantém 228 px. Imprime um resumo por medida e sai com 1 na primeira falha.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

let falhas = 0;
const linhas = [];
for (const arquivo of process.argv.slice(2)) {
  const nome = basename(arquivo, ".json");
  let s;
  try {
    s = JSON.parse(readFileSync(arquivo, "utf8").trim().split("\n").at(-1));
  } catch (e) {
    console.log(`${nome}: sem JSON (${e.message})`);
    falhas++;
    continue;
  }
  const problemas = [];
  if (s.erro) problemas.push(`erro: ${s.erro}`);
  if (s.maiorDeslocamento !== 0) {
    const mexeram = (s.acoes ?? []).filter((a) => a.maior > 0).map((a) => `${a.nome} (${a.maior} px: ${a.mexeram.join(", ")})`);
    problemas.push(`deslocamento ${s.maiorDeslocamento} px em ${mexeram.join("; ")}`);
  }
  if (s.rolagemHorizontal) problemas.push("rolagem horizontal");
  if (!(s.lista300?.linhasDesenhadas > 0 && s.lista300.linhasDesenhadas < 60)) problemas.push(`lista de 300 desenhou ${s.lista300?.linhasDesenhadas} linhas`);
  if (s.lista300 && Math.abs(s.lista300.larguraDaLateral - 228) > 0.5) problemas.push(`lateral com ${s.lista300.larguraDaLateral} px`);
  if (s.lista300?.paginaRolou) problemas.push("a página rolou com a lista");
  linhas.push(`${nome}: ${problemas.length ? "FALHA" : "ok"} · janela ${s.janela?.largura}×${s.janela?.altura} · escala ${s.escala} · terminal 10.000 linhas em ${s.terminal10k?.ms} ms · ${s.acoes?.length ?? 0} ações`);
  for (const p of problemas) linhas.push(`  ${p}`);
  falhas += problemas.length ? 1 : 0;
}
console.log(linhas.join("\n"));
process.exit(falhas ? 1 : 0);
