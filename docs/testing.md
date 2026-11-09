# Estratégia de testes

- Unitários: cálculos, normalização, adapters simulados, guards, paginação,
  configuração e rate limit.
- E2E isolados com `pg-mem`: identidade, alimentos, planos, refeições,
  progresso, gamificação, social e recompensas.
- PostgreSQL 15 real na CI: migrations desde vazio e legado, schema/DBML,
  constraints, trigger imutável, precisão, locks, compra concorrente e planos
  dos hot paths sobre massa sintética.
- Integrações externas nunca são chamadas na suíte determinística; fixtures
  exercitam os contratos Open Food Facts e USDA.

Comandos de aceitação:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run docs:dbml
npm test -- --runInBand --coverage
npm audit --omit=dev --audit-level=high
npm run test:integration # requer PostgreSQL 15 descartável
```

O procedimento e o smoke HTTP opt-in estão em [`performance.md`](performance.md).

Falha de conexão com PostgreSQL real não é substituída por mock nem registrada
como aprovação. O job `postgres-15` é a evidência reproduzível desse nível.
