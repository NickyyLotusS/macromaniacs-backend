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

Erros possuem `statusCode`, `error`, `message`, `timestamp` e `path`. Respostas
`500` nunca expõem stack trace, SQL ou detalhes internos do ORM.

- `400 Bad Request`: payload inválido ou propriedade inesperada.
- `401 Unauthorized`: credenciais, token ou autenticação ausente.
- `403 Forbidden`: identidade válida sem permissão suficiente.
- `404 Not Found`: recurso inexistente.
- `409 Conflict`: violação de unicidade ou conflito de estado.

O login sempre responde `Invalid credentials` para usuário inexistente ou senha
incorreta.

## Paginação

Quando endpoints de listagem forem adicionados, usarão `page` e `limit`, com
limite máximo validado. A resposta deverá separar os itens de metadados:

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
