# Convenções da API

## Versionamento

Endpoints de negócio usam versionamento por URI, com a versão entre o host e o
recurso: `/v1/auth/register`. Endpoints operacionais, como `/health`, são
neutros e não recebem prefixo de versão.

## Recursos e rotas

- Recursos usam substantivos minúsculos e caminhos em inglês.
- Ações seguem o método HTTP sempre que possível.
- Cadastro e login ficam sob o recurso `auth` por representarem operações de
  identidade, e a sessão atual é exposta em `GET /v1/auth/me`.
- Rotas protegidas usam `Authorization: Bearer <token>`.

## Autenticação e autorização

- `JwtAuthGuard` exige JWT válido e anexa `userId` (e claims de papéis válidas,
  quando existirem) à requisição.
- `OptionalJwtAuthGuard` permite requisição sem credencial, mas rejeita um header
  `Authorization` enviado com token inválido; não transforma token inválido em
  acesso anônimo.
- `@Roles(...)` com `RolesGuard` aceita qualquer um dos papéis declarados e
  responde `403` quando a identidade não possui permissão.
- `@OwnerParam('userId')` com `OwnershipGuard` protege rotas cujo identificador
  do proprietário está no path. Recursos identificados por outro ID continuam
  validando ownership na consulta de domínio, filtrada pelo `userId` do JWT.
- Os decorators apenas publicam metadados; módulos de negócio não precisam
  conhecer parsing ou verificação de JWT.

## Payloads e DTOs

- Payloads JSON usam `camelCase`.
- DTOs rejeitam propriedades não declaradas.
- E-mails e usernames são normalizados para minúsculas antes da persistência.
- Senhas só aparecem em DTOs de entrada e nunca em respostas.

## Status de sucesso

- `200 OK`: leitura ou operação concluída.
- `201 Created`: recurso criado.
- `204 No Content`: operação concluída sem corpo de resposta, quando aplicável.

## Erros

Erros possuem `statusCode`, `error`, `message`, `timestamp`, `path` e
`correlationId`. Respostas `500` nunca expõem stack trace, SQL ou detalhes
internos do ORM.

- `400 Bad Request`: payload inválido ou propriedade inesperada.
- `401 Unauthorized`: credenciais, token ou autenticação ausente.
- `403 Forbidden`: identidade válida sem permissão suficiente.
- `404 Not Found`: recurso inexistente.
- `409 Conflict`: violação de unicidade ou conflito de estado.

O login sempre responde `Invalid credentials` para usuário inexistente ou senha
incorreta.

## Rastreabilidade e logs

Toda resposta inclui o header `X-Correlation-Id`. Um identificador recebido é
reutilizado apenas quando contém caracteres seguros e tem no máximo 128
caracteres; caso contrário, a API gera um UUID. Logs HTTP são JSON e registram
somente correlation ID, método, rota, status e duração. Payloads, senhas, tokens
e headers de autenticação não são registrados.

## Paginação

Endpoints de listagem usarão `page` (padrão 1), `limit` (padrão 20, máximo 100),
`sortBy` e `sortDirection` (`asc` ou `desc`). Cada recurso limita explicitamente
os campos aceitos em `sortBy`. A resposta separa os itens de metadados:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

## Swagger

Swagger é publicado somente em `APP_ENV=development`, em `/docs`. Endpoints
protegidos declaram o esquema Bearer `access-token`. Schemas de resposta nunca
incluem `password`, `passwordHash` ou qualquer hash de credencial.
