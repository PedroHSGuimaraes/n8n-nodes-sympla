# Cobertura da API pública Sympla

Fonte: OpenAPI 3.1 publicado em [https://developers.sympla.com.br/api-docs](https://developers.sympla.com.br/api-docs), portal [https://developers.sympla.com.br/api-doc/](https://developers.sympla.com.br/api-doc/). O arquivo lido para esta versão informa `info.version` 2.0.68. O servidor é `https://api.sympla.com.br/public`. A autenticação é o header `s_token`.

Os testes comparam os 44 caminhos de produto com `test/fixtures/paths.json`, extraído desse OpenAPI. O caminho `/error` é o modelo de erro do Swagger e não entra. Nenhum teste chama a Sympla. A matriz abaixo é o contrato publicado.

## Versões

| Versão | Paginação | QR code | `status` em pedidos | `ticket_number` na query |
| --- | --- | --- | --- | --- |
| 1.6.0 | `cursor` e `pagination.next_cursor` | sim | não | não |
| 1.5.1 | `page` e `pagination.has_next` | sim | sim, sem enum | sim |
| 1.5.0 | `page` e `pagination.has_next` | não | sim, sem enum | sim |

O padrão do node é 1.6.0. O node não inventa uma quarta versão.

## Operações

| Operação | Método e caminho | Observação |
| --- | --- | --- |
| `event.getMany` | `GET /events` | Exige `published`, `timezone` e `sort` |
| `event.get` | `GET /events/{eventId}` | O ID é o hash documentado |
| `order.getMany` | `GET /events/{eventId}/orders` | `status` só em 1.5.0 e 1.5.1 |
| `order.get` | `GET /events/{eventId}/orders/{orderId}` | 1.6.0 não tem query. 1.5.x aceita `timezone`, `from` e `to` |
| `order.getManyByPresentation` | `GET /events/{eventId}/presentations/{presentationId}/orders` | `status` só em 1.5.0 e 1.5.1 |
| `participant.getMany` | `GET /events/{eventId}/participants` | `ticket_number` só em 1.5.0 e 1.5.1. `from` e `to` filtram `ticket_updated_at` |
| `participant.get` | `GET /events/{eventId}/participants/{participantId}` | |
| `participant.getByTicketNumber` | `GET /events/{eventId}/participants/ticketNumber/{ticketNumber}` | |
| `participant.getManyByOrder` | `GET /events/{eventId}/orders/{orderId}/participants` | `fields` é obrigatório |
| `participant.getManyByPresentation` | `GET /events/{eventId}/presentations/{presentationId}/participants` | `ticket_number` só em 1.5.0 e 1.5.1 |
| `participant.checkIn` | `POST /events/{eventId}/participants/{participantId}/check-in` | Escrita. Sem retentativa. |
| `participant.checkInByTicketNumber` | `POST /events/{eventId}/participants/ticketNumber/{ticketNumber}/check-in` | Escrita. Sem retentativa. |
| `participant.checkInByQrCode` | `POST /events/{eventId}/qrcode/check-in` | Corpo `itemId`, `signature`, `timestamp`, `version`, `walletId`. Ausente em 1.5.0. |
| `presentation.getMany` | `GET /events/{eventId}/presentations` | Na 1.5.x, `published`, `sort`, `timezone` e `from` vêm do schema `presentationParameters` e saem explodidos |
| `presentation.get` | `GET /events/{eventId}/presentations/{presentationId}` | ID numérico |

O prefixo da versão (`/v1.6.0`, `/v1.5.1` ou `/v1.5.0`) é acrescentado a cada caminho. São 15 operações e 44 caminhos, porque o QR não existe na 1.5.0.

## Listas do formulário

| Busca | Endpoint de leitura |
| --- | --- |
| Eventos | `GET /events` |
| Apresentações | `GET /events/{eventId}/presentations` |
| Pedidos | `GET /events/{eventId}/orders` |
| Participantes | `GET /events/{eventId}/participants` |
| Número do ingresso | o mesmo endpoint de participantes; o valor escolhido é `ticket_number` |

Não há catálogo separado de sessões, pedidos ou participantes. A lista é a própria listagem documentada.

## Paginação

Return All percorre `next_cursor` na 1.6.0 e `page` + `has_next` na 1.5.x. Limit, com Return All desligado, pede páginas a partir de Page ou Cursor até juntar essa quantidade e descarta o excedente da última página. Nos dois modos, cursor repetido ou Max Pages com próxima página ainda existente interrompe sem devolver lista parcial.

Page Size vai em `page_size`. Eventos, pedidos e apresentações aceitam até 200. Participantes aceitam até 500.

## Polling

O OpenAPI não publica webhook. O Sympla Trigger não cria um. Ele relê a lista no agendamento do workflow:

| Watch | Lista | Ordenação |
| --- | --- | --- |
| Orders | `GET /events/{eventId}/orders` | `order_date` descendente |
| Participants | `GET /events/{eventId}/participants` | `ticket_created_at` descendente |
| Check Ins | a mesma lista de participantes | `ticket_updated_at` descendente, só itens com `checkin` |

A marca fica nos dados estáticos do workflow: a data mais nova vista e as chaves já emitidas. O primeiro poll ativo não emite o histórico. Se Max Pages estoura antes da marca, nada é emitido e a marca não anda.

## Fora do contrato

- Não há webhook, cadastro de webhook nem limite de requisições publicado. O node não cria nenhum dos dois.
- A ordenação de participantes na 1.6.0 aceita só `ticket_created_at` e `ticket_updated_at`. O node não reintroduz `email`, `ticket_number`, `check_in_date` ou `id`.
- `published` de eventos também aceita os aliases `true` e `false`. O formulário envia `published`, `not_published` ou `all`.
- `status` de pedido não tem enum no OpenAPI. O campo é texto livre só nas versões 1.5.x.
- Check-in altera presença. Não é repetido em 502, 504 nem falha de rede. Leitura repete 502, 504 e falha de rede, até quatro tentativas.
- Não houve verificação com token de produtor. Diferença entre o OpenAPI e a conta real continua limitação, não endpoint novo.
