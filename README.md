# Dashboard da Pós Leve

Painel inicial da equipe Pós Leve, feito com React, TypeScript e Vite, usando a paleta, as fontes e os ativos visuais do site público. Ele usa a **mesma API e o mesmo MongoDB** do site. A identidade visual deste repositório é específica da Pós Leve; o backend identifica a locadora pelo slug e autoriza a conta administrativa pela associação com o tenant.

## O que já funciona

- Ao iniciar os três projetos com `../iniciar-local.sh`, o login do dashboard mostra um botão de entrada local sem e-mail e senha. O proxy local do Vite usa a conta de desenvolvimento no servidor; a senha não é enviada ao navegador.
- Fora desse modo local, o login administrativo exige e-mail e senha. As credenciais ficam somente na memória da aba; ao recarregar, é necessário entrar novamente.
- Visão geral vazia, reservada para uma etapa futura.
- Cadastro de poltronas, edição de modelo/observações e mudança entre **ativa**, **em manutenção** e **inativa**.
- Cadastro de filiais com cidades atendidas e estado ativo/inativo; cada poltrona pertence a uma filial.
- Busca e filtro das poltronas no painel.

O menu mostra **Visão geral**, **Poltronas** e **Filiais**. As cidades são cadastradas dentro de cada filial. A visão geral continua vazia e a tela de reservas continua fora do painel. “Ativa” indica a condição operacional da poltrona; ainda não existe disponibilidade por data no backend.

## Executar localmente

Na raiz do workspace, `./iniciar-local.sh` inicia API, site e dashboard juntos. No dashboard local, basta clicar em **Entrar no painel**.

1. Inicie `poslevepoltronas_backend` pela raiz daquele repositório (`mvn spring-boot:run`). A API lê o MongoDB de desenvolvimento de seu `.env.local`.
2. Neste repositório, execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:5174`. A conta administrativa de desenvolvimento foi cadastrada no Atlas. O script usa o arquivo **local e ignorado pelo Git** `../poslevepoltronas_backend/.admin.local` no processo do Vite. Se iniciar o dashboard separadamente com `npm run dev`, o login normal continua disponível; consulte esse arquivo para obter e-mail e senha.

Por padrão, o dashboard usa `http://localhost:8080` e o slug público `pos-leve`. Para outros endereços de API ou uma implantação diferente, crie `.env.local` neste repositório com os valores de `.env.example`. Após alterar variáveis do Vite, reinicie o servidor de desenvolvimento. `VITE_TENANT_SLUG` é apenas um identificador público; a API confere a associação da conta ao tenant em cada operação.

## API usada

Todas as rotas abaixo têm prefixo `/api/admin/{slug}` e exigem autenticação:

| Método e rota | Uso |
| --- | --- |
| `GET /me` | Confirma a conta e a locadora autorizada. |
| `GET /chairs` | Lista poltronas da locadora. |
| `POST /chairs` | Cadastra poltrona. |
| `PATCH /chairs/{id}` | Atualiza modelo, observações, estado e filial. |
| `GET /branches` | Lista filiais da locadora. |
| `POST /branches` | Cria uma filial com cidades. |
| `PATCH /branches/{id}` | Atualiza cidades, nome e estado de uma filial. |

Para outro cliente, a equipe pode criar outro dashboard com sua marca e slug, apontando para a mesma API. A conta administrativa precisará de associação ao tenant desse cliente no backend.

## Verificação

```bash
npm run build
```

Os testes de integração da API cobrem autorização, acesso entre locadoras e escrita filtrada pelo tenant.
