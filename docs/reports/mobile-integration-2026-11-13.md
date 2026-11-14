# Relatório da integração móvel — 13/11/2026

## Escopo

Integração validada com o frontend oficial
`andersonskywalkr/macromaniacs-app`, base
`71b5c94cf02af86e52911b36935b24af073f93e3`. A base deste repositório foi
`main` em `3887910aea3d3ea7bcabe1ebf519b395b8561ee0`.

Nenhuma branch principal foi mesclada e nenhum deploy foi executado.

## Alterações backend

- Snapshot diário passa a usar a meta canônica calculada do perfil quando não
  há plano alimentar ativo.
- `NutritionCalculatorService` foi exportado/importado explicitamente pelo
  módulo de progresso.
- O banco descartável do Compose e a documentação usam o mesmo nome
  administrativo, `validation`.
- O runner de integração é portável entre Windows e Unix.
- A jornada HTTP real cobre auth, onboarding, busca, refeição idempotente,
  ownership, progresso, gamificação, grupos/feed/reação/ranking e recompensas.

## Evidências

| Verificação | Resultado |
|---|---|
| `npm run format:check` | passou |
| `npm run lint` | passou |
| `npm run typecheck` | passou |
| `npm run build` | passou |
| `npm run docs:dbml` | 26 tabelas, 11 enums, 66 índices/PKs, 31 FKs e 60 CHECKs |
| `npm test -- --runInBand` | 23 suítes, 127 testes, todos passaram |
| `npm run test:integration` | 1 suíte, 10 testes em PostgreSQL 15 real, todos passaram |
| `npm audit --omit=dev` | 0 vulnerabilidades de produção |

O teste real repete a mesma criação após uma resposta considerada perdida e
confirma uma única refeição e uma única pontuação. Também prova 401, 400, 403,
404, 409, isolamento entre usuários, compra idempotente e inventário atômico.

O contrato consumido pelo aplicativo está em
`docs/api/mobile-integration.md`.
