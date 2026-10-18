# Transição Prisma → TypeORM

## Fontes e escopo

A integração parte de `origin/main` (`3e32843`, BE-003 TypeORM), com arquitetura PostgreSQL definitiva de `origin/feat/database-architecture-setup` (`02b593d`). Branch de implementação: `feat/database-typeorm-integration`. A auditoria e implementação ocorreram sem merge cego; seu versionamento e a integração posterior à main foram autorizados separadamente.

O banco original tem 23 tabelas de domínio, 11 tipos enum, 55 índices, 23 PKs, 29 FKs e 50 CHECKs. As quatro migrations Prisma permaneceram byte a byte em `legacy/prisma`. TypeORM é o único ORM ativo; o histórico Prisma não é executado no runtime/deploy e `_prisma_migrations` não é apagada. Funcionalidades de documentação obsoleta continuam fora do escopo.

Estado local em 15/09/2026: `DefinitiveBaseline1789430400000` registrada com `--fake` após autorização, sem SQL estrutural da baseline e sem alterações nos dados/objetos de domínio; nenhuma migration TypeORM pendente. Evidências e comparação antes/depois estão no [relatório de integração](typeorm-integration-report.md). O procedimento abaixo continua obrigatório para outros bancos existentes.

Entidades estão em `src/integrations/database/entities/{identity,nutrition,meals,gamification,social,catalogs}`. O SQL de `DefinitiveBaseline1789430400000` foi extraído de banco descartável que recebeu o histórico completo, não do schema declarativo incompleto quanto aos CHECKs. A baseline cria diretamente o estado final; não reaplica backfills de dados antigos.

## Regras permanentes

- `synchronize: false`, `migrationsRun: false`, `installExtensions: false` em CLI/NestJS.
- Usar apenas migrations TypeORM futuras, explícitas em `databaseOptions`.
- Não executar DDL da baseline sobre banco já existente.
- Não usar `--fake` para encobrir diferenças, histórico falho ou migrations desconhecidas.
- Não executar revert destrutivo sem aprovação; a baseline bloqueia revert fora de banco descartável autorizado.
- Não modificar migrations Prisma aplicadas, nem instalar Prisma Client no projeto ativo.
- Não apagar/recriar volumes, tabelas ou dados reais durante a transição.
- Não registrar secrets, dumps, caches, logs, `.env`, `dist`, `node_modules` ou `*.tsbuildinfo` no Git.

## Infraestrutura canônica

O banco local identificado usa PostgreSQL 15 (container `macromaniacs_postgres`), host `localhost:5433` → container `5432`, usuário `postgres`, banco `macromaniacs_db` e volume `macromaniacs-backend_pgdata`. O Compose único é `infra/docker/compose.yaml`, com projeto explícito `macromaniacs-backend`, igual ao label do container existente; o volume é **externo**, impedindo criação silenciosa de outro volume por mudança do diretório/projeto Compose. Outro volume encontrado, `macromaniacs-database-setup_pgdata`, não é usado nem removido.

BE-003 tinha PostgreSQL 17, outra porta, usuário/banco e volume. Essa configuração foi alinhada ao banco com dados; não foi feito upgrade físico de PostgreSQL nem montado volume 15 em imagem 17. Em projeto novo, criar explicitamente o volume informado antes do Compose; em projeto existente, confirmar seu nome com `docker inspect` e nunca executar `down -v`.

`.env.example` contém somente placeholders. Não sobrescrever `.env` existente. `db:local` lê/valida `DATABASE_URL`, aproveita credenciais locais sem imprimi-las e espera o healthcheck. O backend é executado no host; não foi inventado um container de aplicação fora do fluxo atual.

## Banco vazio

Confirme que `DATABASE_URL` aponta para o banco vazio desejado, não para o banco Prisma existente:

```bash
npm ci
npm run migration:run
npm run seed
npm run seed
npm run db:verify
npm run db:drift
npm run migration:show
```

