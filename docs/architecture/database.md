# Arquitetura de Dados, Modelagem & Engenharia de Banco — MacroManiacs

> Documentação técnica oficial e integral do banco de dados relacional do ecossistema **MacroManiacs Backend**.

---

## 1. Visão Geral & Tecnologias

| Item | Detalhe |
|---|---|
| **SGBD** | PostgreSQL 15 (Containerizado via Docker) |
| **ORM** | Prisma ORM v5 |
| **Normalização** | 3ª Forma Normal (3NF) com suporte a semiestruturação controlada via JSONB |
| **Identificadores Únicos** | UUID v4 em todas as chaves primárias |
| **Porta Local Padrão** | `5433` (mapeada para `5432` dentro do container, evitando conflitos de porta nativos no macOS/Linux) |

---

## 2. Padrões Arquiteturais Adotados

### 2.1. Snapshot Pattern (`meal_log_items`)

O diário alimentar consome os dados do catálogo (`foods`), mas grava uma **cópia física e imutável** dos macronutrientes (`calories`, `protein`, `carbs`, `fat`) no momento exato do consumo.

**Objetivo:** alterações futuras na tabela de alimentos ou atualizações de dados de provedores externos não alteram retroativamente o histórico nutricional dos usuários.

### 2.2. Provider Pattern & Base Normalizada 100g (`foods`)

- Suporte nativo a múltiplos provedores externos de dados (`TBCA`, `OPEN_FOOD_FACTS`, `USDA`, `MANUAL`) via campos `provider` e `external_id`.
- Todos os valores nutricionais são obrigatoriamente persistidos calculados na base de **100g ou 100ml**, viabilizando escalonamento proporcional simples e linear no backend.

### 2.3. Ledger Pattern (`point_transactions`)

O saldo do usuário não sofre mutação direta e desprovida de histórico. Toda movimentação de pontos é registrada como um **lançamento contábil imutável**, com `amount` (positivo para crédito, negativo para débito), `reason` e metadados contextuais.

### 2.4. Semiestruturação em JSONB (`users.avatar_config`)

Configurações cosméticas de camadas do avatar utilizam tipo nativo **JSONB**, otimizando operações de leitura e eliminando múltiplos `JOIN`s complexos para renderização do perfil e telas sociais.

---

## 3. Dicionário de Dados & Modelagem Completa das Entidades

### 3.1. Domínio de Identidade & Perfil

#### Tabela: `users`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único do usuário |
| `email` | String (Unique) | E-mail de login |
| `password_hash` | String | Hash da senha (bcrypt/argon2) |
| `name` | String | Nome de exibição |
| `role` | Enum `Role`: `USER`, `ADMIN` | Nível de permissão |
| `points_balance` | Int (Default 0) | Saldo consolidado de pontos |
| `avatar_config` | JSONB (Default `{}`) | Configuração visual do avatar |
| `created_at` / `updated_at` | Timestamp | Controle temporal |

#### Tabela: `profiles`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único do perfil |
| `user_id` | UUID (FK `users.id`, Unique) | Vínculo 1:1 com usuário |
| `height_cm` | Decimal | Altura em centímetros |
| `weight_kg` | Decimal | Peso corporal atual em quilogramas |
| `birth_date` | Date | Data de nascimento |
| `gender` | Enum `Gender`: `MALE`, `FEMALE`, `OTHER` | Sexo biológico para cálculo de TMB |
| `activity_level` | Enum `ActivityLevel`: `SEDENTARY`, `LIGHT`, `MODERATE`, `VERY_ACTIVE` | Fator de atividade |
| `daily_calories` | Int | Meta calórica diária calculada |
| `daily_protein` | Decimal | Meta diária de proteína em gramas |
| `daily_carbs` | Decimal | Meta diária de carboidratos em gramas |
| `daily_fat` | Decimal | Meta diária de gorduras em gramas |
| `daily_water_ml` | Int | Meta diária de hidratação em mililitros |
| `created_at` / `updated_at` | Timestamp | Controle temporal |

#### Tabela: `user_refresh_tokens`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da sessão |
| `user_id` | UUID (FK `users.id`) | Usuário dono do token |
| `token_hash` | String (Unique) | Hash do refresh token emitido |
| `expires_at` | Timestamp | Data de expiração da sessão |
| `created_at` | Timestamp | Criação do token |

---

### 3.2. Domínio de Nutrição & Diário Alimentar

