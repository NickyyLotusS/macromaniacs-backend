# Banco de dados — MacroManiacs

Este documento descreve o banco relacional do escopo atual. Ele deve ser atualizado na mesma mudança que alterar `prisma/schema.prisma`, migrations ou `diagrama.dbml`.

## Tecnologias e convenções

- PostgreSQL 15.
- Prisma ORM e Prisma Client 5.22.
- Tabelas e colunas físicas em `snake_case`; modelos e campos Prisma em `PascalCase`/`camelCase`.
- Chaves primárias UUID v4 geradas pelo Prisma Client.
- Instantes em `TIMESTAMPTZ`; datas civis em `DATE`.
- Valores monetários da loja são pontos inteiros, não moeda fiduciária.
- `created_at` tem default no banco. `updated_at` é atualizado pelo Prisma Client por meio de `@updatedAt`; SQL externo deve atualizá-lo explicitamente.
- `CHECK` constraints ficam nas migrations SQL porque o Prisma 5 não consegue representá-las no schema declarativo.

O schema preserva exatamente 23 modelos. Funcionalidades citadas em versões antigas da documentação — refresh tokens, papel global de usuário, metas de hidratação, sódio, tipo fixo de refeição, posts globais e quests semanais — não fazem parte do escopo atual.

## Enums

| Enum | Valores |
|---|---|
| `UserGoal` | `WEIGHT_LOSS`, `MUSCLE_GAIN`, `STRENGTH_GAIN`, `MAINTENANCE`, `PERFORMANCE`, `RECOMPOSITION` |
| `BiologicalSex` | `FEMALE`, `MALE`, `NOT_INFORMED` |
| `ActivityLevel` | `SEDENTARY`, `LIGHT`, `MODERATE`, `INTENSE`, `VERY_INTENSE` |
| `FoodSource` | `TBCA`, `OPEN_FOOD_FACTS`, `USDA`, `MANUAL` |
| `MealInputMethod` | `BARCODE`, `PLANNED_MEAL`, `PHOTO`, `MANUAL` |
| `CosmeticType` | `TAG`, `AVATAR`, `FRAME`, `BACKGROUND` |
| `MemberRole` | `ADMIN`, `MEMBER` |
| `DietPlanStatus` | `DRAFT`, `ACTIVE`, `COMPLETED`, `ARCHIVED` |
| `GroupChallengeStatus` | `SCHEDULED`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `ReactionType` | `LIKE`, `FIRE`, `CLAP` |
| `PointTransactionReason` | `DAILY_MISSION_COMPLETED`, `ACHIEVEMENT_UNLOCKED`, `MEAL_LOG_STREAK`, `COSMETIC_PURCHASE`, `ADMIN_ADJUSTMENT` |

## Identidade, onboarding e progresso

### `users`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | UUID | PK |
| `email` | VARCHAR(255) | Obrigatório, único, lowercase e formato de e-mail |
| `password_hash` | VARCHAR(255) | Obrigatório e não vazio; nunca armazena senha ou confirmação em texto claro |
| `username` | VARCHAR(50) | Obrigatório, único, lowercase; 3–50 caracteres `[a-z0-9_]` |
| `display_name` | VARCHAR(100) | Obrigatório e não vazio |
| `created_at`, `updated_at` | TIMESTAMPTZ | Auditoria |

E-mail e username devem ser normalizados antes da persistência. A constraint do banco impede que outro cliente grave uma forma não canônica.

### `user_profiles`

Relação opcional 1:1 com `users`, usando `user_id` como PK e FK. A ausência do registro significa onboarding ainda não concluído. Quando o registro é criado, todos os dados metabólicos obrigatórios devem estar presentes.

| Coluna | Tipo | Regra |
|---|---|---|
| `user_id` | UUID | PK/FK → `users.id` |
| `birth_date` | DATE | Obrigatório, não pode estar no futuro |
| `biological_sex` | `BiologicalSex` | Obrigatório |
| `height_cm` | DECIMAL(5,2) | Obrigatório e positivo |
| `current_weight_kg` | DECIMAL(5,2) | Obrigatório e positivo |
| `target_weight_kg` | DECIMAL(5,2) | Opcional e positivo quando informado |
| `target_date` | DATE | Opcional e posterior ao nascimento |
| `dietary_restrictions_note` | TEXT | Opcional; texto livre não vazio quando informado |
| `goal` | `UserGoal` | Obrigatório, sem default |
| `activity_level` | `ActivityLevel` | Obrigatório |
| `avatar_config` | JSONB | Objeto JSON, default `{}` |
| `created_at`, `updated_at` | TIMESTAMPTZ | Auditoria |

