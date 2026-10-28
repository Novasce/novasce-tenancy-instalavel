# Casos de prova

Um contrato, dois códigos: o Tenancy para Mac (Swift) e este app (TypeScript) passam os mesmos casos. Cada caso é um arquivo JSON nesta pasta, lido pelo vitest aqui e por um teste do Mac.

## Formato

| Campo | O que é |
|---|---|
| `id` | Código do caso, como `CP-ENV-07` |
| `contrato` | O assunto: `api`, `papel`, `dia`, `vault`, `canvas`, `tela`, `git`, `processos`, `continuar`, `envios`, `versao` |
| `regra` | A regra em uma frase |
| `relogio` | A hora do caso, ISO 8601 com fuso |
| `fuso` | O fuso usado nas contas de data |
| `entrada` | Arquivos, respostas de rede e parâmetros |
| `esperado` | O resultado |
| `mac` | `passa`, ou `pendente: <motivo>` quando o Mac ainda não tem o comportamento |

Telas de terminal ficam em `.txt` ao lado do caso que as usa.

## Regras

- Só nomes fictícios. Nada do time, de cliente ou de sócio.
- Domínio `exemplo.invalid` em todo endereço.
- Relógio e fuso sempre explícitos. Nenhum caso depende da hora da máquina.
- Quando o comportamento muda, o caso muda primeiro e os dois códigos depois.
