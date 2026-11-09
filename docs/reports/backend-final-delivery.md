# Entrega final do backend — 09/11/2026

## Status executivo

**TECHNICALLY READY FOR MAIN**. O head final passou os jobs `quality` e
`postgres-15`; as pendências restantes são explicitamente externas e não são
tratadas como aceite de staging, frontend, Produto ou Infra.

- Branch: `integration/backend-completion-2026-11`
- Base consolidada: `integration/presentation-2026-10-26`
- Commit funcional inicial: `51afa10`
- Head de código validado: `6618682`
- Relação com `origin/main` após o gate: 22 commits à frente, 0 atrás
- Produção/Railway: não alterados
- Merge em `main`: não realizado

## Backlog

O GitHub possuía 73 issues abertas e 7 PRs abertas na última consulta. A
classificação abaixo considera critério de aceite, código, testes e dependências
externas; não equivale a fechar as issues antes do merge/revisão.

| Classe | Quantidade | Issues |
| --- | ---: | --- |
| Implementadas tecnicamente | 61 | #4–#16, #18–#20, #22–#66 |
| Parciais ou aguardando evidência | 6 | #17, #21, #68–#71 |
| Bloqueadas externamente | 3 | #67, #72, #82 |
| Sem aplicabilidade como código | 3 | #73–#75 |
| **Total** | **73** | |

Detalhamento das exceções:

- #17/BE-018: contrato e exemplos existem; falta aprovação formal do frontend.
- #21/BE-019: OFF e adapters/testes de USDA/TBCA existem; uso real de USDA
  exige chave válida e TBCA permanece desabilitada até haver API/contrato oficial
  adequado. Nenhum scraping ou segredo foi inventado.
- #58/BE-058: baseline e planos críticos foram medidos no PostgreSQL 15 da CI;
  os nove índices esperados foram confirmados.
- #69/BE-070: a análise reproduzível não encontrou gargalo que justificasse
  mudança de baixo risco; carga HTTP real ainda depende de staging autorizado.
- #68/BE-068: revisão local cobre autorização, CORS, rate limit e secrets; o
  critério original também depende de deploy disponível.
- #70/BE-069: massa sintética, migrations vazia/legada e seed são reproduzíveis;
  a CI real passou, mas a homologação da massa de demo permanece externa.
- #71/BE-072: regressão local passou; o critério exige ambiente final estável.
- #67/BE-066: smoke e release candidate dependem de ambiente implantado e
  checklist assinado.
- #72/BE-071: congelamento/aceite do grupo é decisão humana.
- #82: investigação do preview Railway pertence à Infra.
- #73–#75: plantões de apresentação; existem apenas procedimentos e não uma
  alegação de que a atividade humana ocorreu.

As autorreferências de #45/BE-045 e #50/BE-052 foram corrigidas no planejamento
do tracker, sem reescrever unilateralmente o histórico das issues.

## PRs consolidadas

A branch parte da PR #87 e preserva os commits das seis entregas anteriores:
#80, #86, #81, #83, #84 e #85. Todas eram ancestrais da base escolhida. A nova
entrega deve usar uma PR própria contra `main`; as PRs antigas não devem ser
mescladas novamente sem reconciliação para evitar duplicidade.

## Funcionalidades disponíveis

- Identidade: cadastro transacional, perfil inicial, aceite versionado de
  termos, login JWT, sessão, onboarding, medidas, TMB/TDEE, ownership e papéis.
- Foods: catálogo local, manual, busca/detalhe/barcode, OFF, adapter USDA,
  TBCA seguro/desabilitado, cache, deduplicação, timeout, retry e circuit breaker.
- Nutrição: planos, ativação serializada, horários locais, itens e totais;
  consumo manual/check-in atômico, idempotência, snapshots e exclusão lógica.
- Progresso: data alimentar/timezone IANA, totais, metas, histórico e
  reprocessamento idempotente.
- Gamificação: outbox, streak, missões, conquistas, antifarming, regras
  versionadas, ledger imutável e saldo reconciliável.
- Social: grupos privados, convite, papéis, isolamento, feed, posts automáticos,
  reações e ranking derivado do saldo real.
- Recompensas: catálogo, inventário, saldo, compra atômica/idempotente,
  concorrência, saldo insuficiente e equipamento exclusivo por tipo.
- Plataforma: erros/correlation ID, headers seguros, CORS, rate limit geral e
  de login, CI, PostgreSQL 15, cobertura, auditoria e documentação operacional.

## Endpoints

São 54 operações HTTP documentadas no Swagger e no inventário consolidado:

| Área | Operações |
| --- | ---: |
| Health/readiness | 2 |
| Auth | 3 |
| Users/perfil | 3 |
| Foods | 4 |
| Planos e refeições planejadas | 12 |
| Refeições consumidas | 6 |
| Progresso | 3 |
| Gamificação | 5 |
| Social/grupos | 11 |
| Recompensas | 5 |
| **Total** | **54** |

