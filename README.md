# Dashboard Pós Leve

Painel React, TypeScript e Vite com a identidade visual da Pós Leve. Ele usa a API e o MongoDB compartilhados entre locadoras; o slug da rota e a conta administrativa determinam a locadora autorizada.

## Funcionalidades atuais

- Visão geral vazia, reservada para outra etapa.
- Cadastro de filiais, com seleção de municípios do catálogo IBGE, frete de entrega obrigatório para cada município e estado ativo/inativo.
- Cadastro de poltronas vinculadas a uma filial, com estado operacional.
- Bloqueios manuais por poltrona e período para aluguel combinado com a equipe, manutenção ou transporte.

O bloqueio é necessário para que o site não apresente uma poltrona já comprometida. Uma poltrona ativa só aparece como disponível se atender ao município e estiver livre durante todo o período consultado.

## Executar localmente

Use `../iniciar-local.sh` para iniciar os três projetos. O acesso local sem e-mail e senha funciona por um proxy Vite que usa a conta de desenvolvimento no processo do servidor. Fora desse modo, o painel exige e-mail e senha. O backend sempre autentica e verifica a associação `ADMIN` ao tenant.

Para executar o dashboard isoladamente, configure as variáveis de `.env.example` e rode `npm ci && npm run dev`. A API local usa `http://localhost:8080`; o dashboard usa `http://localhost:5174`.

## Verificação

`npm run build` compila o painel. As rotas administrativas estão sob `/api/admin/{slug}` e exigem autenticação.
