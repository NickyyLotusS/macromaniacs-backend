# Relatório de implementação Prisma → TypeORM

Data: 15/09/2026. **Baseline TypeORM registrada no banco local real com `--fake`, após autorização explícita e preflight aprovado. Nenhum SQL estrutural da baseline foi executado; objetos, dados e histórico Prisma foram preservados.** As validações e o registro precederam o versionamento, posteriormente autorizado pelo usuário para a branch de integração e a `origin/main`.

## Branch e segurança

- Branch criada: `feat/database-typeorm-integration`, baseada em `origin/main`, commit `3e32843815698fd3e8b9bbfcb3b0e4309dee17f3` (integração BE-003 TypeORM).
- Referência PostgreSQL definitiva: `origin/feat/database-architecture-setup`, commit `02b593d816fe4ec72cc238ae63bcc404e2bfaaa3`.
- Executados status, branch, log, remotes, busca de AGENTS aplicáveis e `git fetch --all --prune` antes da implementação. O estado inicial estava limpo, sem operação Git pendente; não havia AGENTS aplicável.
- As duas branches foram auditadas via arquivos e `git show`, sem merge cego. `main` e a branch original do banco não foram alteradas.
- A nova branch ficou sem upstream para evitar envio acidental à `origin/main`. Nenhum reset, clean, rebase, force push ou exclusão de migrations/volumes reais.

## Entidades e contrato físico preservado

TypeORM é o único ORM ativo. Não há pacote Prisma/Prisma Client em dependências, imports ou scripts ativos. `synchronize: false`, `migrationsRun: false` e `installExtensions: false` valem para NestJS e CLI.

| Domínio | Entidades → tabelas PostgreSQL |
| --- | --- |
| Identidade/perfil | `User` → `users`; `UserProfile` → `user_profiles`; `BodyMeasurement` → `body_measurements` |
| Nutrição | `Food` → `foods`; `DietPlan` → `diet_plans`; `PlannedMeal` → `planned_meals`; `PlannedMealItem` → `planned_meal_items` |
| Refeições/histórico | `MealLog` → `meal_logs`; `MealLogItem` → `meal_log_items` |
| Social/grupos | `Group` → `groups`; `GroupMember` → `group_members`; `GroupChallenge` → `group_challenges`; `FeedPost` → `feed_posts`; `PostReaction` → `post_reactions`; `ChatMessage` → `chat_messages` |
| Gamificação | `UserStats` → `user_stats`; `PointTransaction` → `point_transactions`; `UserAchievement` → `user_achievements`; `UserDailyMission` → `user_daily_missions`; `UserCosmetic` → `user_cosmetics` |
| Catálogos | `Achievement` → `achievements`; `DailyMission` → `daily_missions`; `CosmeticItem` → `cosmetic_items` |

As 23 entidades são registradas explicitamente. Foram mantidos nomes físicos de tabelas, colunas, enums, PKs, FKs, índices e CHECKs; precisão/escala, nulabilidade, defaults, chaves compostas, JSONB, datas, timestamps e ações FK `ON DELETE`/`ON UPDATE`. Não foram implementados módulos de negócio da documentação obsoleta, eager loading indiscriminado ou segundo pool de conexão.

`UserProfile` permanece opcional em `User`. Quando existe, nascimento, sexo biológico, altura, peso atual, objetivo e nível de atividade são obrigatórios. Decimal é `string`, DATE é string ISO e TIMESTAMPTZ é `Date`. UUIDs são gerados na aplicação, sem introduzir default SQL. O seed fornece UUID explicitamente, preservando IDs existentes. `@UpdateDateColumn` atualiza operações ORM; não foi inventado trigger no PostgreSQL.

## Baseline, histórico Prisma e seed

Baseline: `DefinitiveBaseline1789430400000`, com SQL final em `src/integrations/database/migrations/sql/definitive-baseline.sql`. O SQL foi obtido de banco descartável que recebeu as quatro migrations históricas completas. O `up` cria diretamente o estado definitivo em banco vazio e rejeita tabelas preexistentes; não reaplica backfills legados. O `down` é destrutivo, exige `ALLOW_DESTRUCTIVE_BASELINE_REVERT=true` e nome `macromaniacs_test_*`; nunca é automático.

