// O vitest (vite) lê os JSON de casos-de-prova/ por import.meta.glob, sem Node.
interface ImportMeta {
  glob<T = unknown>(padrao: string | string[], opcoes: { eager: true; import: "default" }): Record<string, T>;
}
