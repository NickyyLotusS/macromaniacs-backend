# Integração com o aplicativo Expo oficial

Contrato validado em 13/11/2026 contra o frontend
`andersonskywalkr/macromaniacs-app`, branch base `master`.

## Regras de transporte

- Base local: `http://localhost:3000`; rotas de negócio usam `/v1`.
- Endpoints protegidos exigem `Authorization: Bearer <JWT>`.
- `POST /v1/meals/manual`, `POST /v1/meals/check-in` e
  `POST /v1/rewards/purchases/:itemId` exigem `Idempotency-Key`.
- Erros seguem `{ statusCode, error, message, timestamp, path, correlationId }`.
- Listas paginadas seguem `{ items, meta }`.
- Swagger/OpenAPI só é publicado com `APP_ENV=development`, em `/docs` e
  `/docs-json`.

## Rotas consumidas pelo aplicativo

| Domínio | Rotas |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Perfil | `GET/PATCH /users/me` |
| Alimentos | `GET /foods`, `/foods/:id`, `/foods/barcode/:barcode`; `POST /foods/manual` |
| Refeições | `POST /meals/manual`; `GET /meals`, `/meals/:id`; `PATCH/DELETE /meals/:id` |
| Progresso | `GET /progress/daily`, `/progress/history` |
| Gamificação | `GET /gamification/summary`, `/achievements`, `/missions` |
| Recompensas | `GET /rewards/catalog`, `/balance`, `/inventory`; compra e equip |
| Social | lista/criação/entrada/saída de grupos, ranking, feed e reações em `/groups` |

Todas as rotas da tabela recebem automaticamente o prefixo `/v1` pelo
versionamento do NestJS.

## Decisões de compatibilidade

- O backend é fonte de verdade para `onboardingCompleted`, TMB, TDEE, meta
  calórica, totais das refeições, snapshots e pontos.
- Sem plano alimentar ativo, o snapshot diário usa a meta calculada do perfil.
  Para `NOT_INFORMED`, a meta pode continuar `null`; o frontend não usa fórmula
  alternativa.
- O frontend codifica `mealType` no campo `name` enquanto não existir campo
  próprio no contrato (`"Almoço - Nome opcional"`).
- O chat do aplicativo usa `feed_posts`: cada mensagem é um post textual. A
  tabela `chat_messages` não possui controller público e não faz parte do
  contrato atual.
- Administrador não pode sair do grupo sem transferir a função (409).
- Desafios de grupo e reset de senha não têm endpoints públicos; o cliente não
  chama rotas inventadas.

## Garantias de retry e concorrência

A chave idempotente é única por usuário. Repetir a criação de refeição com o
mesmo payload/chave devolve o mesmo recurso, sem nova linha, novo snapshot ou
novos pontos. Reutilizar a chave para outra operação conflita. Compras também
são serializadas por usuário e transacionais: saldo, ledger e inventário são
confirmados juntos.

O teste `tests/integration/database.spec.ts` comprova esses fluxos sobre
PostgreSQL 15 real e HTTP NestJS, incluindo uma repetição que representa uma
resposta perdida pelo cliente.

## Execução da prova real

```powershell
$env:POSTGRES_PASSWORD = 'apenas-para-interpolacao-do-compose'
docker compose -f infra/docker/compose.yaml --profile test up -d --wait postgres-test
$env:TEST_ADMIN_DATABASE_URL = 'postgresql://user:password@127.0.0.1:55433/validation'
npm run test:integration
docker compose -f infra/docker/compose.yaml --profile test down
```

O serviço usa `tmpfs` e não compartilha o volume de desenvolvimento.
