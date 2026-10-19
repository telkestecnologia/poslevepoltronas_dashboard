# Dashboard Pós Leve

Painel React, TypeScript e Vite com a identidade visual da Pós Leve. Ele usa a API e o MongoDB compartilhados entre locadoras; o slug da rota e a conta administrativa determinam a locadora autorizada.

## Funcionalidades atuais

- Visão geral com gráficos de poltronas alugadas por filial e faturamento dos últimos 12 períodos, alternando entre semanas e meses. O faturamento fica sem dados até os pedidos registrarem total pago e data do pagamento.
- Financeiro com saldo acumulado, entradas e saídas por período, fluxo mensal, resultado por filial e extrato paginado. A tela lê `financial_entries` do backend e sinaliza quando os valores são apenas de demonstração; lançamentos reais têm prioridade automática sobre os fictícios.
- Cadastro de filiais, com seleção de municípios do catálogo IBGE, frete de entrega obrigatório para cada município e estado ativo/inativo.
- Cadastro de entregadores com nome, e-mail, telefone, veículo opcional e senha inicial. A equipe pode bloquear o acesso ao app e redefinir a senha; sessões anteriores são encerradas nesses casos.
- Cadastro de poltronas vinculadas a uma filial, com estado operacional.
- Bloqueios manuais por poltrona e período para aluguel combinado com a equipe, manutenção ou transporte.
- Gestão de pedidos: lista, detalhes, andamento linear (pagamento confirmado → aguardando entrega → em uso → aguardando retirada → concluído), entregador atribuído, problemas e resolução. Um cadastro manual de demonstração permite preencher a tela sem reservar estoque; pode ser removido pelo painel.
- Contexto da IA conectado à base de conhecimento do Meu Assistente pelo backend: perguntas e respostas editáveis e estado de indexação. A aba de dúvidas sem resposta usa a fila manual do dashboard no MongoDB: o administrador pode registrar, responder (publicando a resposta na base da IA) ou excluir uma dúvida. O chat atual do site ainda não envia perguntas automaticamente para essa fila.

O bloqueio é necessário para que o site não apresente uma poltrona já comprometida. Uma poltrona ativa só aparece como disponível se atender ao município e estiver livre durante todo o período consultado.

O site ainda não cria pedidos no backend. O cadastro manual serve apenas para visualizar e testar a tela, sem afetar a disponibilidade de poltronas. O app do entregador continua independente nesta etapa.

## Executar localmente

Use `../iniciar-local.sh` para iniciar os três projetos. O acesso local sem e-mail e senha funciona por um proxy Vite que usa a conta de desenvolvimento no processo do servidor. Fora desse modo, o painel exige e-mail e senha. O backend sempre autentica e verifica a associação `ADMIN` ao tenant.

Para executar o dashboard isoladamente, configure as variáveis de `.env.example` e rode `npm ci && npm run dev`. A API local usa `http://localhost:8080`; o dashboard usa `http://localhost:5174`.

## Verificação

`npm run build` compila o painel. As rotas administrativas estão sob `/api/admin/{slug}` e exigem autenticação.
