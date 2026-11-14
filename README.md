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

TypeORM é o único ORM ativo. A baseline migrada do Prisma foi preservada e uma
migration aditiva eleva o contrato a 26 tabelas PostgreSQL, mantendo 11 enums e
todas as constraints/índices. Os arquivos Prisma ficam somente em
`legacy/prisma`; não executar comandos Prisma.

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
- Busca/detalhe/barcode: `GET /v1/foods`, `/v1/foods/{id}` e
  `/v1/foods/barcode/{barcode}`
- Planos alimentares: `POST/GET /v1/diet-plans` (Bearer JWT)
- Detalhe/edição/ativação: `/v1/diet-plans/{id}` (Bearer JWT)
- Refeições planejadas e itens: `/v1/diet-plans/{id}/meals` (Bearer JWT)
- Consumo manual/check-in e histórico: `/v1/meals` (Bearer JWT e
  `Idempotency-Key` nas criações)
- Progresso diário/histórico: `/v1/progress` (Bearer JWT)
- Streak, missões, conquistas e ledger: `/v1/gamification` (Bearer JWT)
- Grupos, feed, reações e ranking: `/v1/groups` (Bearer JWT)
- Catálogo, saldo, compras e inventário: `/v1/rewards` (Bearer JWT, exceto
  catálogo público)

As convenções HTTP estão documentadas em
[`docs/api/conventions.md`](docs/api/conventions.md).
O inventário completo de endpoints e exemplos está em
[`docs/api/backend-completion.md`](docs/api/backend-completion.md).

## Integração com Expo/React Native

O aplicativo oficial usa uma URL base sem `/v1` e JWT Bearer. Para clientes
web ou ferramentas de desenvolvimento, configure as origens CORS separadas por
vírgula:

```env
CORS_ORIGINS=http://localhost:5173,https://app.example.com
```

No frontend Expo, configure:

```env
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_USE_AUTH_MOCK=false
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

O contrato completo, incluindo idempotência, paginação, fila offline, grupos e
recompensas está em
[`docs/api/mobile-integration.md`](docs/api/mobile-integration.md).

A avaliação reproduzível de consultas e o smoke de staging estão em
[`docs/performance.md`](docs/performance.md).

## Perfil e cálculo nutricional

O servidor é a fonte de verdade para `onboardingCompleted` e para os valores
derivados. Um perfil inicial auditável é criado no cadastro e
`onboardingCompletedAt` só é preenchido após todos os campos mínimos. O cliente
não envia esses campos. Ao atualizar peso, altura, data de
nascimento, sexo biológico, objetivo, atividade ou meta, a transação registra a
medida corporal e recalcula as métricas retornadas. A persistência de snapshots
diários usa `daily_nutrition_snapshots`, separado do estado de gamificação.

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

A GitHub Action executa qualidade, cobertura e uma suíte adicional contra
PostgreSQL 15 real. Localmente, essa suíte exige um servidor descartável cujo
banco administrativo se chame `validation`:

```bash
TEST_ADMIN_DATABASE_URL=postgresql://user:password@127.0.0.1:55433/validation npm run test:integration
```

Para validar manualmente contra PostgreSQL real, existe também um serviço
efêmero separado na porta 55433:

```bash
docker compose -f infra/docker/compose.yaml --profile test up -d postgres-test
```

Ele usa `tmpfs` e não compartilha o volume do banco de desenvolvimento.
No PowerShell, defina `TEST_ADMIN_DATABASE_URL` com `$env:` antes do comando.

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

O rate limit é configurável por ambiente e usa um orçamento mais estrito para
`POST /v1/auth/login`. `TRUST_PROXY` deve permanecer `false` salvo quando a
aplicação estiver atrás de proxy reverso confiável. Em múltiplas réplicas,
substitua o contador em memória por armazenamento distribuído antes de usar o
limite como controle global.

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
