# Segurança

A API da Sympla devolve compra, e-mail, ingresso e presença. Isso é dado pessoal de quem comprou ou vai ao evento.

## O que este pacote faz

- O token é campo de senha e sai no header `s_token`.
- A URL base precisa ser HTTPS, sem usuário, senha, query ou fragmento.
- Erros passam por redação de e-mail e de segredo escrito depois de `s_token`, `token`, `authorization`, `bearer`, `signature` ou `password`.
- A busca de evento mostra nome e ID. A busca de apresentação mostra ID e data de início. A busca de pedido mostra nome, e-mail e data. A busca de participante mostra nome, e-mail e ingresso.
- Check-in é escrita e não é repetido.
- O trigger guarda, nos dados estáticos do workflow, a data da marca e os IDs já vistos. Não guarda o token.

## O que este pacote não faz

- Não anonimiza o item de sucesso.
- Não impede um AI Agent de chamar o check-in. A descrição da ferramenta pede confirmação humana.
- Não aplica limite de ritmo: o contrato público não publica um.
- Não verifica assinatura de webhook: o contrato público não publica webhook, e o trigger só faz polling.
- Não foi exercido com token real de produtor.
