# Auditoria do backlog — 18/10/2026

## Escopo e evidências

Auditoria feita sobre `main` (`be0e905`) e o único PR aberto, [#80](https://github.com/NickyyLotusS/macromaniacs-backend/pull/80). A `main` continha a fundação NestJS, health/readiness e a integração TypeORM definitiva. Os demais diretórios de negócio eram placeholders. O PR #80 continha autenticação e onboarding, mas partia de antes da integração definitiva do banco, duplicava entidades e migrations e não era mesclável.

Este lote reconcilia o PR com a baseline oficial, sem `synchronize`, sem migration automática e sem alteração destrutiva de schema. As classificações “implementada” abaixo consideram o código deste PR e só devem virar encerramento das issues depois de revisão/merge.

## Classificação

| Issue | Tarefa | Estado | Evidência ou pendência |
| --- | --- | --- | --- |
| #1 | BE-002 | IMPLEMENTADA | ADR, README e limites modulares já integrados. |
| #2 | BE-001 | IMPLEMENTADA | NestJS, health e build já integrados. |
| #3 | BE-003 | IMPLEMENTADA | TypeORM, baseline, comandos e safeguards já integrados. |
| #4 | BE-004 | IMPLEMENTADA | Swagger em desenvolvimento, health/readiness documentados e convenções em `docs/api`. |
| #5 | BE-005 | IMPLEMENTADA | `ValidationPipe` global com transformação, whitelist e rejeição de extras; E2E cobre 400. |
| #6 | BE-007 | PARCIAL | JWT e `CurrentUser` implementados; ainda faltam contratos genéricos de papel, ownership e autenticação opcional. |
| #7 | BE-008 | IMPLEMENTADA | Contrato global de erro, 5xx genérico e correlation ID cobertos por E2E. |
| #8 | BE-006 | IMPLEMENTADA | Scripts de qualidade, health test, E2E e checklist de PR disponíveis. |
| #9 | BE-010 | PARCIAL | DTOs/metadados e validação existem; Swagger completo depende do primeiro endpoint paginado. |
| #10 | BE-009 | IMPLEMENTADA | Correlation ID e log JSON de método, rota, status e duração, sem payload/headers sensíveis. |
| #11 | BE-012 | IMPLEMENTADA | Schema de ambiente, falha rápida, `.env.example` e testes. |
| #12 | BE-011 | IMPLEMENTADA | E2E usa PostgreSQL em memória isolado; integração real exige servidor explicitamente separado. |
| #13 | BE-015 | IMPLEMENTADA | `GET/PATCH /v1/users/me`, ownership pelo JWT, patch validado e Swagger. |
| #14 | BE-013 | PARCIAL | Hash, validação, aceite obrigatório e conflitos 409 estão prontos. O schema canônico define perfil ausente como onboarding pendente; não existe linha de “perfil vazio”, e o aceite ainda não possui coluna de auditoria. |
| #15 | BE-014 | IMPLEMENTADA | Login, JWT configurável, erro genérico e `GET /v1/auth/me` protegido. |
| #16 | BE-016 | IMPLEMENTADA | Perfil corporal, medição atual/histórico e validações cobertos por E2E. |
| #17 | BE-018 | VALIDAÇÃO | Contrato e exemplos estão publicados; falta aprovação humana do frontend. |
| #18–#32 | BE-019 a BE-031 | PENDENTE | Providers, alimentos, planos, refeições e recálculo ainda não possuem módulos funcionais. |
| #33 | BE-033 | IMPLEMENTADA | Mifflin–St Jeor, unidades, limites e casos de referência documentados/testados. |
| #34 | BE-032 | PENDENTE | Snapshot nutricional diário ainda não é persistido; `user_stats` atual é de gamificação. |
| #32, #35–#36 | BE-034 a BE-036 | BLOQUEADA | Contadores/progresso dependem de refeições e de uma definição de timezone do usuário. |
| #37–#39, #41–#42 | BE-037 a BE-039, BE-041, BE-042 | PENDENTE | Streak, eventos, ledger e E2E de gamificação não implementados. |
| #40 | BE-040 | BLOQUEADA | Regras e limites de pontuação exigem decisão de produto. |
| #43–#48 | BE-043 a BE-048 | PENDENTE | Grupos, ranking e feed ainda são placeholders. |
| #49–#54 | BE-049 a BE-054 | PENDENTE | Loja, inventário, saldo, compra e equipamento ainda não implementados. |
| #55, #57, #59 | BE-055, BE-057, BE-059 | VALIDAÇÃO | Dependem dos módulos e de staging. |
| #56, #60–#62, #65–#66 | BE-056, BE-060, BE-062 a BE-063, BE-067 | PENDENTE | Auditorias finais dependem da implementação funcional anterior. |
| #58 | BE-058 | VALIDAÇÃO | Exige volume de dados e análise de plano no PostgreSQL. |
| #63 | BE-061 | BLOQUEADA | Falta política de rate limiting definida com Infra. |
| #64 | BE-065 | BLOQUEADA | Depende da lista de defeitos gerada pelos E2E. |
| #67–#68, #70–#71 | BE-066, BE-068, BE-069, BE-072 | VALIDAÇÃO | Exigem deploy/homologação, massa final e evidências externas. |
| #69 | BE-070 | BLOQUEADA | Exige baseline de carga e gargalos medidos. |
| #72 | BE-071 | BLOQUEADA | Depende dos bugs finais e do aceite do grupo. |
| #73–#75 | BE-073 a BE-075 | VALIDAÇÃO | Atividades de plantão/apresentação, sem código novo. |

## Inconsistências encontradas

1. O PR #80 usava entidades e duas migrations paralelas às 23 entidades e à baseline TypeORM já integrada; essa duplicação foi removida na reconciliação.
2. BE-013 pede criação de “perfil inicial”, enquanto o contrato físico e o DBML dizem que a ausência de `user_profiles` representa onboarding pendente e que uma linha presente deve conter todos os dados metabólicos. O código segue o schema canônico e cria o perfil completo no onboarding.
3. BE-032 chama o destino de snapshots de `user_stats`, mas a tabela canônica `user_stats` armazena streak e pontos. É necessária decisão de modelagem/migration antes de persistir métricas nutricionais diárias.
4. #45/BE-045 declara dependência de BE-045 (auto-dependência); a dependência provável é o fluxo de eventos/feed anterior e deve ser corrigida no backlog.
5. #50/BE-052 declara intervalo “BE-049 a BE-052”, incluindo a própria tarefa; deve apontar apenas para as implementações anteriores da loja.
6. Os diretórios de Foods, Meals, Gamificação, Social e Recompensas existiam, mas continham somente `.gitkeep`; isso não comprova implementação.

## Ordem recomendada por dependência

1. Mesclar este lote; concluir BE-007, expor paginação no primeiro recurso e decidir as duas lacunas de BE-013.
2. Foods: BE-019 → BE-021 → BE-020 → BE-022 → BE-023 → BE-024.
3. Refeições/planos: BE-025 → BE-026 e BE-027 → BE-028 → BE-029 → BE-030.
4. Progresso: BE-031 → decisão de schema para BE-032 → decisão de timezone → BE-034 → BE-035 → BE-036.
5. Gamificação: BE-037/BE-039 → decisão de BE-040 → BE-038/BE-041 → BE-042.
6. Social: BE-043 → BE-047 → BE-044/BE-048 → BE-045 → BE-046.
7. Recompensas: BE-053 → BE-049/BE-051 → BE-054 → BE-050 → BE-052.
8. Segurança, E2E, performance e release somente após os fluxos anteriores.

## Impedimentos externos

- Aprovação do contrato de identidade pelo frontend (BE-018).
- Decisão de persistência do aceite de termos e confirmação da semântica de “perfil inicial” (BE-013).
- Schema separado para snapshots nutricionais (BE-032).
- Timezone do usuário (BE-034), regras de pontuação (BE-040) e política de rate limiting (BE-061).
- Staging, credenciais de provedores, massa representativa e resultados de carga para as etapas de validação.

## Segurança de dependências

As dependências NestJS compatíveis foram atualizadas dentro das faixas já
declaradas e `proxy-addr` foi corrigido para 2.0.8. `npm audit --omit=dev`
termina sem vulnerabilidades. Alertas restantes estão apenas no toolchain de
desenvolvimento e exigem revisão separada, sem `--force` ou downgrade de
ferramentas.