### `body_measurements`

Histórico 1:N de peso. Contém `id`, `user_id`, `weight_kg > 0` e `measured_at`. O índice `(user_id, measured_at DESC)` atende à consulta da medição mais recente.

### `user_stats`

Agregado 1:1 para ranking: `current_streak`, `best_streak`, `total_points`, `last_activity_at`, `created_at` e `updated_at`. Streaks e pontos são não negativos e `best_streak >= current_streak`.

## Nutrição e diário alimentar

### `foods`

Catálogo normalizado por 100 g:

- identificação: `id`, `name`, `source`, `external_id`, `barcode`;
- nutrientes `DECIMAL(6,2)`: `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`, `fiber_per_100g`;
- `serving_size_g DECIMAL(6,2)` com default 100;
- `created_at` e `updated_at`.

Nutrientes não podem ser negativos e a porção deve ser positiva. `barcode` é único. `(source, external_id)` também é único quando `external_id` está preenchido. `name` é indexado para busca.

### `diet_plans`

Plano pertencente a um usuário: `id`, `user_id`, `title`, `status`, metas de calorias/proteína/carboidrato/gordura/fibra, `start_date`, `end_date`, `created_at` e `updated_at`.

- `target_calories > 0`; demais metas são não negativas.
- Quando as duas datas existem, `end_date >= start_date`.
- Índice `(user_id, status)`.

### `planned_meals`

Refeições ordenadas dentro do plano: `id`, `diet_plan_id`, `name`, `order_index`, metas nutricionais opcionais, `created_at` e `updated_at`.

- `order_index > 0` e é único dentro do plano.
- Metas opcionais são não negativas quando preenchidas.

### `planned_meal_items`

Itens planejados com snapshot nutricional: `id`, `planned_meal_id`, `food_id` opcional, `amount_grams`, `calories DECIMAL(8,2)`, proteína, carboidrato, gordura, fibra, `created_at` e `updated_at`.

Quantidade deve ser positiva; nutrientes não podem ser negativos. Se o alimento for removido, `food_id` vira `NULL` e o snapshot permanece.

### `meal_logs`

Registro consumido: `id`, `user_id`, `planned_meal_id` opcional, `name`, `photo_url`, `consumed_at`, `created_at` e `updated_at`.

Possui índices `(user_id, consumed_at)` e `planned_meal_id`. A remoção da refeição planejada apenas limpa o vínculo.

### `meal_log_items`

Snapshot imutável do consumo: `id`, `meal_log_id`, `food_id` opcional, `amount_grams`, `calories DECIMAL(8,2)`, proteína, carboidrato, gordura, fibra e `input_method`.

Quantidade deve ser positiva e nutrientes não negativos. Alterações futuras em `foods` não reescrevem o histórico.

## Grupos e social

### `groups`

Contém `id`, `creator_id`, `name`, `description`, `invite_code`, `created_at` e `updated_at`.

- `creator_id` referencia `users` com `RESTRICT`: a propriedade deve ser transferida antes de excluir o usuário.
- O código de convite é único e possui oito caracteres alfanuméricos maiúsculos.
- A criação do grupo e do vínculo `GroupMember(ADMIN)` do criador deve ocorrer na mesma transação da aplicação.

### `group_members`

Tabela N:N com PK `(group_id, user_id)`, `role` e `joined_at`. Excluir usuário ou grupo remove o vínculo. `user_id` possui índice reverso.

### `group_challenges`

Contém `id`, `group_id`, título, descrição, intervalo, status e auditoria. `end_at > start_at`. Índice `(group_id, status, start_at)`.

### `feed_posts`

Post dentro de grupo: `id`, `group_id`, `user_id`, `meal_log_id` opcional, `content`, `created_at` e `updated_at`. Deve conter texto não vazio ou uma refeição vinculada.

Consultas principais usam `(group_id, created_at DESC)` e `(user_id, created_at DESC)`.

### `post_reactions`

Contém `id`, `post_id`, `user_id`, `reaction_type` e `created_at`. `(post_id, user_id)` é único, portanto cada usuário mantém no máximo uma reação por post e pode trocar seu tipo.

### `chat_messages`

Mensagem não vazia com `id`, `group_id`, `user_id`, `message` e `created_at`. Índices por `(group_id, created_at DESC)` e usuário.

## Gamificação e loja

### `point_transactions`

Ledger append-only com `id`, `user_id`, `amount`, `reason`, `metadata JSONB` e `created_at`.

