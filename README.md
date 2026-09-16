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