Para banco Prisma existente, o comando dedicado `db:baseline` consulta schema e histórico, exige paridade integral, quatro migrations terminadas/não revertidas, checksums corretos e ausência de migrations TypeORM desconhecidas. Sem flags, é somente leitura e não cria a tabela `migrations`. O modo `--fake` exige confirmação explícita e backup do mesmo banco, com SHA-256 e restauração verificados, de até 24 horas. O DataSource desse comando contém somente a baseline: não registra migrations futuras ou desconhecidas.

Histórico preservado em `legacy/prisma`, excluído do build, typecheck e Jest ativos. Nove arquivos originais foram comparados byte a byte com a branch de origem, inclusive o arquivo de migration sem newline final. As quatro migrations são:

```text
20260828205140_init_schema_and_tables
20260828205714_init_schema_and_tables
20260904_align_onboarding_profile
20260904_z_definitive_database_alignment
```

O seed TypeORM é transacional e serializado por advisory lock, usa códigos naturais e atualiza catálogos conhecidos sem duplicar ou trocar IDs. Dois runs mantiveram **4 achievements, 3 daily missions e 3 cosmetic items**. Nenhum seed foi executado no banco real nesta transição.

## Docker e banco real

Configuração canônica: `infra/docker/compose.yaml`, projeto `macromaniacs-backend`, imagem PostgreSQL `15-alpine`, container `macromaniacs_postgres`, usuário `postgres`, banco `macromaniacs_db`, host `localhost:5433` → container `5432`, volume externo `macromaniacs-backend_pgdata` e healthcheck `pg_isready`. Credenciais reais permanecem somente em `.env` ignorado. A configuração revisada limita o bind local a loopback; o container real preexistente não foi recriado/aplicado nesta tarefa.

Foi resolvido no código o conflito entre PostgreSQL 17/porta 5432/volume da BE-003 e PostgreSQL 15/porta 5433/volume realmente utilizado. Não houve upgrade físico, troca de volume ou remoção do outro volume encontrado, `macromaniacs-database-setup_pgdata`. Apenas a configuração canônica foi mantida na branch; os outros Composes históricos não foram importados como configurações ativas.

O Docker Desktop estava indisponível, foi iniciado com aprovação e ficou acessível após confirmação do usuário. Banco real identificado: PostgreSQL 15.19, container e volume acima. Consultas read-only confirmaram quatro migrations Prisma bem-sucedidas e checksums íntegros. Inicialmente a tabela TypeORM `migrations` estava ausente; após autorização, a listagem criou somente o controle vazio e o comando fake inseriu exclusivamente a baseline. Nenhum DDL de domínio, seed ou teste SQL mutante foi executado nesse banco. O registro e a comparação antes/depois estão detalhados abaixo.

## Backup externo validado

- Arquivo no host: `/Users/macbookair/macromaniacs-backend/backups/macromaniacs_pre_typeorm_20260915.dump`.
- Tamanho: **63.168 bytes**, formato PostgreSQL custom, permissão **0600**.
- SHA-256: `28622d453c5ac12b34205bd7ff5543c1ad9e14b1a1ebbea102bef7a9ee5ef8ac`.
- Snapshot consistente, transação read-only/exportada; nenhuma alteração no banco real durante a coleta.
- Cabeçalho, bytes, hash e listagem `pg_restore --list` conferidos. Dump e manifesto `.dump.json` ignorados pelo Git, fora do container e sem sobrescrita de backups anteriores.
- Criado em `2026-09-15T18:29:53.062Z`; restauração verificada em `2026-09-15T18:31:40.536Z`.
- Restaurado somente em `macromaniacs_test_backup_restore_20260915`, no PostgreSQL isolado. Schema, contagens/hashes de todas as 23 tabelas e histórico/checksums Prisma idênticos ao snapshot. Manifesto com `restoreVerified: true`.
- O snapshot tinha dez registros de catálogo (4/3/3), sem usuários ou demais dados de domínio. Fixtures com dados legados exercitaram preservação de usuários, grupos, conteúdo e ledger nos testes separados.