São criadas 23 tabelas de domínio e a tabela de controle TypeORM. O seed separado inclui/atualiza 4 achievements, 3 missões e 3 cosméticos conhecidos, preservando IDs e quaisquer registros adicionais. Os UUIDs continuam sem default SQL; a aplicação deve fornecê-los.

Depois do build, `migration:run:prod`, `migration:show:prod`, `migration:revert:prod` e `seed:prod` usam arquivos `.js` de `dist`. Nest copia o SQL e o contrato JSON como assets. Inicialização normal não aplica migrations.

## Testes reproduzíveis e isolados

Crie um PostgreSQL de validação independente, sem montar qualquer volume real:

```bash
docker run --detach --name macromaniacs_typeorm_validation \
  --publish 127.0.0.1:5434:5432 --tmpfs /var/lib/postgresql/data \
  --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=validation_only \
  --env POSTGRES_DB=validation postgres:15-alpine

TEST_ADMIN_DATABASE_URL=postgresql://postgres:validation_only@127.0.0.1:5434/validation \
  npm run test:integration
```

`validation_only` é credencial descartável de exemplo, não secret de ambiente real. Se o container já existir, inspecione-o antes de executar o comando novamente. A suíte gera nomes únicos `macromaniacs_test_empty_*` e `macromaniacs_test_legacy_*`, verifica servidor separado e preserva os bancos para inspeção; não apaga bancos automaticamente.

Cenário A: baseline completa sobre banco vazio; seed duas vezes; contagens/IDs; integridade SQL; 23 tabelas/11 enums e todas as constraints/índices.

Cenário B: quatro arquivos SQL Prisma, catálogo histórico equivalente, fixture legada, histórico/checksums; baseline TypeORM `--fake`; fingerprints de todas as tabelas antes/depois sem troca de dados; migrations seguintes (atualmente nenhuma); seed duas vezes; integridade SQL e zero drift.

Casos cobertos: e-mail/username duplicados e não canônicos; enum inválido; perfil incompleto; altura/pesos inválidos; nutrientes/quantidades negativos; datas incoerentes; post/mensagem vazios; convite inválido/duplicado; cascatas, SET NULL e RESTRICT; N:N duplicadas; proprietário ADMIN na transação; ledger/saldo; snapshots nutricionais; tipos e CRUD via repositórios; preflight com divergência/histórico falho/controle desconhecido; NestJS/readiness conectado ao banco descartável.

Para repetir SQL em um dos bancos gerados, use sua URL:

```bash
DATABASE_URL=postgresql://postgres:validation_only@127.0.0.1:5434/macromaniacs_test_SEU_BANCO \
  npm run test:sql
```

O SQL termina em `ROLLBACK`. O helper rejeita bancos sem prefixo de teste. Mesmo em bancos descartáveis, operações de limpeza destrutivas exigem aprovação explícita do operador.

## Comparação estrutural

`schema-inspection.ts` coleta tabelas, colunas, tipos/precisão/escala, defaults, nulabilidade, identidade, collation, ordem lógica de colunas, enums e ordem dos rótulos, PK/FK/CHECK, validação, índices/ordenação/unicidade, rotinas, triggers, views e sequences. `schema-contract.json` é um fixture estrutural versionado, não um artefato de build.

Ignore somente as tabelas de controle `_prisma_migrations` e `migrations`, com seus próprios índices/constraints/sequences. OIDs, posições numéricas internas de enum e lacunas de `attnum` deixadas por colunas removidas não são identidades de schema: compare nomes, ordem dos rótulos e posição das colunas sobreviventes. Não esconder diferenças de coluna/default/CHECK/FK/índice.

```bash
# URL de um banco já migrado. Sem REFERENCE_DATABASE_URL, compara com o fixture definitivo.
npm run db:verify
npm run db:drift

# Comparação direta entre os bancos produzidos pelos dois históricos:
DATABASE_URL=URL_DO_BANCO_TYPEORM REFERENCE_DATABASE_URL=URL_DO_BANCO_PRISMA npm run db:verify
```

