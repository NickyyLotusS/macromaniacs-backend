# ADR 0002 — TypeORM preservando a arquitetura PostgreSQL

## Status

Decisão implementada no código. Em 15/09/2026, a baseline foi registrada no banco local existente com `--fake`, após aprovação operacional, backup restaurado e paridade confirmada. Nenhum SQL estrutural da baseline foi executado. Outros ambientes exigem aprovação própria.

## Contexto

A arquitetura definitiva foi construída e migrada inicialmente com Prisma 5.22 na branch `feat/database-architecture-setup` (`02b593d`). `main` incorporou PostgreSQL/TypeORM em BE-003 (`3e32843`). Manter dois ORMs ativos criaria duas fontes de migrations sobre o mesmo schema.

## Decisão

TypeORM 1.1.1 é o único ORM ativo, aproveitando `DatabaseModule`, configuração NestJS e scripts existentes. A escolha alinha a persistência ao padrão já integrado em main, sem redesenhar o domínio. Preservar PostgreSQL 15, 23 tabelas, 11 enums, 55 índices, 29 FKs, 23 PKs e 50 CHECKs; não adicionar funcionalidades presentes apenas em documentos obsoletos.

Entidades do adaptador ficam em `src/integrations/database/entities`, por domínio. Usam tipos relacionais somente em imports de tipo e nomes de entidades como targets dos decorators, evitando ciclos de runtime. `shared` fornece contratos técnicos; controllers de negócio não importam SDKs/adaptadores concretos. A composição do adaptador PostgreSQL é responsabilidade de `AppModule`.

`synchronize: false`, `migrationsRun: false` e `installExtensions: false` são explícitos e não são configuráveis por environment. Não criar extensões, defaults UUID ou triggers novos durante a conexão. As queries raw não substituem regras transacionais de negócio.

Baseline TypeORM reproduz o schema final diretamente em banco vazio. Bancos definitivos Prisma recebem somente um registro `--fake`, após equivalência comprovada, backup externo restaurado e autorização. Migrations futuras são exclusivamente TypeORM. Prisma fica arquivado byte a byte em `legacy/prisma`, sem dependências/scripts ativos.

## Consequências

- O volume local identificado `macromaniacs-backend_pgdata` continua externo, em PostgreSQL 15/porta 5433; não é migrado para PostgreSQL 17 implicitamente.
- Decimais permanecem strings exatas; datas civis são strings ISO e instantes são `Date`.
- IDs sem defaults SQL exigem UUID fornecido pela aplicação; o listener funciona em entidades criadas/salvas, não em raw inserts/upserts arbitrários.
- Defaults `CURRENT_TIMESTAMP` exigem uma compatibilidade restrita no driver TypeORM 1.1.1; testes verificam zero drift, sem omitir diferenças de entidades/constraints.
- Índices DESC não representados pelo gerador são mantidos em SQL e marcados individualmente para não sincronização. Qualquer alteração nesses índices exige migration manual revisada e atualização do contrato.
- Revert da baseline é destrutivo e bloqueado fora de banco descartável autorizado. Rollback de aplicação não reverte schema automaticamente.
- O backend deve usar transações para peso atual, ledger/saldo, grupo/criador ADMIN, progresso e ownership de conteúdo.

Procedimento e evidências: [orm-transition.md](../architecture/orm-transition.md). Referências oficiais: [migrations TypeORM](https://typeorm.io/docs/migrations/) e [entidades TypeORM](https://typeorm.io/docs/entity/entities/).
