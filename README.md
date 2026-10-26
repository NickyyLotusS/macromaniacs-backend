# MacroManiacs Backend

Backend do MacroManiacs organizado inicialmente como monolito modular.

Estrutura

- src/modules: modulos de negocio.
- src/shared: componentes compartilhados entre os modulos.
- src/jobs: processamentos assincronos.
- src/integrations: adaptadores para servicos externos.
- tests: testes unitarios, de integracao e ponta a ponta.
- docs: arquitetura, ADRs e contratos da API.
- infra: arquivos de suporte acordados com a equipe de infraestrutura.

Regras de dependência

- `src/modules` contém as regras e capacidades de negócio.
- `src/shared` contém somente componentes genéricos reutilizáveis.
- `src/integrations` encapsula serviços externos e seus SDKs.
- `src/jobs` inicia processamentos assíncronos usando serviços públicos.
- `src/app.module.ts` conecta as implementações concretas.

Módulos de negócio não devem importar SDKs externos nem acessar arquivos
internos de outros módulos. A comunicação deve acontecer por contratos,
serviços públicos ou eventos.

## Banco de dados

TypeORM é o único ORM ativo. A arquitetura inicialmente migrada com Prisma foi preservada: 23 tabelas PostgreSQL, 11 enums e todas as constraints/índices. Os arquivos Prisma ficam somente em `legacy/prisma`; não executar comandos Prisma.

Use Node compatível com o toolchain (22.22.3+ na linha 22, ou 24.15.0+ na linha 24), npm e Docker. Configure `.env` local usando `.env.example` sem sobrescrever credenciais/URLs existentes. O Compose canônico é `infra/docker/compose.yaml`: PostgreSQL 15, `macromaniacs_postgres`, host `localhost:5433`, banco `macromaniacs_db`, usuário `postgres` e volume externo preservado `macromaniacs-backend_pgdata`.

```bash
docker compose -f infra/docker/compose.yaml up -d
```

Crie `.env` a partir de `.env.example` e substitua o valor de `JWT_SECRET`
por um segredo local aleatório com pelo menos 32 caracteres.

Somente em um banco novo e vazio, execute a baseline:

```bash
npm run migration:run
```

Inicie a aplicação:

```bash
npm run start:dev
```

## API e Swagger

- Health: `GET http://localhost:3000/health`
- Swagger em desenvolvimento: `http://localhost:3000/docs`
- OpenAPI JSON em desenvolvimento: `http://localhost:3000/docs-json`
- Cadastro: `POST /v1/auth/register`
- Login: `POST /v1/auth/login`
- Sessão atual: `GET /v1/auth/me`
- Perfil nutricional atual: `GET /v1/users/me` (Bearer JWT)
- Atualização/onboarding: `PATCH /v1/users/me` (Bearer JWT)
- Cadastro manual de alimento: `POST /v1/foods/manual` (Bearer JWT)
- Planos alimentares: `POST/GET /v1/diet-plans` (Bearer JWT)
- Detalhe/edição/ativação: `/v1/diet-plans/{id}` (Bearer JWT)
- Refeições planejadas e itens: `/v1/diet-plans/{id}/meals` (Bearer JWT)

As convenções HTTP estão documentadas em
[`docs/api/conventions.md`](docs/api/conventions.md).

## Integração com React

O backend permite por padrão a origem do Vite em `http://localhost:5173`.
Para outro endereço, configure uma ou mais origens separadas por vírgula:

```env
CORS_ORIGINS=http://localhost:5173,https://app.example.com
```

No frontend, configure:

```env
VITE_API_URL=http://localhost:3000
```

Exemplos de payload, tipos e chamadas `fetch` estão em
[`docs/api/react-integration.md`](docs/api/react-integration.md).

## Perfil e cálculo nutricional

O servidor é a fonte de verdade para `onboardingCompleted` e para os valores
derivados. O cliente não envia esses campos. Ao atualizar peso, altura, data de
nascimento, sexo biológico, objetivo, atividade ou meta, a transação registra a
medida corporal e recalcula as métricas retornadas. A persistência de snapshots
diários permanece separada no backlog (BE-032).