Restauração, somente em banco descartável vazio e autorizado:

```bash
docker exec -i macromaniacs_typeorm_validation pg_restore \
  -U postgres -d macromaniacs_test_backup_restore_NOVO \
  --no-owner --no-privileges --exit-on-error \
  < backups/macromaniacs_pre_typeorm_20260915.dump
```

Não executar esse comando sobre banco real, nem usar `--clean`. O banco descartável deve ser criado previamente, com autorização. O procedimento completo está em `orm-transition.md`. Backup no host protege contra perda do container, mas produção ainda precisa de armazenamento separado seguro, criptografia e retenção definidos pela infraestrutura.

## Verificações executadas e resultados

| Verificação/comandos | Resultado |
| --- | --- |
| `npm ci` com lockfile atualizado | Instalação limpa concluída; Node engine warnings documentados |
| `npm run format`, `format:check`, `lint`, `typecheck`, `build` | Aprovados |
| `npm test -- --runInBand` | 3 suítes, 10 testes aprovados, incluindo 2 E2E HTTP |
| `npm run test:e2e` | 2 testes aprovados, liveness/readiness e resposta 503 |
| `TEST_ADMIN_DATABASE_URL=... npm run test:integration` | 7 testes aprovados; cenários A e B e NestJS conectado ao PostgreSQL isolado |
| `DATABASE_URL=URL_DESCARTAVEL npm run test:sql` | SQL integral aprovado com ROLLBACK; rodado também nos dois cenários pela integração |
| `npm run db:verify`, `db:drift` no banco real | Paridade integral; zero SQL pendente; somente leitura |
| Comparação direta Prisma × baseline e contra `schema-contract.json` | Aprovada; fingerprints de dados inalterados no `--fake` legado |
| `npm run docs:dbml` | 23 tabelas, 11 enums, 55 índices/PKs, 29 FKs e 50 CHECKs iguais ao contrato |
| `npm run db:local -- --check` | Compose canônico validado sem iniciar/recriar o banco real |
| `npm run db:baseline` | Preflight aprovado antes e depois; baseline real agora registrada; o modo sem flags permanece somente leitura |
| `npm run migration:show` antes/depois no banco real | Antes: somente a baseline pendente; depois: somente `[X] 1 DefinitiveBaseline1789430400000`, nenhuma pendência |
| `db:baseline -- --fake --backup ... --confirm-existing-database` no banco real | Um INSERT de controle autorizado; nenhum up/DDL da baseline |
| Integridade read-only e NestJS contra banco real pós-fake | 50 CHECKs e 29 FKs sem violações/órfãos; conexão única e health/readiness HTTP 200 |
| `db:backup`, restore isolado e `db:backup:verify` | Backup externo e restauração verificados |
| `migration:create` | CLI gera migration vazia em diretório temporário externo ao repositório |
| `migration:generate` protegido no banco descartável equivalente | Zero mudanças; exit 1 esperado da CLI, nenhum arquivo de migration gerado |
| `migration:run:prod`, `seed:prod` duas vezes, `migration:show:prod`, `migration:show` | SQL/JSON de dist disponíveis; execução JS e TS aprovada no banco sintético |
| Down compilado manual, explicitamente autorizado, seguido de up/seed | Confirmados zero tabelas/enums/registro de migration após down; baseline e seed 4/3/3 recriados com paridade integral |
| `git diff --check` e `git diff --cached --check` | Sem erros; arquivos novos também inspecionados sem stage |
| Busca de segredos e artefatos no conjunto versionável | Nenhum secret conhecido, dump, `.env`, log, cache ou build indevido encontrado; placeholders/fixtures não são credenciais reais |
| `npm audit --omit=dev` | Zero vulnerabilidades de produção |
| `npm audit` completo | 5 vulnerabilidades de desenvolvimento: 2 baixas, 1 moderada, 2 altas; exit 1 esperado/documentado |

