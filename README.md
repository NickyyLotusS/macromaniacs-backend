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

# Banco de dados local

Suba o PostgreSQL com Docker:

```bash
docker compose -f infra/docker/compose.yaml up -d
```

Crie `.env` a partir de `.env.example` e substitua o valor de `JWT_SECRET`
por um segredo local aleatório com pelo menos 32 caracteres.

Execute as migrations:

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
medida corporal, recalcula e persiste o snapshot nutricional do dia.

- TMB: fórmula de Mifflin-St Jeor, em kcal/dia.
- TDEE: TMB multiplicada pelo fator de atividade (`1.2`, `1.375`, `1.55`,
  `1.725` ou `1.9`).
- Emagrecimento: déficit padrão de 10%, limitado a 500 kcal/dia.
- Ganho de massa: superávit padrão de 10%, limitado a 300 kcal/dia.
- Manutenção, força e performance: meta igual ao TDEE neste MVP.
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

Testes E2E de autenticação usam um PostgreSQL em memória isolado e executam a
migration antes dos cenários:

```bash
npm run test:e2e
```

Para validar manualmente contra PostgreSQL real, existe também um serviço
efêmero separado na porta 5433:

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
Start: npm run start:deploy
Health check: /health
```

`start:deploy` executa as migrations JavaScript compiladas em
`dist/integrations/database/migrations` antes de iniciar a API. Configure no
provedor `DATABASE_URL`, `APP_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN` e
`CORS_ORIGINS`. Segredos e URLs reais de banco nunca devem ser commitados.
