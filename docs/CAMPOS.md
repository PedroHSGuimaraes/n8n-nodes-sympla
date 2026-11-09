# Campos do formulário

Os rótulos do editor estão em inglês por causa das regras do n8n. Este guia está em português. Não há campo JSON. Texto vazio é omitido. Um seletor de lista envia o valor escolhido, ou o ID digitado no modo ID.

A versão padrão é `1.6.0`. O que uma versão não documenta não é enviado.

## Credencial Sympla API

| Campo | Envio | Observação |
| --- | --- | --- |
| Access Token | header `s_token` | Senha. Não entra em `Authorization`. |
| Base URL | origem da URL | Padrão `https://api.sympla.com.br/public`. Só HTTPS, sem usuário, senha, query ou fragmento. |

O teste da credencial chama `GET /v1.6.0/events` com `published=all`, `timezone=America/Sao_Paulo`, `sort=asc` e `page_size=1`.

## Comuns ao node Sympla

| Campo | Query ou caminho | Quando entra |
| --- | --- | --- |
| API Version | prefixo `/v1.5.0`, `/v1.5.1` ou `/v1.6.0` | Sempre. |
| Resource / Operation | escolhe o caminho | Sempre. |
| Event Name or ID | `{eventId}` | Toda operação cujo path leva o evento. A lista de eventos não pede esse campo. A busca chama `GET /events`. |
| Presentation Name or ID | `{presentationId}` | Precisa ser numérico. A lista chama `GET /events/{eventId}/presentations`. |
| Order ID | `{orderId}` | Get Order e participantes do pedido. A lista chama `GET /events/{eventId}/orders`. |
| Participant ID | `{participantId}` | Get e check-in por ID. A lista chama `GET /events/{eventId}/participants`. |
| Ticket Number | `{ticketNumber}` | Get e check-in por ingresso. A lista usa o mesmo endpoint e o valor é `ticket_number`. |
| Return All | segue páginas | Ligado: percorre tudo. Desligado: para em Limit. |
| Limit | não é query | Quantidade máxima de registros quando Return All está desligado. |
| Max Pages | não é query | Teto de requisições. Se ainda houver página, o node falha e não devolve lista parcial. |
| Page Size | `page_size` | Eventos, pedidos e apresentações: 1 a 200. Participantes: 1 a 500. |
| Page | `page` | Só nas versões 1.5.0 e 1.5.1, com Return All desligado. É a página inicial. |
| Cursor | `cursor` | Só na 1.6.0, com Return All desligado. Vazio lê a primeira página. |
| Timezone | `timezone` | Padrão `America/Sao_Paulo`. Get Order na 1.6.0 não tem query, então o valor não sai. |
| Include Envelope | não é query | Devolve o JSON cru da página, em uma requisição, em vez de um item por registro. |

## Evento

| Campo | Query | Valores |
| --- | --- | --- |
| Published | `published` | `published`, `not_published`, `all`. Obrigatório na lista. O contrato também aceita `true` e `false`; o formulário não os envia. |
| Sort | `sort` | `asc` ou `desc`. |
| Sort Field | `field_sort` | `start_date`, `end_date`, `name`. |
| From | `from` | ISO-8601 local na timezone. Vazio é omitido. |
| Event fields | `fields` | Lista documentada. Vazio omite `fields`. |

Get Event envia `timezone` e `fields`.

## Pedido

| Campo | Query | Versões |
| --- | --- | --- |
| Sort | `sort` | Todas. O padrão do formulário é `asc`. Na lista do evento, o padrão do contrato 1.6.0 é `desc`; `asc` continua válido. |
| Sort Field | `field_sort` | `order_date` (alias documentado de `created_at`), `updated_date`, `approved_date`, `buyer_email`, `status`, `id`. |
| From / To | `from`, `to` | Listas, nas três versões. Get Order só em 1.5.0 e 1.5.1. |
| Cancelled Filter | `cancelled_filter` | `none` omite a query. `include` e `only` são enviados. |
| Buyer Email | `buyer_email` | Correspondência exata. Vazio é omitido. |
| Order Status | `status` | Só 1.5.0 e 1.5.1. O OpenAPI não enumera os valores. Vazio é omitido. A 1.6.0 removeu o parâmetro. |
| Order fields | `fields` | Lista documentada. Vazio omite `fields`. |

Get Order na 1.6.0 não envia query.

## Participante

| Campo | Query | Observação |
| --- | --- | --- |
| Sort | `sort` | `asc` ou `desc`. |
| Sort Field | `field_sort` | `ticket_created_at` ou `ticket_updated_at`. A 1.6.0 não aceita os nomes antigos. |
| From / To | `from`, `to` | O contrato aplica o intervalo a `ticket_updated_at`. |
| Cancelled Filter | `cancelled_filter` | Igual ao pedido. |
| Participant Email | `participant_email` | Correspondência exata. Não existe na lista por pedido. |
| Ticket Number Filter | `ticket_number` | Só 1.5.0 e 1.5.1, nas listas do evento e da apresentação. A 1.6.0 removeu o filtro. |
| Participant fields | `fields` | Na lista por pedido, `fields` é obrigatório. Nas rotas por ingresso e por apresentação, o contrato não lista `ticket_group_*` nem `ticket_subgroup_*`; esses campos ficam de fora do seletor. |

Check-in por ID e por ingresso não tem corpo. Check-in por QR, nas versões 1.5.1 e 1.6.0:

| Campo | JSON |
| --- | --- |
| Item ID | `itemId` |
| Signature | `signature`, 130 a 132 caracteres |
| Timestamp | `timestamp`, inteiro |
| QR Version | `version`, número |
| Wallet ID | `walletId` |

A versão 1.5.0 não oferece a operação. Nenhuma escrita é repetida.

## Apresentação

| Campo | Query | Observação |
| --- | --- | --- |
| Published Only | `published` | Booleano. Na 1.6.0 é parâmetro próprio. Na 1.5.x o contrato agrupa `published`, `sort`, `timezone` e `from` em `presentationParameters`, com estilo de query explodido. O node envia os campos soltos, que é o padrão OpenAPI `form` + `explode`. |
| Online Sector | `filter_online_sector` | Padrão `true`. |
| Sort | `sort` | Obrigatório na 1.6.0. Na 1.5.x faz parte do grupo explodido. |
| Sort Field | `field_sort` | Só `start_date`. |
| From | `from` | Opcional. |
| Presentation fields | `fields` | Lista documentada. Vazio omite `fields`. |

Get Presentation envia `timezone` e `fields`.

## Sympla Trigger

É polling. Não há URL de webhook.

| Campo | Uso |
| --- | --- |
| API Version | Mesmas três versões. |
| Event Name or ID | Evento observado. A lista é a de eventos. |
| Watch | `orders` ordena por `order_date`. `participants` ordena por `ticket_created_at`. `checkIns` ordena por `ticket_updated_at` e só emite quem tem `checkin`. |
| Timezone | Query `timezone`. |
| Page Size | `page_size`, no máximo 200, valor aceito tanto em pedidos quanto em participantes. |
| Max Pages | Se a marca d'água não for alcançada, o poll falha e a marca não anda. |
| Manual Limit | Só o teste manual. O poll ativo emite todos os registros novos encontrados antes da marca. |

O primeiro poll ativo grava a marca e não emite o histórico. O teste manual mostra a página atual e não grava a marca. Check-in não tem endpoint de listagem: o node lê participantes. O filtro `from` dessa lista, no contrato, vale para `ticket_updated_at`. Se a Sympla não atualizar essa data no check-in, o poll não vê o check-in. Isso não foi verificado com token real.
