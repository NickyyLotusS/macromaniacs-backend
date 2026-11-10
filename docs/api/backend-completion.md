# Contrato funcional consolidado

Base local: `http://localhost:3000/v1`. Rotas marcadas como autenticadas usam
`Authorization: Bearer <accessToken>`. O Swagger em `/docs` é a fonte de tipos,
validações e respostas de erro completa.

## Identidade e perfil

| Método e rota | Uso | Exemplo de corpo |
| --- | --- | --- |
| `POST /auth/register` | Cadastro, perfil inicial e aceite versionado | `{"email":"ana@example.com","username":"ana_01","password":"senha-forte-123","termsAccepted":true}` |
| `POST /auth/login` | JWT | `{"identifier":"ana_01","password":"senha-forte-123"}` |
| `GET /auth/me` | Sessão autenticada | sem corpo |
| `GET /users/me` | Perfil e métricas | sem corpo |
| `PATCH /users/me` | Onboarding/edição | `{"displayName":"Ana","birthDate":"1995-04-20","biologicalSex":"FEMALE","heightCm":165,"currentWeightKg":62,"goal":"MAINTENANCE","activityLevel":"MODERATE","timezone":"America/Sao_Paulo"}` |
| `GET /users/me/measurements` | Histórico de medidas | sem corpo |

## Alimentos, planos, consumo e progresso

| Método e rota | Uso | Exemplo |
| --- | --- | --- |
| `GET /foods?q=arroz&page=1&limit=20&external=true` | Busca local com fallback configurado | sem corpo |
| `GET /foods/barcode/7891234567890` | Barcode e cache | sem corpo |
| `GET /foods/{id}` | Detalhe canônico | sem corpo |
| `POST /foods/manual` | Alimento manual autenticado | `{"name":"Arroz","caloriesPer100g":124,"proteinPer100g":2.6,"carbsPer100g":25.8,"fatPer100g":1,"fiberPer100g":2.7,"servingSizeG":100}` |
| `POST /diet-plans` | Plano em rascunho | `{"title":"Manutenção","targetCalories":2200,"targetProtein":150,"targetCarbs":250,"targetFat":70}` |
| `GET /diet-plans` | Planos paginados | query `page`, `limit`, `status` |
| `GET /diet-plans/{id}` | Detalhe próprio | sem corpo |
| `PATCH /diet-plans/{id}` | Atualização própria | qualquer subconjunto validado do cadastro |
| `POST /diet-plans/{id}/activate` | Ativação serializada | sem corpo |
| `GET /diet-plans/{planId}/meals` | Refeições e totais planejados | sem corpo |
| `POST /diet-plans/{planId}/meals` | Refeição planejada | `{"name":"Almoço","orderIndex":1,"scheduledTime":"12:30"}` |
| `PATCH/DELETE /diet-plans/{planId}/meals/{mealId}` | Editar/remover | patch parcial ou sem corpo |
| `POST /diet-plans/{planId}/meals/{mealId}/items` | Item e snapshot | `{"foodId":"<uuid>","amountGrams":150}` |
| `PATCH/DELETE /diet-plans/{planId}/meals/{mealId}/items/{itemId}` | Editar/remover item | `{"amountGrams":200}` ou sem corpo |
| `POST /meals/manual` | Consumo transacional | header `Idempotency-Key`; `{"name":"Almoço","consumedAt":"2026-11-09T15:00:00Z","items":[{"foodId":"<uuid>","amountGrams":150}]}` |
| `POST /meals/check-in` | Check-in planejado | header `Idempotency-Key`; `{"plannedMealId":"<uuid>","consumedAt":"2026-11-09T15:00:00Z"}` |
| `GET /meals` | Histórico próprio | query `from`, `to`, `page`, `limit` |
| `GET/PATCH/DELETE /meals/{id}` | Detalhe, edição, exclusão lógica | patch parcial ou sem corpo |
| `GET /progress/daily?date=2026-11-09` | Snapshot diário versus meta | sem corpo |
| `GET /progress/history?from=2026-11-01&to=2026-11-30` | Histórico paginado | sem corpo |
| `POST /progress/reprocess?date=2026-11-09` | Reprocessamento idempotente | sem corpo |

## Gamificação, social e recompensas

| Método e rota | Uso | Exemplo |
| --- | --- | --- |
| `GET /gamification/summary` | Streak e saldo reconciliado | sem corpo |
| `GET /gamification/ledger` | Ledger paginado | query `page`, `limit` |
| `GET /gamification/achievements` | Conquistas desbloqueadas | sem corpo |
| `GET /gamification/missions?date=2026-11-09` | Missões do dia | sem corpo |
| `POST /gamification/reprocess` | Consumir outbox pendente | sem corpo |
| `POST /groups` | Grupo + administrador atômicos | `{"name":"Equipe Macro","isPrivate":true}` |
| `GET /groups` / `GET /groups/{groupId}` | Grupos próprios/detalhe | sem corpo |
| `POST /groups/join` | Entrada por convite | `{"inviteCode":"A1B2C3D4"}` |
| `DELETE /groups/{groupId}/members/me` | Saída (não permite admin sem transferência) | sem corpo |
| `PATCH /groups/{groupId}/members/{userId}` | Papel, somente admin | `{"role":"ADMIN"}` |
| `POST /groups/{groupId}/feed` | Post próprio | `{"content":"Vamos manter o foco!"}` ou `{"mealLogId":"<uuid>"}` |
| `GET /groups/{groupId}/feed` | Feed paginado privado | query `page`, `limit` |
| `PUT /groups/{groupId}/feed/{postId}/reaction` | Criar/trocar reação | `{"reactionType":"FIRE"}` |
| `DELETE /groups/{groupId}/feed/{postId}/reaction` | Remover reação própria | sem corpo |
| `GET /groups/{groupId}/ranking` | Ranking pelo saldo real | sem corpo |
| `GET /rewards/catalog` | Catálogo público ativo | sem corpo |
| `GET /rewards/balance` / `GET /rewards/inventory` | Saldo/inventário próprios | sem corpo |
| `POST /rewards/purchases/{itemId}` | Compra atômica | header `Idempotency-Key` |
| `PUT /rewards/inventory/{itemId}/equip` | Equipar, exclusivo por tipo | sem corpo |

Criações idempotentes devolvem o recurso original quando a mesma chave e ação
são repetidas. Reutilizar a chave de compra para outro item retorna `409`.