- `amount` deve ser diferente de zero; positivo concede e negativo consome pontos.
- `metadata` deve ser um objeto JSON e guarda contexto sem fingir uma FK polimórfica.
- Índice `(user_id, created_at DESC)`.

### `achievements` e `user_achievements`

`achievements` possui `id`, `code` único, título, descrição, ícone e auditoria. `user_achievements` usa PK `(user_id, achievement_id)` e registra `unlocked_at`.

Achievements referenciados não podem ser apagados; o usuário pode ser apagado em cascade.

### `daily_missions` e `user_daily_missions`

`daily_missions` possui `id`, `code` único, título, `target_count > 0`, recompensa não negativa e auditoria.

`user_daily_missions` usa PK `(user_id, mission_id, date)`, contém progresso não negativo e `is_claimed`. `date` deve ser fornecida pela aplicação usando o fuso de negócio, evitando depender do fuso da sessão do PostgreSQL.

Missões já referenciadas não podem ser removidas.

### `cosmetic_items` e `user_cosmetics`

`cosmetic_items` possui `id`, `code` único, nome, descrição, tipo, preço não negativo, URL do asset e auditoria. `user_cosmetics` usa PK `(user_id, cosmetic_item_id)` e registra `acquired_at`.

Itens adquiridos não podem ser removidos do catálogo.

## Política de relacionamentos

- Dados diretamente pertencentes ao usuário usam `ON DELETE CASCADE`.
- Conteúdo pertencente ao grupo usa `ON DELETE CASCADE`.
- Referências opcionais a alimentos, refeições planejadas e logs usam `SET NULL` para preservar snapshots/conteúdo.
- Propriedade de grupo e catálogos com histórico usam `RESTRICT`.
- FKs usam `ON UPDATE CASCADE`.

As seguintes regras dependem da camada de aplicação:

- autor de post ou mensagem deve ser membro do grupo;
- `meal_logs.planned_meal_id` deve pertencer ao mesmo usuário;
- `feed_posts.meal_log_id` deve pertencer ao autor;
- criador do grupo deve possuir vínculo `ADMIN`;
- `current_progress` não deve ultrapassar `target_count`.

## Invariantes transacionais

### Peso atual

Ao registrar uma nova medição, o serviço deve executar uma única transação que:

1. cria `body_measurements`;
2. atualiza `user_profiles.current_weight_kg` com o mesmo valor e instante lógico.

### Pontos

Ao conceder ou consumir pontos, o serviço deve executar uma única transação que:

1. insere `point_transactions`;
2. atualiza `user_stats.total_points` sem permitir saldo negativo.

### Grupo

A criação deve inserir `groups` e o `group_members` do criador com papel `ADMIN` na mesma transação. Transferência de propriedade deve promover o novo criador antes de atualizar `creator_id`.

## Autenticação e privacidade

O escopo atual armazena somente hash de senha. Confirmação de senha existe apenas no frontend. Não existe estratégia implementada de refresh token; por isso não há tabela de sessões ou tokens.

Caso refresh tokens rotativos sejam adotados, a persistência deve guardar apenas hash, expiração, revogação e identificação de sessão/dispositivo — nunca o token em texto claro.

Nascimento, sexo biológico, medições e restrições alimentares são dados pessoais sensíveis. Devem ter acesso restrito, não aparecer em logs e seguir a política de retenção/eliminação da conta. O banco não armazena dados sem requisito atual.

## Migrations

Histórico atual:

1. `20260828205140_init_schema_and_tables`: criação inicial das 23 tabelas;
2. `20260828205714_init_schema_and_tables`: migration histórica vazia, preservada por já estar aplicada;
3. `20260904_align_onboarding_profile`: alinhamento inicial do onboarding, preservada por já estar aplicada;
4. `20260904_z_definitive_database_alignment`: consolidação de enums, constraints, índices, auditoria e backfills. O sufixo `z` garante ordenação posterior à migration histórica `20260904_align_onboarding_profile`.

Nunca edite uma migration registrada em `_prisma_migrations`. Em desenvolvimento, gere mudanças com `prisma migrate dev --create-only`, revise o SQL e só então aplique. Em deploy, use `prisma migrate deploy` com backup e estratégia de rollback definidos pela infraestrutura.

## Execução local

```bash
docker compose up -d
npx prisma migrate status
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

Banco local: `localhost:5433`, encaminhado ao PostgreSQL `5432` do container.

Validações mínimas para alterações futuras:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate status
```

O seed usa códigos estáveis e `upsert`; executá-lo repetidamente não duplica achievements, missões ou cosméticos.