Os testes SQL cobrem duplicatas/canonicalização de e-mail e username, enums inválidos, perfil incompleto, pesos/alturas/nutrientes/quantidades inválidos, datas incoerentes, posts/mensagens vazios, convites, cascatas, SET NULL, RESTRICT, chaves N:N, proprietário ADMIN transacional, ledger/saldo e snapshots nutricionais. A integração testa ainda UUID na aplicação, DATE/string, TIMESTAMPTZ/Date, decimal/string, JSONB, perfil opcional, atualização ORM de timestamp, checksums/histórico falho, controle TypeORM desconhecido, CHECK físico não mapeado e expressão de CHECK alterada.

O teste de drift altera temporariamente a metadata de tamanho do e-mail e confirma SQL não vazio; restaurada a metadata, volta a zero. Assim, o ajuste restrito do driver não mascara diferenças reais. A alteração é somente nos objetos em memória, não no schema físico.

Os containers/bancos descartáveis e diretórios temporários foram preservados para inspeção. Não houve cleanup destrutivo automático. O revert manual atingiu somente `macromaniacs_test_compiled_20260915`, após verificar que continha exclusivamente os dez registros sintéticos; a cópia do backup real e todos os volumes reais foram preservados.

## Paridade estrutural e divergências corrigidas

Resultado Prisma definitivo × baseline TypeORM × banco real × DBML: **23 tabelas, 11 enums, 55 índices (incluindo 23 índices de PK), 102 constraints = 23 PKs + 29 FKs + 50 CHECKs**. Sem divergência estrutural pendente. São comparados também colunas/defaults/nulabilidade/precisão, ordem de enum, ações FK, índices DESC e recursos de schema adicionais.

A comparação exclui somente as tabelas de controle Prisma/TypeORM e suas próprias dependências. OIDs, lacunas internas de `attnum` e valores numéricos internos de ordenação de enum não são identidades físicas replicáveis; nomes, ordem lógica dos rótulos/colunas e definições efetivas são comparados sem esconder diferenças.

Divergências encontradas e tratadas:

1. BE-003 estava com configuração Docker diferente do banco real: alinhamento ao PostgreSQL 15/5433 e ao volume externo existente, preservando os dados.
2. A ordem declarativa de `UserGoal` diferia da ordem física produzida pelos ALTER TYPE históricos: preservada a ordem aplicada, inclusive `RECOMPOSITION` antes de `STRENGTH_GAIN`/`PERFORMANCE`.
3. TypeORM 1.1.1 tentava normalizar `CURRENT_TIMESTAMP` para `now()` e comparar caixa inconsistentemente, gerando rewrites e potencial remoção de índices: driver ajustado de forma estrita, sem alterar defaults reais. JSONB e expressões/nome de CHECK foram alinhados aos metadados físicos. Índices DESC ficam em SQL e individualmente `synchronize: false`.
4. Geração de SQL poderia eliminar CHECK não mapeado ou ignorar expressão modificada: wrapper exige banco descartável e bloqueia essas divergências, indicando SQL manual revisado.
5. Parser DBML antigo não suportava CHECKs: validação usa `dbmlv2` e contrato físico completo, incluindo nomes/ações FK, índices e checks.
6. Dependências NestJS 12 usam ESM: Jest mantido com VM modules; caminhos de resources funcionam no Jest e no build JS. Falhas iniciais de ESM/tipagem/permissão de socket foram corrigidas e as suítes rerrodadas com sucesso.
7. Artefato `tsconfig.build.tsbuildinfo` estava versionado na main: removido somente do índice, preservado localmente, com regra `*.tsbuildinfo` no ignore. Dumps/backups/caches/temporários também protegidos.
8. Audit encontrou vulnerabilidades de produção: atualizações compatíveis no lockfile corrigiram os alertas de produção, sem `--force`. Os alertas dev incompatíveis não foram ocultados.

## Registro fake autorizado no banco real — 15/09/2026

O usuário autorizou exclusivamente a baseline `DefinitiveBaseline1789430400000` com `--fake`, sem executar seu SQL de criação. Backup externo reconferido: 63.168 bytes, header PGDMP, SHA-256 íntegro, manifesto de restore validado e menos de 24 horas. Schema, dados de todas as 23 tabelas e histórico/checksums continuavam iguais ao backup e à última validação.

