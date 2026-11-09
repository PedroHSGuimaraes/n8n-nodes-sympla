# Changelog

## 0.2.0

Completa o node no mesmo recorte do contrato público, com formulário fechado e polling.

- 15 operações e os 44 caminhos de produto do OpenAPI 2.0.68, nas versões 1.6.0, 1.5.1 e 1.5.0.
- Listas pesquisáveis para evento, apresentação, pedido, participante e número do ingresso. O seletor de evento aparece em Obter evento e em toda lista cujo path leva `{eventId}`. O fuso horário fica só nas leituras.
- Return All e Limit. Cursor repetido ou Max Pages com próxima página ainda existente falha sem lista parcial.
- `status` de pedido e a janela de Get Order só nas versões 1.5.x. `ticket_number` também na lista de participantes da apresentação nessas versões.
- Check-in por QR continua com campos soltos e segue ausente na 1.5.0. Escrita não é repetida.
- Sympla Trigger faz polling de pedidos, participantes ou check-ins. Não há webhook no contrato, e o node não inventa um.
- Credencial com teste somente leitura em `GET /v1.6.0/events`.
- Node de ação utilizável como ferramenta de AI Agent. O trigger não entra no seletor de ferramenta.
- Sem token real de produtor e sem publicação no npm.

## 0.1.0

Primeira versão do node comunitário Sympla.

- 15 operações sobre os caminhos publicados no OpenAPI público, nas versões 1.6.0, 1.5.1 e 1.5.0.
- Credencial com teste somente leitura em `GET /v1.6.0/events`.
- Check-in por ID, número do ingresso e QR code, este último ausente na 1.5.0.
- Node de ação utilizável como ferramenta de AI Agent.
- Sem sandbox da Sympla e sem publicação no npm.