- TMB: fórmula de Mifflin-St Jeor, em kcal/dia.
- TDEE: TMB multiplicada pelo fator de atividade (`1.2`, `1.375`, `1.55`,
  `1.725` ou `1.9`).
- Emagrecimento: déficit padrão de 10%, limitado a 500 kcal/dia.
- Ganho de massa: superávit padrão de 10%, limitado a 300 kcal/dia.
- Manutenção, recomposição, força e performance: meta igual ao TDEE neste MVP.
- Quando peso-meta e data-meta são coerentes com o objetivo, o ajuste considera
  `7.700 kcal/kg` dividido pelos dias disponíveis, respeitando os mesmos limites.
- A meta nunca fica abaixo da TMB nem acima de TDEE + 300 kcal/dia.

Os dados mínimos que completam o onboarding são nome, nascimento, sexo
biológico, objetivo, atividade e uma medida atual de altura e peso. Peso-meta e
data-meta são opcionais, mas devem ser enviados juntos.

## Testes

Testes unitários:

```bash
npm test -- --runInBand
```

Testes E2E de autenticação usam um PostgreSQL em memória isolado e criam apenas
o schema de teste necessário para os cenários:

```bash
npm run test:e2e
```

Para validar manualmente contra PostgreSQL real, existe também um serviço
efêmero separado na porta 55433:

```bash
docker compose -f infra/docker/compose.yaml --profile test up -d postgres-test
```

Ele usa `tmpfs` e não compartilha o volume do banco de desenvolvimento.

## Deploy

O backend aceita `APP_PORT` no desenvolvimento e a variável padrão `PORT`
fornecida por plataformas de hospedagem. `APP_PORT` tem precedência quando as
duas estiverem definidas.

Fluxo esperado no Railway:

```text
Build: npm ci && npm run build
Migration (etapa separada e aprovada): npm run migration:run:prod
Start: npm run start:prod
Health check: /health
```

Migrations nunca são executadas automaticamente na inicialização. Configure no
provedor `DATABASE_URL`, `APP_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN` e
`CORS_ORIGINS`. Segredos e URLs reais de banco nunca devem ser commitados.

## Operação do banco legado

```bash
npm ci
npm run db:local
# APENAS quando DATABASE_URL aponta para um banco vazio:
npm run migration:run
npm run seed
npm run start:dev
```

O script local usa as credenciais do `.env` sem imprimi-las, valida a configuração e espera healthcheck do PostgreSQL. Em instalação nova, o volume externo deve ser criado explicitamente; não recriar/apagar um volume que já existe. Não foi definido container da aplicação: o fluxo atual roda NestJS no host.

Banco Prisma já existente: **não executar a baseline como DDL**. Comece pelas verificações somente de leitura:

```bash
npm run db:verify
npm run db:drift
npm run db:baseline
```

O registro `--fake` exige backup externo restaurado e aprovação. `synchronize: true` e migrations automáticas em startup são proibidos. A integração do banco real não é concluída apenas pela instalação do ORM.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test -- --runInBand
git diff --check
```

Health: `/health` verifica liveness; `/health/ready` verifica PostgreSQL e retorna 503 quando indisponível. Em build, `npm run migration:run:prod`, `migration:show:prod`, `migration:revert:prod` e `seed:prod` usam JavaScript compilado.

Leia [arquitetura do banco](docs/architecture/database.md), [procedimento de transição/testes/backup](docs/architecture/orm-transition.md), [contrato de infraestrutura](docs/architecture/infrastructure-contract.md) e [ADR 0002](docs/adr/0002-typeorm-preserving-postgresql.md).

O [relatório de implementação](docs/architecture/typeorm-integration-report.md) registra arquivos, testes, backup, riscos e o registro fake autorizado da baseline no banco local real, sem alterações de domínio ou dados.