Rotas, bodies e headers estão em
[`../api/backend-completion.md`](../api/backend-completion.md); tipos e respostas
canônicas são publicados em `/docs` e `/docs-json` no ambiente de desenvolvimento.

## Testes e qualidade

Gate local executado em Node 24.16.0/npm 11.13.0:

| Verificação | Resultado |
| --- | --- |
| Formatação | Aprovada |
| Lint | Aprovado |
| Typecheck | Aprovado |
| Build | Aprovado |
| DBML | 26 tabelas, 11 enums, 66 índices/PKs, 31 FKs e 60 CHECKs |
| Jest com coverage | 23 suítes, 127 testes, todos aprovados |
| Cobertura | 81,81% statements; 68,45% branches; 75,67% functions; 82,54% lines |
| Audit de produção | 0 vulnerabilidades altas/críticas |
| Whitespace/segredos | Diff limpo; scan local sem padrões de credenciais |
| PostgreSQL 15 real | 9/9 casos aprovados no head `6618682` |
| GitHub Actions | `quality` e `postgres-15` aprovados |

Os E2E cobrem fluxos positivos/negativos, isolamento entre usuários, retries,
rollback, timezone, pontuação, feed, ranking, compra e equipamento. O job real
valida migrations a partir de banco vazio e legado, schema, SQL de integridade,
precisão, locks pessimistas, compra concorrente e planos de performance sobre
massa sintética.

## Banco e migrations

A baseline `1789430400000-DefinitiveBaseline` permanece imutável. A migration
aditiva `1794096000000-BackendCompletionCore` cria as três estruturas novas e
acrescenta colunas/índices/triggers compatíveis. `synchronize` e `migrationsRun`
continuam falsos. Nenhuma migration foi executada em banco compartilhado.

O DBML e o snapshot físico esperado foram elevados de 23 para 26 tabelas. O
preflight aceita tanto o legado Prisma alinhado quanto a baseline TypeORM e
recusa históricos desconhecidos ou schema divergente.

## Segurança

- Hash de senha e JWT sem serialização de segredo.
- Mensagem genérica de credencial inválida e limite de login configurável.
- Guards obrigatório/opcional, ownership e papel administrativo testados.
- Grupos, refeições, planos, progresso, inventário e compras isolam o usuário.
- Ledger rejeita update/delete direto e aceita apenas cascade legítimo.
- Erros 5xx não expõem stack; logs não incluem payload/token.
- CORS, headers e `TRUST_PROXY` têm defaults seguros e configuração explícita.
- O rate limit em memória é por processo; escala horizontal exige contador
  compartilhado antes de produção.

## Performance

A CI semeia, dentro de transação descartável, 2.000 snapshots e 5.000 linhas
em refeições, feed, ledger e alimentos. Ela registra `EXPLAIN ANALYZE` para os
hot paths e confirma nove índices críticos. O harness `npm run perf:smoke`
produz p50/p95/máximo em staging mediante URL/token explícitos.

Na execução aprovada, os tempos de execução observados foram 0,027 ms para
histórico nutricional, 0,022 ms para refeições, 0,027 ms para feed, 0,017 ms
para ledger e 0,014 ms para barcode. São uma baseline do runner descartável,
não um SLO de produção.

A busca local por nome mantém substring (`LIKE %termo%`), que pode fazer scan
sequencial em catálogo grande. `pg_trgm` ou alteração para prefixo/full text
deve ser aprovada e medida no PostgreSQL gerenciado; não foi introduzida uma
extensão operacional sem validação do ambiente.

## Limitações e decisões a ratificar

- Valores de pontos `2026-11-v1` são proposta conservadora de Produto.
- Timezone default é `UTC`; horários planejados são wall-clock no IANA timezone
  do usuário.
- Processamento do outbox é oportunístico/idempotente; um worker dedicado pode
  substituí-lo sem mudar o contrato persistido.
- Integrações USDA/TBCA reais, frontend, staging, Railway, carga e deploy são
  externos a esta branch.
- O Docker Desktop local permaneceu indisponível; a evidência real foi produzida
  no PostgreSQL 15 descartável da CI, sem fallback para mock.

## Integração frontend

O guia React, exemplos e OpenAPI estão atualizados, mas #17 só pode ser encerrada
após o frontend confirmar o contrato e substituir seus mocks. Não existe aceite
humano implícito neste relatório.

## Prontidão para `main`

Status atual: **TECHNICALLY READY FOR MAIN**.

Evidências técnicas satisfeitas:

1. CI `quality` e `postgres-15` verdes no head final da PR.
2. PR #88 mergeável e branch 0 commits atrás da `main`.
3. Gate local, migrations, SQL, concorrência, performance, cobertura e audit
   aprovados.
4. Pendências externas identificadas sem alegação de aceite.

Antes do merge, a PR deve ser revisada e mesclada por uma pessoa, que também
deve confirmar a ausência de deploy automático indesejado. Esta
execução não faz merge na `main`, não promove produção e não encerra issues que
dependem do merge ou de validação humana.