#### Tabela: `foods`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador único do alimento |
| `name` | String | Nome do alimento |
| `provider` | Enum `Provider`: `TBCA`, `OPEN_FOOD_FACTS`, `USDA`, `MANUAL` | Provedor da informação nutricional |
| `external_id` | String (Opcional) | Código de barras ou identificador na base externa |
| `serving_size_g` | Decimal (Default 100) | Base de cálculo padronizada |
| `calories` | Decimal | Calorias por 100g |
| `protein` | Decimal | Proteínas por 100g |
| `carbs` | Decimal | Carboidratos por 100g |
| `fat` | Decimal | Gorduras por 100g |
| `fiber` | Decimal (Opcional) | Fibras por 100g |
| `sodium_mg` | Decimal (Opcional) | Sódio em mg por 100g |
| `created_at` / `updated_at` | Timestamp | Controle temporal |

#### Tabela: `meal_logs`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do registro de refeição |
| `user_id` | UUID (FK `users.id`) | Usuário associado |
| `meal_type` | Enum `MealType`: `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK` | Tipo da refeição |
| `logged_at` | Timestamp | Data e horário da refeição |
| `created_at` / `updated_at` | Timestamp | Controle temporal |

#### Tabela: `meal_log_items`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do item consumido |
| `meal_log_id` | UUID (FK `meal_logs.id`) | Refeição à qual pertence |
| `food_id` | UUID (FK `foods.id`, Opcional) | Alimento de origem do catálogo |
| `quantity_g` | Decimal | Quantidade consumida em gramas/ml |
| `calories` | Decimal | Snapshot de calorias proporcionais consumidas |
| `protein` | Decimal | Snapshot de proteínas proporcionais consumidas |
| `carbs` | Decimal | Snapshot de carboidratos proporcionais consumidos |
| `fat` | Decimal | Snapshot de gorduras proporcionais consumidas |

---

### 3.3. Domínio Social & Comunidade

#### Tabela: `posts`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da publicação |
| `user_id` | UUID (FK `users.id`) | Autor da postagem |
| `meal_log_id` | UUID (FK `meal_logs.id`, Opcional) | Vínculo com registro de refeição compartilhado |
| `content` | Text | Conteúdo textual |
| `image_url` | String (Opcional) | URL da foto armazenada |
| `created_at` / `updated_at` | Timestamp | Controle temporal |

#### Tabela: `post_reactions`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da reação |
| `post_id` | UUID (FK `posts.id`) | Postagem que recebeu a reação |
| `user_id` | UUID (FK `users.id`) | Usuário que reagiu |
| `type` | Enum `ReactionType`: `LIKE`, `FIRE`, `CLAP` | Tipo de reação |
| `created_at` | Timestamp | Data da interação |

#### Tabela: `groups`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do grupo |
| `name` | String | Nome da guilda/comunidade |
| `description` | Text (Opcional) | Descrição e regras |
| `creator_id` | UUID (FK `users.id`) | Usuário criador do grupo |
| `created_at` / `updated_at` | Timestamp | Controle temporal |

#### Tabela: `group_members`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do vínculo |
| `group_id` | UUID (FK `groups.id`) | Grupo associado |
| `user_id` | UUID (FK `users.id`) | Membro participante |
| `role` | Enum `GroupRole`: `ADMIN`, `MEMBER` | Papel do membro no grupo |
| `joined_at` | Timestamp | Data de entrada |

---

### 3.4. Domínio de Gamificação & Loja

#### Tabela: `achievements`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da conquista |
| `title` | String | Título da conquista |
| `description` | Text | Regra e critério de desbloqueio |
| `icon_url` | String | Ícone de exibição |
| `points_reward` | Int | Quantidade de pontos concedidos |

#### Tabela: `user_achievements`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do desbloqueio |
| `user_id` | UUID (FK `users.id`) | Usuário premiado |
| `achievement_id` | UUID (FK `achievements.id`) | Conquista obtida |
| `unlocked_at` | Timestamp | Momento do desbloqueio |

#### Tabela: `quests`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da missão |
| `title` | String | Título da missão |
| `description` | Text | Descrição do objetivo |
| `quest_type` | Enum `QuestType`: `DAILY`, `WEEKLY` | Periodicidade da missão |
| `target_count` | Int | Quantidade alvo de execuções para conclusão |
| `points_reward` | Int | Recompensa em pontos |

#### Tabela: `user_quests`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do progresso individual |
| `user_id` | UUID (FK `users.id`) | Usuário em progresso |
| `quest_id` | UUID (FK `quests.id`) | Missão associada |
| `current_count` | Int (Default 0) | Progresso atual acumulado |
| `is_completed` | Boolean (Default `false`) | Flag de atingimento da meta |
| `is_claimed` | Boolean (Default `false`) | Flag de resgate da recompensa |
| `expires_at` | Timestamp | Limite temporal para conclusão |

