# Contrato entre backend e infraestrutura

## Banco e ambientes

- Development: PostgreSQL 15, Compose canônico `infra/docker/compose.yaml`, container `macromaniacs_postgres`, host 5433/container 5432, usuário `postgres`, banco `macromaniacs_db`, volume externo existente `macromaniacs-backend_pgdata`.
- Test: PostgreSQL isolado na porta 5434, sem volumes reais, bancos `macromaniacs_test_*`. Limpeza exige aprovação; nunca reutilizar banco real.
- Staging/production: PostgreSQL gerenciado, TLS, credenciais distintas e mínimo privilégio. Upgrade de versão/volume exige plano próprio; não montar volume PostgreSQL 15 em imagem 17.

Não manter Composes concorrentes com usuários, portas ou volumes diferentes. `db:local` valida URL/configuração sem imprimir secrets e espera o healthcheck. Aplicação atual roda no host; eventual container da aplicação deve depender de `postgres: service_healthy`.

## Configuração e secrets

`DATABASE_URL` é obrigatória e validada (protocolo, host, usuário, banco). `APP_ENV` aceita development/test/staging/production e `APP_PORT` default 3000. `POSTGRES_{USER,PASSWORD,DB,PORT,VOLUME}` documentam a infraestrutura local; credenciais da URL e do container devem concordar. `.env.example` só tem placeholders; `.env` não é versionado.

Contrato da base NestJS preserva `AUTH_SECRET`, providers/bucket de storage, OCR e URL Open Food Facts. Autenticação/refresh tokens, filas e SLAs completos não foram implementados nesta tarefa. Não adicionar tabelas por hipótese.

## ORM, migrations e baseline

TypeORM é o único ORM ativo. Prisma criou o schema inicial; seus arquivos estão em `legacy/prisma` somente para auditoria e replay SQL em bancos descartáveis. Não instalar/executar Prisma no deploy ativo nem remover `_prisma_migrations` do banco.

Backend cria/revisa migrations TypeORM e mantém entidades, DBML e documentação consistentes. Infra aplica `migration:run:prod` explicitamente uma vez por release, com backup e observação do resultado. `synchronize: false`, `migrationsRun: false` e `installExtensions: false` são permanentes; nunca migrations em startup de réplicas.

Banco vazio recebe a baseline normal e seed separado. Banco definitivo Prisma recebe somente a baseline `--fake`, depois de histórico/checksums, equivalência estrutural, backup **externo** restaurado e autorização. Não executar DDL da baseline no banco existente nem fake de migrations desconhecidas. Preflight read-only: `db:baseline`; o CLI `migration:show` pode criar controle e não deve ser usado sobre o real antes da aprovação.

CI deve executar typecheck/build/Jest, migrations em vazio, replay Prisma/--fake em cópia legada, seed duas vezes, integridade SQL, comparação estrutural e zero drift. Falha interrompe rollout. Expand/contract para mudanças destrutivas; rollback da aplicação não significa rollback do schema. Revert da baseline é bloqueado fora de bancos de teste autorizados.

## Backup e dados

`db:backup` grava formato custom direto no host, permissão 0600, checksum, listagem e manifesto; valida volume e snapshot read-only. Restore de ensaio apenas em PostgreSQL descartável, seguido de `db:backup:verify`. Staging/production: criptografia, retenção, armazenamento externo ao container e ensaio de recuperação sob responsabilidade de infra. Não versionar dump/manifesto.

Backups e volumes existentes não são apagados; `down -v`, schema drop/reset e restore destrutivo não estão autorizados. Acesso administrativo auditado, TLS e mínimo privilégio. Logs não incluem senha/hash/tokens nem dados de perfil/saúde. Transferir propriedade de grupos antes de excluir criador; políticas de retenção pessoais permanecem responsabilidade do produto.

## Observabilidade e responsabilidades restantes

`/health` é liveness; `/health/ready` consulta PostgreSQL e retorna 503 em falha. NestJS faz tentativas limitadas de conexão e sanitiza exceção de driver, sem duplicar conexão. Migrations não rodam automaticamente.

Storage guarda imagens/assets, banco somente URLs. Fila/jobs/CORS/domínio/HTTPS, pool e SLAs finais devem ser acordados antes de staging; não inventar funcionalidades de negócio. Monitorar latência, erros/conexões, espaço, locks, duração/falha de migrations e replica lag quando existir.

Procedimento completo de baseline, seed, backup/restore e invariantes transacionais: [orm-transition.md](orm-transition.md).
