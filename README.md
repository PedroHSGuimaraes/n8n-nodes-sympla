# n8n-nodes-sympla

Node comunitário do n8n para a API pública da Sympla. Cobre eventos, apresentações, pedidos, participantes e check-in, nas versões 1.6.0, 1.5.1 e 1.5.0 do contrato. O node de ação também pode ser ligado como ferramenta de AI Agent por `usableAsTool`. O trigger acompanha pedidos, participantes ou check-ins por polling.

A referência oficial está em [https://developers.sympla.com.br/api-doc/](https://developers.sympla.com.br/api-doc/). O OpenAPI usado nesta versão está em [https://developers.sympla.com.br/api-docs](https://developers.sympla.com.br/api-docs) (`info.version` 2.0.68). A matriz fica em [docs/COBERTURA.md](docs/COBERTURA.md). Os campos ficam em [docs/CAMPOS.md](docs/CAMPOS.md).

Este diretório é o pacote. Ele fica ao lado do pacote da Convenia, no mesmo repositório, para não misturar os `package.json`. A publicação no npm não faz parte desta versão.

## Instalação local

Na raiz deste diretório, com Node.js 24:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

| Peça | Versão usada para desenvolver |
| --- | --- |
| n8n | 2.47.2 |
| n8n-workflow | 2.47.0, peer `*` |
| Node.js | 24 |
| @n8n/node-cli | 0.55.5 |
| API Sympla | OpenAPI 2.0.68, versões 1.5.0, 1.5.1 e 1.6.0 |

No n8n 2.47, o pacote instalado fica em `~/.n8n/nodes`. `n8n.strict` está ligado. Os rótulos do editor estão em inglês por causa dessas regras. Este README está em português.

Nodes comunitários não verificados não aparecem no n8n Cloud. Este pacote não passou por verificação da n8n.

## Credencial

Crie **Sympla API**:

1. Em Minha Conta, Integrações, crie uma chave de acesso.
2. Cole a chave em **Access Token**. Ela sai no header `s_token`, não em `Authorization`.
3. Deixe a URL base em `https://api.sympla.com.br/public`.
4. O teste chama `GET /v1.6.0/events` com `published=all`, `timezone=America/Sao_Paulo`, `sort=asc` e `page_size=1`. É leitura.

Sem essa chave, o teste da credencial e qualquer execução real falham. Os testes deste repositório usam fixtures.

## Formulário

Escolha **API Version**, **Resource** e **Operation**. O padrão é a versão 1.6.0, com paginação por cursor. As versões 1.5.1 e 1.5.0 usam `page` e `has_next`. Check-in por QR code não aparece na 1.5.0.

Não há campo de JSON. O QR pede Item ID, Signature, Timestamp, QR Version e Wallet ID.

Evento, apresentação, pedido, participante e número do ingresso podem ser escolhidos numa lista. A lista chama o GET documentado daquele recurso. Dá para trocar para o modo ID e colar o valor, ou usar uma expressão. Apresentação precisa ser numérica. Pedido é o `sk` devolvido pela API.

**Return All** segue o cursor ou a página. **Limit** vale com Return All desligado e corta a quantidade de registros. Os dois falham, sem devolver lista parcial, se passarem de **Max Pages** com próxima página ainda existente ou se um cursor se repetir. **Page Size** vai em `page_size`. Eventos, pedidos e apresentações aceitam até 200. Participantes aceitam até 500.

Filtros que o contrato tirou de uma versão não são enviados. `ticket_number` e `status` de pedido ficam só na 1.5.x. Get Order na 1.6.0 não tem query.

## Check-in e agente

Check-in grava presença. A operação não é repetida em 502, 504 nem falha de rede. Leitura repete esses casos, com espera crescente, até quatro tentativas.

No AI Agent, ligue a saída **Tool** ao agente. A descrição pede leitura primeiro e confirmação humana antes do check-in. O trigger não entra nessa lista: trigger não é ferramenta.

## Polling

O contrato público não publica webhook nem limite de requisições por minuto. O pacote não simula nenhum dos dois. Dois workflows no mesmo token não são coordenados por este pacote, porque não existe um limite documentado para coordenar.

O **Sympla Trigger** relê a API no intervalo de polling do workflow:

- **Orders** lista pedidos por `order_date`.
- **Participants** lista participantes por `ticket_created_at`.
- **Check Ins** usa a mesma lista de participantes, ordenada por `ticket_updated_at`, e só emite quem tem `checkin`.

O primeiro poll com o workflow ativo grava a marca e não dispara o histórico. Um teste manual mostra a página atual e não grava a marca. Se a leitura passar de Max Pages antes de alcançar a marca, o poll falha e a marca fica onde estava.

Check-in não tem fila própria. Se a Sympla não mover `ticket_updated_at` quando alguém faz check-in, esse acompanhamento não vê o evento. A documentação do `from` dessa lista fala em `ticket_updated_at`, e o comportamento real depende da conta.

## Exemplos

Os arquivos em `workflows/` não contêm token.

- `workflows/eventos.json` lista eventos publicados.
- `workflows/check-in.json` faz check-in por ID vindo do item anterior.
- `workflows/agente-leitura.json` liga a consulta de evento como ferramenta do AI Agent.
- `workflows/polling.json` observa pedidos novos. O workflow vem desligado.

Não rode `npm publish`. Não há tag nesta versão.

## O que ainda depende de um token real

- O teste da credencial contra `https://api.sympla.com.br`.
- A ordem real de `order_date`, `ticket_created_at` e `ticket_updated_at`.
- Se o check-in atualiza `ticket_updated_at`.
- Os valores aceitos em `status` nas versões 1.5.x, porque o OpenAPI não os enumera.
- Se o grupo `presentationParameters` da 1.5.x chega explodido, como o padrão OpenAPI descreve e como o node envia.
