# Histórico Prisma — somente referência

Origem: `origin/feat/database-architecture-setup`, commit `02b593d816fe4ec72cc238ae63bcc404e2bfaaa3`.

Schema, seed, quatro migrations, lock e testes SQL foram preservados sem alterar bytes. Não instalar Prisma nem executar seus comandos no runtime/deploy atual. O seed TypeScript permanece para auditoria, não é compilado nem importado. `tsconfig` e Jest excluem `legacy/`.

Os testes TypeORM aplicam somente o SQL histórico em PostgreSQL descartável; `tests/fixtures/catalogs-before-alignment.sql` reproduz os valores conhecidos do seed anterior à consolidação dos códigos. Os checksums são comparados com `_prisma_migrations` no preflight.

O ORM oficial e todas as migrations futuras são TypeORM. A transição não remove `_prisma_migrations`, tabelas ou dados existentes. Consulte [o procedimento de baseline](../../docs/architecture/orm-transition.md).

Limitação histórica preservada: o fallback de códigos `LEGACY_` da última migration concatena UUID sem aplicar `UPPER`. UUIDs com letras minúsculas em catálogos desconhecidos podem violar o CHECK de códigos maiúsculos. Não modificar migration já aplicada; se uma cópia antiga contiver esses dados, interromper o replay e definir correção auditada/autorizada antes de prosseguir. Os catálogos conhecidos e a base definitiva não precisam desse fallback.