Auditoria inicial: `2026-09-15T18:58:50.048Z`. Apenas essa baseline constava na configuração e na lista de pendências TypeORM; nenhuma migration desconhecida. A listagem obrigatória `npm run migration:show` mostrou:

```text
[ ] DefinitiveBaseline1789430400000
```

**A listagem TypeORM cria a tabela de controle quando ausente.** Após essa listagem, `public.migrations` já existia, vazia, e todos os fingerprints de domínio/histórico permaneciam iguais. Essa criação de metadados é a única adição estrutural; não corresponde à execução da baseline.

Preflight imediato, com aborto automático se qualquer fingerprint diferisse: `2026-09-15T19:04:04.519Z`. Registro concluído: `2026-09-15T19:04:10.858Z` (16:04:10, America/Sao_Paulo). Comando executado:

```bash
NODE_OPTIONS="--require=/private/tmp/macromaniacs-baseline-guard.ZINlwk/guard.cjs" \
  npm run db:baseline -- --fake \
  --backup backups/macromaniacs_pre_typeorm_20260915.dump \
  --confirm-existing-database
```

O PATH foi ajustado apenas para encontrar os binários locais. A guarda temporária, fora do repositório, foi testada em simulação sem banco: bloqueia DDL, INSERT de migration desconhecida e qualquer chamada de `up`. Durante a operação real interceptou todas as 22 chamadas do QueryRunner: `upCalls: 0`, `blockedStatements: 0` e **exatamente uma escrita**, concluída com sucesso:

```sql
INSERT INTO "public"."migrations"("timestamp", "name") VALUES ($1, $2)
-- Parâmetros: [1789430400000, 'DefinitiveBaseline1789430400000']
```

Registro exclusivo confirmado em `public.migrations`:

| id | timestamp | name |
| --- | --- | --- |
| 1 | 1789430400000 | DefinitiveBaseline1789430400000 |

Status pós-operação:

```text
[X] 1 DefinitiveBaseline1789430400000
```

O executor confirmou `pending: []`. Não foi executada nenhuma outra migration. A coluna `timestamp` acima identifica a versão da migration, não a hora de aplicação.

Comparação pós-operação: `2026-09-15T19:05:40.655Z`:

| Item de domínio | Antes | Depois |
| --- | --- | --- |
| Tabelas | 23 | 23 |
| Enums | 11 | 11 |
| Constraints | 102 | 102 |
| PKs | 23 | 23 |
| CHECKs | 50 | 50 |
| FKs | 29 | 29 |
| Índices, incluindo PKs | 55 | 55 |
| Achievements / missões / cosméticos | 4 / 3 / 3 | 4 / 3 / 3 |
| Registros de domínio, sem controles | 10 | 10 |
| Registros de histórico Prisma | 4 | 4 |

No schema público completo, as tabelas passaram de 24 para 25: 23 de domínio + `_prisma_migrations` + novo controle `migrations`. O estado completo pós-operação tem 104 constraints e 57 índices, incluindo as duas PKs/índices de controle, e uma sequence pertencente ao controle TypeORM. Essas dependências novas são exclusivamente metadados, não alterações de domínio.

Os cinco hashes abaixo permaneceram **idênticos** antes da listagem, imediatamente antes do fake e depois:

```text
Schema:             f6a1b130f594a3fcb331cb20d2cfbd9b50a625059e063ea062c6e6f30b4a336f
Dados de domínio:   12ca25d06b8f29d8684b39a5873039b67ed08194029ecdd86b87ad148380fb12
Histórico Prisma:   edc9f906cf973b95d8346decf930b7771c83ff3affdbe857303e616c67a5b2a4
Identidade objetos: e6de2567d5809d7bd67919c7285cdcd61b3ce6fae6fc3cb90e8ad89fa7e12651
Identidade linhas:  99f130d217db219631d694f74db04b58a05595368d0ff6b57b90543ca9fd0d5a
```