As verificações são somente de leitura e falham em divergência. O gerador TypeORM tem compatibilidade restrita para defaults `CURRENT_TIMESTAMP`, pois 1.1.1 normaliza essa expressão para `now()` e compara sua caixa de forma inconsistente; essa discrepância podia provocar remoção de índices em alterações de coluna. Não altera defaults no banco nem oculta diferenças reais de contrato. CHECKs têm nomes/expressões canônicas; índices DESC estão em SQL e anotados individualmente. Atualização do ORM deve passar por paridade e teste de zero drift.

`UserGoal` físico preserva a ordem histórica: `WEIGHT_LOSS`, `MUSCLE_GAIN`, `MAINTENANCE`, `RECOMPOSITION`, `STRENGTH_GAIN`, `PERFORMANCE`. A ordenação de apresentação da UI não deve depender de comparação ordinal PostgreSQL do enum.

## Backup externo e restauração

Antes de qualquer registro no banco real:

```bash
# Leitura do banco real; escreve apenas dump/manifesto locais ignorados pelo Git.
npm run db:backup -- --container macromaniacs_postgres --output backups/macromaniacs_pre_typeorm.dump
```

O helper confirma volume, faz transação read-only com snapshot exportado para `pg_dump`, grava formato custom diretamente no host com permissão 0600 e criação exclusiva (não sobrescreve backups), verifica cabeçalho/bytes/SHA-256 e `pg_restore --list`. O manifesto `.dump.json` contém schema, contagens/hashes sem valores pessoais e histórico Prisma. Não é suficiente manter dump apenas em `/tmp` do container.

Restaure **somente em banco descartável vazio**, criado no container isolado, após autorização do operador:

```bash
docker exec macromaniacs_typeorm_validation psql -U postgres -d validation \
  -v ON_ERROR_STOP=1 -c 'CREATE DATABASE macromaniacs_test_backup_restore;'
docker exec -i macromaniacs_typeorm_validation pg_restore \
  -U postgres -d macromaniacs_test_backup_restore --no-owner --no-privileges --exit-on-error \
  < backups/macromaniacs_pre_typeorm.dump
DATABASE_URL=postgresql://postgres:validation_only@127.0.0.1:5434/macromaniacs_test_backup_restore \
  npm run db:backup:verify -- backups/macromaniacs_pre_typeorm.dump
```

Verifique equivalência de schema, conteúdo de todas as 23 tabelas e histórico/checksums; apenas então o manifesto recebe `restoreVerified: true`. Preserve backups em armazenamento seguro externo ao container; staging/produção exige política de infra, criptografia, retenção e ensaio de restore. Restaurar sobre banco real, usar `--clean` ou excluir volume não faz parte deste procedimento e exige autorização separada.

## Baseline de banco definitivo Prisma existente

1. Confirmar ambiente, volume e janela sem mudanças concorrentes de schema.
2. Consultar `_prisma_migrations`: exatamente quatro registros esperados, terminados e não revertidos; checksums iguais aos arquivos arquivados.
3. `db:verify` e `db:drift`: nenhuma diferença estrutural nem DDL pendente.
4. Backup externo com restore validado e checksum conferido; não sobrescrever backup anterior.
5. `npm run db:baseline`: preflight **somente de leitura**, sem criação da tabela de controle.
6. **Parar e solicitar autorização para o banco real.**
7. Somente após aprovação, executar:

```bash
npm run db:baseline -- --fake --backup backups/macromaniacs_pre_typeorm.dump --confirm-existing-database
```

O comando dedicado carrega somente `DefinitiveBaseline1789430400000`, não migrations futuras. Exige backup restaurado do mesmo host/porta/banco, SHA-256 íntegro e até 24 horas de idade. Rejeita controles TypeORM desconhecidos e divergência; registro repetido é no-op. `--fake` insere somente o registro de controle, sem executar `up` ou recriar tabela/dado. `migration:show` comum pode criar a tabela de controle quando ausente; não use esse comando sobre o banco real antes de aprovação — use `db:baseline` read-only.

Até esse registro aprovado, um banco existente permanece sem baseline TypeORM. O código TypeORM pode conectar/readiness sem migrations automáticas, mas testes aprovados, por si só, não concluem a transição operacional. O banco local identificado recebeu o registro aprovado em 15/09/2026; isso não autoriza alterações em outros ambientes.

