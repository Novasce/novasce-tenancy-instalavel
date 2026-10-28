# Tenancy instalável

## TLDR

- O Tenancy para Linux e Windows: o dia da pessoa do time, com a IA dela ao lado. Feito pela Novasce.
- Ainda não há app para usar. Por enquanto este repositório tem a **sonda**, um app de teste que confere, numa máquina Linux, se o pacote, as permissões e o motor da tela se comportam como o app vai precisar.
- Linux primeiro, em Flatpak. Windows depois.
- O código é público para leitura. Não há licença por ora: todos os direitos são reservados à Novasce.

## O que tem aqui

| Pasta | Para quê |
|---|---|
| `apps/sonda/` | A sonda: Tauri 2, React e TypeScript. Só para teste; nunca se passa pelo produto |
| `pacotes/` | Os núcleos em TypeScript, um por contrato (ainda vazio) |
| `casos-de-prova/` | Os casos que este app e o Tenancy para Mac passam igual (formato no README da pasta) |
| `flatpak/` | O manifesto da sonda, o gerador do canal de teste e o script que cria a chave do canal (a parte privada vai direto para os segredos do GitHub) |
| `.github/workflows/` | Conferência (segredos, tipos, testes) e o canal de teste |

## Canal de teste

A sonda sai num canal de teste, assinado, nas páginas deste repositório. É só para conferir o pacote numa máquina da casa. Não há versão para uso.

## Regras deste repositório

1. Nenhum segredo, token, chave ou senha, nem falso com cara de real.
2. Nenhum endereço interno. Endereços de serviço são configuração, nunca constante no código.
3. Casos de prova e dados de exemplo só com nomes fictícios.
4. Varredura de segredos em todo envio, aqui e no CI.

Problema de segurança: veja [SEGURANCA.md](SEGURANCA.md).