Identidade de objetos inclui OIDs/relfilenodes de tabelas/índices, OIDs dos enums/rótulos e constraints. Identidade das linhas inclui conteúdo, tableoid, ctid e xmin. Assim, a prova não depende apenas de contagens: não houve recriação de objetos de domínio, troca de IDs, alteração/exclusão/reinserção de registros. `_prisma_migrations` e os nove arquivos históricos originais permanecem preservados; checksums e registros de sucesso não mudaram.

Testes após o registro:

- `db:baseline` read-only: aprovada, baseline já registrada.
- `db:verify` e `db:drift`: paridade integral, zero SQL pendente.
- SELECTs read-only no banco real avaliaram todos os 50 CHECKs e procuraram órfãos nas 29 FKs: zero violações/órfãos e zero constraints não validadas.
- NestJS compilado conectou ao banco real com 23 entidades, mesma conexão compartilhada pelo health adapter, `synchronize: false` e `migrationsRun: false`; `/health` e `/health/ready` retornaram HTTP 200, com SELECT 1. A aplicação de teste foi encerrada sem mudanças no banco.
- SQL de integridade completo aprovado somente em `macromaniacs_test_compiled_20260915`, com ROLLBACK. Nenhum insert de fixture foi feito no banco real.
- Jest rerrodado: três suítes e dez testes aprovados, incluindo dois E2E.
- Nenhum commit, push, restart/recriação de container, cleanup ou execução de migrations adicionais.

Evidência local com snapshots, hashes, registro e auditoria SQL: `backups/typeorm-baseline-registration-20260915.json`, permissão 0600 e ignorada pelo Git, sem valores pessoais/credenciais. Backup original e manifesto permanecem intactos. O arquivo de guarda temporário foi preservado para auditoria; não é parte do runtime nem requisito das migrations futuras.

Alertas observados: deprecation do pg 8 durante introspecção interna do TypeORM e VM Modules experimental do Jest, sem falhas nos testes. Os riscos anteriores de Node/toolchain e ferramentas dev continuam listados abaixo.

## Riscos e decisões ainda necessários

- **Registro da baseline no banco local real autorizado e concluído.** Outros ambientes/deploys exigem seu próprio preflight, backup validado e autorização; não foram alterados.
- Node 22.20.0 local está abaixo do mínimo 22.22.3 exigido por dependências do CLI; testes passaram, mas usar versão suportada no CI/deploy.
- `@nestjs/mau` e cadeia dev (`inquirer`, `external-editor`, `tmp`, `undici`) mantêm cinco alertas. A correção automática sugerida pelo npm exige mudança incompatível para mau 0.0.6. Decidir separadamente revisão/substituição da ferramenta de deploy; nenhum downgrade ou force automático.
- O `pg` 8 avisa sobre consultas concorrentes feitas internamente pelo TypeORM durante inspeção de schema. Stack rastreado até `PostgresQueryRunner.getUserDefinedTypeName`/`Promise.all`; o coletor de paridade próprio é sequencial. Ensaiar ORM/driver antes de atualizar para pg 9; não suprimir avisos nem editar node_modules.
- Migration Prisma histórica tem fallback de código de catálogo desconhecido com UUID em lowercase, incompatível com o CHECK uppercase posterior. Os dez registros conhecidos e o banco aplicado passaram. O histórico aplicado não foi alterado; replay de catálogo adicional afetado exige correção explicitamente revisada/autorizada, não fake para mascarar falha.
- Produção requer política externa de backup/retention/criptografia, TLS e privilégios de deploy. Não introduzidos segredos nem serviços externos fora do escopo.
- O Compose revisado ainda não foi aplicado ao container real: qualquer recriação/restart deve ser planejada e autorizada separadamente. O volume identificado não deve mudar.
- Cleanup dos bancos/container de validação exige autorização explícita; o container usa tmpfs e não é armazenamento durável de backup.

## Considerações para o backend