## Migrations futuras

```bash
npm run migration:create -- src/integrations/database/migrations/DescricaoDaMudanca
# Ou gerar contra uma cópia descartável equivalente, nunca contra produção:
npm run migration:generate -- src/integrations/database/migrations/DescricaoDaMudanca
```

Adicionar a classe gerada explicitamente à lista de migrations de `databaseOptions`, depois da baseline. Revisar `up`/`down` e todo SQL gerado: preservar nomes, índices DESC, CHECKs, casts de enums, precondições/backfills e relacionamentos; não aceitar remoção/recriação de coluna, enum ou constraint sem requisito. Usar expand/contract, backup e autorização para operações destrutivas. Não alterar a baseline após registro.

O script `migration:generate` valida que o banco tem prefixo `macromaniacs_test_*`, usa somente o DataSource oficial e compara todos os CHECKs físicos com os metadados antes de chamar o gerador. CHECK ausente no mapeamento ou expressão alterada bloqueia a geração: realizar migration SQL manual, revisada, para essa mudança. TypeORM pode ignorar alterações de expressão mantendo o mesmo nome. Sem diferenças, a CLI retorna código 1 com `No changes in database schema were found`; isso representa zero drift, não um teste malsucedido.

Executar em cópia de banco legado e em banco vazio, atualizar entidades/SQL/DBML/documentação/fixture de paridade na mesma mudança e confirmar novamente `db:drift`. Deploy aplica migrations explicitamente uma vez por release, não no startup de todas as réplicas. Revert da baseline requer `ALLOW_DESTRUCTIVE_BASELINE_REVERT=true` e banco `macromaniacs_test_*`; nunca automático.

## Regras da aplicação preservadas

SQL garante tipos, obrigatoriedade, unicidade, formatos, não negatividade, intervalos e políticas FK. As seguintes regras continuam em serviços/transações; não foram inventados módulos de negócio:

- Finalizar onboarding cria perfil completo e opcional em User, nunca perfil parcial.
- Peso: inserir medição e atualizar peso atual atomicamente; medições retroativas não devem substituir o peso da medição mais recente.
- Pontos: ledger append-only e saldo agregado na mesma transação, com concorrência controlada e sem saldo negativo; o banco não implementa automaticamente esse agregado.
- Grupo: criar proprietário e membership ADMIN juntos; transferir propriedade antes de excluir criador.
- Autor de conteúdo deve ser membro; refeição/log vinculado deve pertencer ao autor/usuário; progresso de missão não ultrapassa meta.
- Snapshots não são recalculados quando catálogo muda. Exclusão de log ligado a post sem texto conflita com o CHECK de post não vazio: tratar o conteúdo/post antes do SET NULL, na mesma operação autorizada.
- O seed não altera IDs de catálogos nem concede conquistas/missões/cosméticos a usuários automaticamente.

## Qualidade e riscos operacionais

```bash
npm ci
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test -- --runInBand
npm run test:e2e
npm run docs:dbml
git diff --check
git status --short --branch
```

Executar também a suíte SQL/integração isolada e verificar segredos/artefatos. A versão Node 22.20.0 local está abaixo do mínimo 22.22.3 exigido por dependências do CLI; preferir versão suportada. Correções npm compatíveis removem os avisos de produção encontrados; a ferramenta dev `@nestjs/mau` conserva avisos cuja correção sugerida exige mudança incompatível. Não usar `npm audit fix --force` automaticamente.

Na inspeção de schema, TypeORM 1.1.1 emite aviso do `pg` 8 sobre consultas concorrentes no mesmo client, originado no `PostgresQueryRunner.getUserDefinedTypeName`/`loadTables` interno (`Promise.all`), não no coletor de paridade, que é sequencial. A validação passa com a versão atual; atualizar para `pg` 9 exige ensaio de compatibilidade. Não suprimir o aviso nem alterar `node_modules` para ocultá-lo.
