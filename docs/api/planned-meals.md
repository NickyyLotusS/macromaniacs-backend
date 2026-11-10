# Refeições planejadas

Todas as rotas exigem `Authorization: Bearer <token>` e validam o plano pelo
`userId` do JWT. Recursos de outro usuário respondem como não encontrados.

## Refeições

- `GET /v1/diet-plans/{planId}/meals` retorna refeições ordenadas, itens,
  totais por refeição e o total previsto do plano.
- `POST /v1/diet-plans/{planId}/meals` cria uma refeição com `name`,
  `orderIndex` único no plano e metas nutricionais opcionais.
- `PATCH /v1/diet-plans/{planId}/meals/{mealId}` altera os mesmos campos.
- `DELETE /v1/diet-plans/{planId}/meals/{mealId}` remove a refeição e seus
  itens pelo `ON DELETE CASCADE` do schema canônico.

## Itens e snapshots

- `POST /v1/diet-plans/{planId}/meals/{mealId}/items` recebe `foodId` e
  `amountGrams`.
- `PATCH /v1/diet-plans/{planId}/meals/{mealId}/items/{itemId}` troca o
  alimento e/ou a quantidade e gera um novo snapshot.
- `DELETE /v1/diet-plans/{planId}/meals/{mealId}/items/{itemId}` remove o item.

Calorias e macros são calculados a partir dos valores por 100 g do alimento,
com arredondamento decimal para duas casas e validação contra a capacidade das
colunas. O snapshot não muda quando o cadastro do alimento é editado. Os totais
são derivados dos itens existentes, portanto refletem inclusões, alterações e
remoções sem armazenar somas redundantes.

## Lacuna de horário

A descrição da BE-028 cita horários, mas a baseline definitiva e as entidades
canônicas modelam apenas `order_index`. Nenhum campo de horário foi inventado:
isso exige definição de produto (horário obrigatório ou opcional, precisão e
relação com timezone) e uma alteração de schema revisada.