- Finalizar onboarding em transação, criando perfil completo; User sem perfil continua válido.
- Gerar UUID para inserts/upserts que não passam pelo hook de entidade. Preservar precisão decimal e não converter silenciosamente strings numéricas em `number`.
- Medição e peso atual devem ser atualizados atomicamente; medição retroativa não deve sobrescrever peso mais recente.
- Ledger append-only e saldo agregado na mesma transação, com concorrência controlada e sem saldo negativo. Não há trigger de agregação automática.
- Criar grupo e membership ADMIN do proprietário juntos. Transferir propriedade antes de excluir criador, respeitando RESTRICT.
- Validar membership/autoria e dono da refeição/log; progresso de missão não pode exceder meta.
- Snapshots nutricionais são históricos, não recalculados pelo catálogo. Exclusão de log em post sem texto pode falhar no CHECK após SET NULL: tratar conteúdo/post explicitamente na mesma transação.
- `/health` permanece liveness; `/health/ready` consulta PostgreSQL e responde 503 na indisponibilidade. DatabaseModule mantém conexão única e retries limitados, sem expor credenciais.
- Novas migrations TypeORM são explicitamente registradas; startup não aplica schema. Revisar SQL e ensaiar banco vazio/legado, paridade, CHECKs e índices antes do deploy.

## Arquivos adicionados

Os caminhos abaixo são relativos ao repositório. `legacy/prisma` é cópia histórica, não código ativo.

Documentação (5):

```text
docs/adr/0002-typeorm-preserving-postgresql.md
docs/architecture/database.md
docs/architecture/diagrama.dbml
docs/architecture/orm-transition.md
docs/architecture/typeorm-integration-report.md
```

Legado (10):

```text
legacy/prisma/README.md
legacy/prisma/schema.prisma
legacy/prisma/seed.ts
legacy/prisma/integrity-test.sql
legacy/prisma/legacy-migration-fixture.sql
legacy/prisma/migrations/migration_lock.toml
legacy/prisma/migrations/20260828205140_init_schema_and_tables/migration.sql
legacy/prisma/migrations/20260828205714_init_schema_and_tables/migration.sql
legacy/prisma/migrations/20260904_align_onboarding_profile/migration.sql
legacy/prisma/migrations/20260904_z_definitive_database_alignment/migration.sql
```

Scripts (10):

```text
scripts/backup.ts
scripts/baseline-preflight.ts
scripts/generate-migration.ts
scripts/local-db.ts
scripts/register-baseline.ts
scripts/run-sql.ts
scripts/schema-drift.ts
scripts/verify-dbml.ts
scripts/verify-restored-backup.ts
scripts/verify-schema.ts
```

Entidades e registro (25):

```text
src/integrations/database/entities/enums.ts
src/integrations/database/entities/index.ts
src/integrations/database/entities/identity/user.entity.ts
src/integrations/database/entities/identity/user-profile.entity.ts
src/integrations/database/entities/identity/body-measurement.entity.ts
src/integrations/database/entities/nutrition/food.entity.ts
src/integrations/database/entities/nutrition/diet-plan.entity.ts
src/integrations/database/entities/nutrition/planned-meal.entity.ts
src/integrations/database/entities/nutrition/planned-meal-item.entity.ts
src/integrations/database/entities/meals/meal-log.entity.ts
src/integrations/database/entities/meals/meal-log-item.entity.ts
src/integrations/database/entities/social/group.entity.ts
src/integrations/database/entities/social/group-member.entity.ts
src/integrations/database/entities/social/group-challenge.entity.ts
src/integrations/database/entities/social/feed-post.entity.ts
src/integrations/database/entities/social/post-reaction.entity.ts
src/integrations/database/entities/social/chat-message.entity.ts
src/integrations/database/entities/gamification/user-stats.entity.ts
src/integrations/database/entities/gamification/point-transaction.entity.ts
src/integrations/database/entities/gamification/user-achievement.entity.ts
src/integrations/database/entities/gamification/user-daily-mission.entity.ts
src/integrations/database/entities/gamification/user-cosmetic.entity.ts
src/integrations/database/entities/catalogs/achievement.entity.ts
src/integrations/database/entities/catalogs/daily-mission.entity.ts
src/integrations/database/entities/catalogs/cosmetic-item.entity.ts
```

Infraestrutura TypeORM/contrato técnico/baseline (13):

