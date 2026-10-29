# Casos de prova

Um contrato, dois códigos: o Tenancy para Mac (Swift) e este app (TypeScript) passam os mesmos casos. Cada caso é um arquivo JSON nesta pasta, lido pelo vitest aqui e por um teste do Mac.

## Formato

| Campo | O que é |
|---|---|
| `id` | Código do caso, como `CP-ENV-07` |
| `contrato` | O assunto, pelo prefixo do id (tabela abaixo) |
| `regra` | A regra em uma frase |
| `relogio` | A hora do caso, ISO 8601 com fuso |
| `fuso` | O fuso usado nas contas de data |
| `entrada` | Arquivos, respostas de rede e parâmetros |
| `esperado` | O resultado |
| `mac` | `passa`, ou `pendente: <motivo>` quando o Mac ainda não tem o comportamento |

Telas de terminal ficam em `.txt` ao lado do caso que as usa.

O arquivo se chama `<id>.json` e fica na pasta do contrato. O formato está em [esquema.json](esquema.json); a lista de ids que precisam existir, em [ids.json](ids.json), tirada das tabelas de casos da spec.

| Prefixo | Contrato | Pasta |
|---|---|---|
| `CP-API` | `api` | `api/` |
| `CP-PAP` | `papel` | `papel/` |
| `CP-DIA` | `dia` | `dia/` |
| `CP-VLT` | `vault` | `vault/` |
| `CP-ESP` | `espacos` | `espacos/` |
| `CP-CNV` | `canvas` | `canvas/` |
| `CP-TEL` | `tela` | `tela/` |
| `CP-GIT` | `git` | `git/` |
| `CP-PRC` | `processos` | `processos/` |
| `CP-CON` | `continuar` | `continuar/` |
| `CP-ENV` | `envios` | `envios/` |
| `CP-ATU` | `versao` | `versao/` |
| `CP-DES` | `desfazer` | `desfazer/` |
| `CP-LOT` | `lote` | `lote/` |
| `CP-LNK` | `links` | `links/` |
| `CP-REG` | `registro` | `registro/` |
| `CP-LST` | `lista` | `lista/` |

## Conferir

`npm test -w pacotes/casos` lê todos os JSON desta pasta e falha com formato errado, nome de arquivo diferente do id, prefixo de outro contrato, id repetido ou id fora do `ids.json`. Cada pacote de núcleo lê os casos da sua pasta e confere o comportamento.

Quando o `esperado` traz `arquivos`, valem os arquivos que o contrato do caso toca. Arquivo que outro contrato grava no mesmo passo (no Mac, a marca `.ia/rotinas-semeadas` e o `rotinas/Leia-me.md` da semeadura das rotinas) fica fora da comparação.

## Regras

- Só nomes fictícios. Nada do time, de cliente ou de sócio.
- Domínio `exemplo.invalid` em todo endereço.
- Relógio e fuso sempre explícitos. Nenhum caso depende da hora da máquina.
- Quando o comportamento muda, o caso muda primeiro e os dois códigos depois.
