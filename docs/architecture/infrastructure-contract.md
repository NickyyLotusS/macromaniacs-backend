# Contrato entre backend e infraestrutura

## Ambientes

- `development`: PostgreSQL 15 local via Docker Compose, porta externa `5433`.
- `test`: banco descartável e isolado; nunca reutiliza o banco de desenvolvimento.
- `staging` e `production`: PostgreSQL 15 gerenciado, com conexão TLS e credenciais próprias por ambiente.

O `docker-compose.yml` da raiz é o ponto de entrada local. `infra/docker/docker-compose.yml` é mantido como espelho para automações da infraestrutura.

## Variáveis e secrets

| Variável | Obrigatória | Observação |
|---|---|---|
| `APP_ENV` | Não | Default `development`; valores: `development`, `test`, `staging`, `production` |
| `APP_PORT` | Não | Default `3000` |
| `DATABASE_URL` | Sim | URL PostgreSQL; secret fora de development |
| `JWT_ACCESS_SECRET` | Sim quando autenticação existir | Secret forte e rotacionável; nunca versionado |

Não há refresh token no escopo atual. Uma eventual adoção exige contrato separado para rotação, revogação e secret.

## Migrations

- Backend é responsável por criar, revisar e versionar migrations Prisma.
- Infra é responsável por executar `prisma migrate deploy` uma única vez por release em staging/produção.
- Migrations nunca são executadas por todas as réplicas da aplicação durante startup.
- Antes do deploy, infra deve gerar backup restaurável e registrar o estado de `_prisma_migrations`.
- A pipeline deve executar `prisma validate`, `prisma generate`, migrations em banco vazio e migrations sobre uma cópia do schema anterior.
- Falha de migration interrompe o rollout. Rollback da aplicação não implica rollback automático do banco.
- Mudanças destrutivas seguem estratégia expand/contract em releases separados. Nenhuma coluna com dados é removida sem auditoria e aprovação.

## Segurança e dados

- Tráfego para bancos gerenciados usa TLS.
- Credenciais são distintas por ambiente e têm o menor privilégio necessário.
- Backups e volumes são criptografados em repouso.
- Logs não incluem senha, hash de senha, token, data de nascimento, sexo biológico, medições ou restrições alimentares.
- Acesso administrativo ao banco é auditado.
- Retenção e exclusão de dados pessoais seguem a política do produto; propriedade de grupos deve ser transferida antes da exclusão do criador.

## Storage, jobs e observabilidade

- O banco armazena apenas URLs de imagens/assets; binários ficam em storage externo.
- Fila e mecanismo de jobs ainda não foram definidos. Jobs não devem ser adicionados ao banco sem requisito funcional.
- O health check da aplicação deve distinguir disponibilidade HTTP de conectividade com PostgreSQL.
- Métricas mínimas: conexões, latência, erros, espaço, locks, replica lag quando aplicável e duração/falha de migrations.
- Alertas e dashboards são responsabilidade da infraestrutura; nomes e SLAs serão definidos antes de staging.

## Rede e aplicação

- HTTPS termina na camada de infraestrutura em staging/produção.
- CORS é configurado por ambiente com allowlist explícita.
- O banco não é exposto publicamente.
- Pool de conexões e limites serão dimensionados antes do primeiro deploy compartilhado.