#### Tabela: `avatar_items`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador do item cosmético |
| `name` | String | Nome do item |
| `category` | Enum `ItemCategory`: `HAT`, `SHIRT`, `PANTS`, `ACCESSORY`, `BACKGROUND` | Categoria cosmética |
| `price_points` | Int | Custo em pontos na loja |
| `asset_url` | String | URL do arquivo de renderização 2D/3D |
| `is_active` | Boolean (Default `true`) | Disponibilidade para compra |

#### Tabela: `user_avatar_items`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da posse |
| `user_id` | UUID (FK `users.id`) | Usuário proprietário |
| `avatar_item_id` | UUID (FK `avatar_items.id`) | Item adquirido |
| `is_equipped` | Boolean (Default `false`) | Estado de equipamento no avatar |
| `acquired_at` | Timestamp | Data da compra/desbloqueio |

#### Tabela: `point_transactions`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador da movimentação contábil |
| `user_id` | UUID (FK `users.id`) | Usuário impactado |
| `amount` | Int | Valor movimentado (+ para crédito, - para débito) |
| `reason` | Enum `TransactionReason`: `QUEST_COMPLETED`, `ACHIEVEMENT_UNLOCKED`, `MEAL_LOG_STREAK`, `AVATAR_PURCHASE`, `ADMIN_ADJUSTMENT` | Motivo da operação |
| `metadata` | JSONB (Default `{}`) | Dados contextuais (ex: IDs de missões ou itens comprados) |
| `created_at` | Timestamp | Momento do registro |

---

## 4. Guia Rápido de Execução Local (Quickstart)

### 4.1. Configuração do `.env`

Crie o arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="postgresql://postgres:password123@localhost:5433/macromaniacs_db?schema=public"
JWT_ACCESS_SECRET="secret_token_jwt_temporario"
PORT=3000
```

### 4.2. Subir o PostgreSQL via Docker

Inicie o container isolado do banco:

```bash
docker compose up -d
```

> **Observação:** a porta exposta na máquina host é a `5433` (mapeada para a porta interna `5432` do container).

### 4.3. Executar Migrações do Schema

Aplique as migrações declarativas para criar todas as 16 tabelas e ENUMs no PostgreSQL:

```bash
npx prisma migrate dev
```

### 4.4. Popular Dados Iniciais (Seed)

Execute a carga automática de conquistas padrão, missões diárias/semanais e catálogo cosmético da loja:

```bash
npx prisma db seed
```

### 4.5. Interface Gráfica de Inspeção (Prisma Studio)

Inicie o painel web de inspeção do banco de dados:

```bash
npx prisma studio --port 5557
```

Abra o navegador no endereço: [http://localhost:5557](http://localhost:5557)

---

## 5. Resolução de Problemas Comuns (Troubleshooting)

### 5.1. Conflito de Porta 5432

- **Causa:** o sistema operacional possui uma instância de PostgreSQL rodando localmente fora do Docker.
- **Solução:** o arquivo `docker-compose.yml` e o `.env` foram configurados propositalmente na porta externa `5433`. Mantenha a porta `5433` na sua string de conexão `DATABASE_URL`.

### 5.2. Erro de Autenticação ou Conexão Recusada (P1000 / P1012)

- **Causa:** arquivo `.env` inexistente na raiz ou variáveis com sintaxe incorreta.
- **Solução:** verifique se o arquivo `.env` existe na raiz do repositório e se a variável `DATABASE_URL` não contém espaços ou caracteres de shell (`echo`).

### 5.3. Conflito de Nome de Container Docker

- **Causa:** o container `macromaniacs_postgres` já foi criado por outra pasta ou sessão anterior.
- **Solução:** remova o container órfão executando:

```bash
docker rm -f macromaniacs_postgres
docker compose up -d
```

### 5.4. Erro `Unable to process count query undefined` no Prisma Studio

- **Causa:** cache do navegador (IndexedDB) retendo metadados de schemas anteriores ou concorrência de portas.
- **Solução:** abra o Prisma Studio em uma janela anônima (`Cmd + Shift + N`) especificando uma porta alternativa via flag `--port 5557`.

---

## 6. Arquivos e Artefatos de Banco no Repositório

| Caminho | Descrição |
|---|---|
| `prisma/schema.prisma` | Definição declarativa dos modelos, relacionamentos, chaves e índices |
| `prisma/seed.ts` | Script automatizado de carga de dados iniciais |
| `prisma/migrations/` | Histórico físico versionado das migrações DDL |
| `docs/architecture/diagrama.dbml` | Código DBML completo para renderização no dbdiagram.io |
| `infra/docker/docker-compose.yml` | Manifesto de orquestração do container PostgreSQL 15 |
| `.env.example` | Molde de variáveis de ambiente para a equipe |