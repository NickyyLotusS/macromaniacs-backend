# Planos alimentares

Todas as rotas exigem `Authorization: Bearer <token>` e operam somente sobre os
planos do usuário autenticado.

## Ciclo de vida

- `POST /v1/diet-plans` cria um plano em `DRAFT`.
- `GET /v1/diet-plans` lista o histórico com paginação, filtro de status e
  ordenação limitada a campos documentados.
- `GET /v1/diet-plans/{id}` consulta um plano próprio.
- `PATCH /v1/diet-plans/{id}` altera título, metas e período; o status não pode
  ser alterado por esse payload.
- `POST /v1/diet-plans/{id}/activate` ativa o plano em transação e arquiva o
  plano anteriormente ativo do mesmo usuário.

Planos arquivados não são apagados. Um ID pertencente a outro usuário responde
como não encontrado, evitando exposição de existência. Datas usam `YYYY-MM-DD`;
metas decimais respeitam a precisão `NUMERIC(6,2)` do schema canônico.
