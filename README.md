# Dashboard Pós Leve

Painel React, TypeScript e Vite com a identidade visual da Pós Leve. Ele usa a API e o MongoDB compartilhados entre locadoras; o slug da rota e a conta administrativa determinam a locadora autorizada.

## Funcionalidades atuais

- Visão geral com indicadores de poltronas e pedidos reais. A receita de vendas aparece sem valor até os pedidos registrarem total pago.
- Cadastro de filiais, com seleção de municípios do catálogo IBGE, frete de entrega obrigatório para cada município e estado ativo/inativo.
- Cadastro de entregadores com nome, e-mail, telefone, veículo opcional e senha inicial. A equipe pode bloquear o acesso ao app e redefinir a senha; sessões anteriores são encerradas nesses casos.
- Cadastro de poltronas vinculadas a uma filial, com estado operacional.
- Bloqueios manuais por poltrona e período para aluguel combinado com a equipe, manutenção ou transporte.
- Gestão de pedidos: lista, detalhes, andamento linear (pagamento confirmado → aguardando entrega → em uso → aguardando retirada → concluído), entregador atribuído, problemas e resolução. Um cadastro manual de demonstração permite preencher a tela sem reservar estoque; pode ser removido pelo painel.
- Contexto da IA: perguntas e respostas editáveis, dúvidas sem resposta agrupadas por ocorrência e resposta administrativa que passa a compor o contexto. Dúvidas podem ser registradas manualmente enquanto a integração com a API interna de IA é preparada.

O bloqueio é necessário para que o site não apresente uma poltrona já comprometida. Uma poltrona ativa só aparece como disponível se atender ao município e estiver livre durante todo o período consultado.

O site ainda não cria pedidos no backend. O cadastro manual serve apenas para visualizar e testar a tela, sem afetar a disponibilidade de poltronas. O app do entregador continua independente nesta etapa.

## Executar localmente

Use `../iniciar-local.sh` para iniciar os três projetos. O acesso local sem e-mail e senha funciona por um proxy Vite que usa a conta de desenvolvimento no processo do servidor. Fora desse modo, o painel exige e-mail e senha. O backend sempre autentica e verifica a associação `ADMIN` ao tenant.

Para executar o dashboard isoladamente, configure as variáveis de `.env.example` e rode `npm ci && npm run dev`. A API local usa `http://localhost:8080`; o dashboard usa `http://localhost:5174`.

## Verificação

`npm run build` compila o painel. As rotas administrativas estão sob `/api/admin/{slug}` e exigem autenticação.
