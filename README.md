# Dashboard Pós Leve

Painel React, TypeScript e Vite com a identidade visual da Pós Leve. Ele usa a API e o MongoDB compartilhados entre locadoras; o slug da rota e a conta administrativa determinam a locadora autorizada.

## Funcionalidades atuais

- Visão geral com gráficos de poltronas alugadas por filial e faturamento dos últimos 12 períodos, alternando entre semanas e meses. O faturamento fica sem dados até os pedidos registrarem total pago e data do pagamento.
- Financeiro com saldo acumulado, entradas e saídas por período, fluxo mensal, resultado por filial e extrato paginado. A tela lê `financial_entries` do backend e sinaliza quando os valores são apenas de demonstração; lançamentos reais têm prioridade automática sobre os fictícios.
- Cadastro de filiais, com seleção de municípios do catálogo IBGE, frete de entrega obrigatório para cada município e estado ativo/inativo.
- Cadastro de entregadores com nome, e-mail, telefone, veículo opcional e senha inicial. A equipe pode bloquear o acesso ao app e redefinir a senha; sessões anteriores são encerradas nesses casos.
- Cadastro de poltronas vinculadas a uma filial, com estado operacional.
- Bloqueios manuais por poltrona e período para aluguel combinado com a equipe, manutenção ou transporte.
- Gestão de pedidos: pedidos do site aparecem como pendentes de contrato e expiram sem pagamento, com liberação automática do estoque. O painel mostra as datas cobradas e os dias fisicamente bloqueados; o administrador pode confirmar entrega antecipada ou retirada posterior somente se os dias extras estiverem livres, sem alterar o valor. O andamento operacional (pagamento confirmado → aguardando entrega → em uso → aguardando retirada → concluído) continua indisponível para pedidos pendentes.
- Agenda de acompanhamento: calendário semanal e mensal de entregas e retiradas previstas nos pedidos reais com pagamento confirmado, filtros por filial, cidade cadastrada nessa filial e entregador, e serviços do dia agrupados por cidade. Mostra horários, endereço, cliente, status, serviços sem entregador e datas previstas que já passaram. A agenda usa as datas originais dos pedidos; ampliar o bloqueio de estoque não muda os compromissos exibidos.
- Contexto da IA conectado à base de conhecimento do Meu Assistente pelo backend: perguntas e respostas editáveis e estado de indexação. A aba de dúvidas sem resposta usa a fila manual do dashboard no MongoDB: o administrador pode registrar, responder (publicando a resposta na base da IA) ou excluir uma dúvida. O chat atual do site ainda não envia perguntas automaticamente para essa fila.

O bloqueio é necessário para que o site não apresente uma poltrona já comprometida. Uma poltrona ativa só aparece como disponível se atender ao município e estiver livre durante todo o período consultado.

O site cria pedidos pendentes a partir de reservas verificadas por WhatsApp. Eles não entram no faturamento nem representam aluguel confirmado. O app do entregador continua independente nesta etapa.

## Implantação

Configure `VITE_API_BASE_URL` com a URL HTTPS do backend e `VITE_TENANT_SLUG=pos-leve` durante o build. O painel exige e-mail e senha em todos os ambientes. O endereço de desenvolvimento é `https://posleve-dashboard-dev.web.app`, que deve ser usado em `APP_ADMIN_ALLOWED_ORIGINS` na API de homologação. Para publicar no alvo Firebase Hosting `dev`, veja `../poslevepoltronas_backend/docs/CLOUD_RUN_HTTPS.md`.

## Verificação

`npm run build` compila o painel. As rotas administrativas estão sob `/api/admin/{slug}` e exigem autenticação.