```text
src/integrations/database/catalog-seed.ts
src/integrations/database/check-mapping.ts
src/integrations/database/data-inspection.ts
src/integrations/database/database-health.adapter.ts
src/integrations/database/database-source.ts
src/integrations/database/database.options.ts
src/integrations/database/resource-path.ts
src/integrations/database/schema-contract.json
src/integrations/database/schema-inspection.ts
src/integrations/database/seed.ts
src/integrations/database/migrations/1789430400000-DefinitiveBaseline.ts
src/integrations/database/migrations/sql/definitive-baseline.sql
src/shared/database/database-health.ts
```

Testes (5):

```text
tests/e2e/health.spec.ts
tests/fixtures/catalogs-before-alignment.sql
tests/integration/database.spec.ts
tests/sql/integrity.sql
tests/unit/database-options.spec.ts
```

## Arquivos modificados e excluídos do versionamento

Modificados (19):

```text
.env.example
.gitignore
README.md
docs/architecture/infrastructure-contract.md
infra/docker/compose.yaml
jest.config.ts
nest-cli.json
package.json
package-lock.json
src/app.module.ts
src/main.ts
src/integrations/database/data-source.ts
src/integrations/database/database.module.ts
src/modules/health/health.controller.ts
src/modules/health/health.module.ts
src/shared/config/env.validation.ts
tsconfig.json
tsconfig.build.json
tsconfig.spec.json
```

`src/app.module.ts`, `src/main.ts`, `src/modules/health/health.module.ts` e `tsconfig.spec.json` receberam apenas formatação, preservando a base NestJS. Os demais caminhos contêm os ajustes técnicos descritos neste relatório.

Excluído do versionamento (1): `tsconfig.build.tsbuildinfo`, removido com `git rm --cached`, sem apagar o arquivo local. Não foram excluídos código, migrations, documentos ou dados importantes. Como a branch partiu da main TypeORM, os arquivos Prisma entram como legado, não como remoção física de uma árvore Prisma preexistente nessa branch.

## Estado Git pré-versionamento e autorizações

Snapshot conferido antes do versionamento: branch `feat/database-typeorm-integration`, **19 arquivos modificados, 68 arquivos novos sem stage e 1 remoção staged de artefato gerado** (88 caminhos no status detalhado). Nesse momento, o índice continha somente a remoção do `tsconfig.build.tsbuildinfo`; os arquivos funcionais estavam no worktree, sem commit. `.env`, backups, dumps, dist, node_modules e tsbuildinfo locais estão ignorados. Não havia merge/rebase/cherry-pick em andamento; a main local e a branch original não haviam sido alteradas.

O usuário autorizou e foi executado exclusivamente o registro fake de `DefinitiveBaseline1789430400000`, preservando tabelas/dados e `_prisma_migrations`. Nenhuma pendência TypeORM permanece no banco local real. O comando autorizado foi:

```bash
npm run db:baseline -- --fake \
  --backup backups/macromaniacs_pre_typeorm_20260915.dump \
  --confirm-existing-database
```

Em 15/09/2026, o usuário autorizou o commit da integração, seu push e a integração por merge `--no-ff` na `main`, seguida de push exclusivamente para `origin/main`, sem force ou amend. Títulos definidos: `refactor(database): migra persistência de Prisma para TypeORM` e `merge: integra arquitetura definitiva do banco com TypeORM`. Hashes e resultados de envio são conferidos pelo histórico Git e pelas referências remotas após cada operação, não inseridos circularmente no próprio commit.

Antes do commit, `npm install`, format/format:check, lint, typecheck, build, dez testes Jest e sete testes de integração foram repetidos com sucesso. SQL completo passou no banco descartável, DBML continuou alinhado e o banco real foi apenas consultado: baseline aplicada, nenhuma pendência e zero drift. Após integrar a main, repetir as verificações essenciais antes do push. O anexo de autorização termina incompleto na regra de push protegido; proteção ou rejeição implica parar, sem force, bypass ou mudança automática para outro fluxo.

Alterações adicionais no banco real, restart/recriação do container e cleanup destrutivo dos recursos de validação continuam exigindo autorização separada. Esta etapa de versionamento não reaplica a baseline real nem executa o seed no banco real.
