// A página Agentes da casca: o estado da janela do web. O conteúdo é do web;
// aqui só a entrada, a sessão vencida e a falta de rede (UC34).
import { EstadoDaTela } from "../casca/estado";
import type { EstadoDosAgentes } from "./agentes";

const TEXTOS: Record<EstadoDosAgentes, { estado: Parameters<typeof EstadoDaTela>[0]["estado"]; titulo: string; texto: string }> = {
  abrindo: { estado: "carregando", titulo: "Abrindo os agentes", texto: "Entrando no Tenancy com o login do sistema." },
  aberta: { estado: "vazio", titulo: "Agentes", texto: "A página dos agentes do Tenancy está aberta numa janela própria." },
  "sem-login": { estado: "sem-permissao", titulo: "Sem login do Tenancy", texto: "Entre pelo Começar do sistema para ver os agentes aqui." },
  vencida: { estado: "erro", titulo: "Sessão vencida", texto: "Entre de novo pelo Começar do sistema." },
  offline: { estado: "offline", titulo: "Sem internet", texto: "A página dos agentes abre quando a rede voltar." },
  recusado: { estado: "erro", titulo: "O Tenancy não aceitou a entrada", texto: "Entre de novo pelo Começar do sistema." },
};

export function PaginaDosAgentes(p: { estado: EstadoDosAgentes; trazer: () => void; tentar: () => void }) {
  const t = TEXTOS[p.estado];
  const acao =
    p.estado === "aberta"
      ? { rotulo: "Trazer a janela para a frente", fazer: p.trazer }
      : p.estado === "offline"
        ? { rotulo: "Tentar de novo", fazer: p.tentar }
        : undefined;
  return (
    <div className="pagina" data-pagina="agentes">
      <EstadoDaTela estado={t.estado} titulo={t.titulo} texto={t.texto} acao={acao} />
    </div>
  );
}
