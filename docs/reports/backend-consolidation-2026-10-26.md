# Consolidação do backend para apresentação — 26/10/2026

## Resumo executivo

Auditoria realizada em 25/10/2026 sobre a `main` remota no commit `be0e905` e
as PRs abertas #80, #81, #83, #84, #85 e #86.

- As seis PRs estão abertas e o GitHub as classifica individualmente como
  mergeáveis.
- A integração das seis foi simulada, na ordem solicitada, na branch local
  `integration/presentation-2026-10-26`, usando commits de merge e preservando
  todo o histórico.
- A simulação integrou seis PRs; nenhuma delas foi efetivamente mesclada na
  `main`.
- O conjunto integrado compila e passa em 17 suites/112 testes.
- O projeto **não está concluído**: providers externos, consumo/check-in de
  refeições, progresso, gamificação, social e recompensas permanecem fora da
  `main` ou não implementados.

## 1. Arquitetura atual do backend

O backend é um monolito modular NestJS com os seguintes limites:

- `src/modules`: módulos de negócio (`auth`, `users`, `food-products`,
  `diet-plans` e `health` no conjunto integrado).
- `src/integrations`: TypeORM, entidades canônicas, repositórios e futuros
  adapters externos.
- `src/shared`: configuração, segurança, paginação, erros e observabilidade.
- PostgreSQL com TypeORM, `synchronize: false`, migrations automáticas
  desabilitadas e uma baseline definitiva.
- 23 tabelas, 11 enums, 55 índices/PKs, 29 FKs e 50 checks validados contra o
  DBML.
- API versionada em `/v1`, Swagger em desenvolvimento, JWT Bearer, validação
  global e erros com correlation ID.

Topologia das PRs antes do merge:

```text
main
└── #80 identidade/onboarding
    ├── #86 autorização base
    ├── #81 provider pattern
    │   └── #83 cache/catálogo de alimentos
    └── #84 planos alimentares
        └── #85 refeições planejadas
```

## 2. Funcionalidades presentes na `main`

A `main` em `be0e905` contém:

- bootstrap NestJS e organização do monolito modular;
- health/liveness e readiness do PostgreSQL;
- integração TypeORM e entidades para as 23 tabelas do domínio;
- baseline SQL, validação de drift/DBML, scripts de backup e safeguards;
- documentação arquitetural do banco.

A `main` ainda **não contém** os endpoints funcionais de Auth, Users, Foods,
Diet Plans ou Planned Meals. Esses recursos permanecem somente nas PRs.

## 3. Funcionalidades desenvolvidas nas PRs

| PR | Dependência | Entrega | Avaliação |
| --- | --- | --- | --- |
| #80 | `main` | Swagger, validação, erros/logs, Auth, Users, onboarding, medidas e TMB/TDEE | Pronta com ressalvas de BE-013/BE-018 e status externo do Railway |
| #86 | #80 | JWT opcional, papéis, ownership e decorators | Pronta; contratos existem, mas ainda não há rota de negócio baseada em papel global |
| #81 | #80 | Contrato de providers e normalização nutricional decimal | Pronta; adapters HTTP pertencem a BE-019 |
| #83 | #81 | Repositório/cache local e cadastro manual de alimentos | Pronta; busca/barcode HTTP pertence a BE-023 |
| #84 | #80 | CRUD, paginação e ativação transacional de planos | Pronta; concorrência real deve ser validada em PostgreSQL |
| #85 | #84 | CRUD de refeições/itens, snapshots e totais planejados | Parcial para BE-028: falta modelagem de horário no schema |

## 4. Quantidade de PRs integradas e pendentes

- Integradas na simulação local: **6 de 6**.
- Mescladas na `main` do GitHub: **0 de 6**.
- Abertas e pendentes de revisão/merge: **6 de 6**.
- Reviews submetidos: nenhum.
- Review threads abertas: nenhuma.
- GitHub Actions associado aos heads: nenhum workflow encontrado.
- Status externo: o preview Railway da #80 está em `failure`; registrado na
  issue #82 para Infra e não investigado/alterado nesta consolidação.

## 5. Testes e validações executados

| Validação | Resultado |
| --- | --- |
| `npm run format` | Aprovado; aplicou apenas formatação mecânica em um import do repositório Foods |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm run build` | Aprovado |
| `npm test -- --runInBand` | 17 suites, 112 testes, todos aprovados |
| `npm run test` | 17 suites, 112 testes, todos aprovados |
| `npm run docs` | Inicialmente inexistente; alias seguro para `docs:dbml` adicionado e aprovado |
| `npm audit --omit=dev` | Inicialmente 4 vulnerabilidades altas; overrides não breaking para `body-parser@2.4.0` e `multer@2.5.0` reduziram para 0 em produção |
| `git diff --check` | Aprovado |
| PostgreSQL real isolado | Não executado: Docker Desktop indisponível e `POSTGRES_PASSWORD` local ausente |

Os testes E2E disponíveis usam PostgreSQL em memória com `synchronize: false`.
Eles são isolados e repetíveis, mas não substituem uma execução contra PostgreSQL
real para locks, enums, precisão numérica e comportamento transacional.

## 6. Principais problemas técnicos resolvidos

- Reconciliação da PR #80 com a baseline TypeORM, eliminando entidades e
  migrations paralelas.
- Autenticação JWT, hash scrypt, resposta genérica para login inválido e
  serialização sem senha/hash.
- Ownership aplicado por `userId` nas consultas de perfil, planos e refeições.
- Guard opcional não transforma token inválido em acesso anônimo.
- Normalização e cálculos nutricionais com aritmética decimal e snapshots.
- Cache de alimentos com tratamento de unicidade e cadastro manual validado.
- Ativação de plano com transação e `pessimistic_write`, preservando histórico.
- Totais planejados derivados dos itens, sem soma redundante persistida.
- Vulnerabilidades de produção encontradas durante a consolidação corrigidas
  sem `--force` e sem mudança de major.

### Conflitos encontrados na integração

1. Ao integrar #84 após #83, `README.md` e `src/app.setup.ts` conflitavam.
   Decisão: preservar simultaneamente os endpoints e tags Swagger de Foods e
   Diet Plans.
2. Ao integrar #85, `docs/backlog-audit.md` conflitava com as atualizações de
   #83/#86. Decisão: manter a classificação granular dos dois stacks, marcar
   BE-010 como implementada após o endpoint paginado de #84 e preservar as
   pendências de providers/horário.
3. `npm run docs` não existia. Decisão: adicionar alias para o verificador DBML
   já existente, sem criar uma nova cadeia documental.

### Duplicações e compatibilidade

- Não foram encontradas entidades, módulos ou migrations duplicados no conjunto
  final.
- `AppModule` carrega Auth, Users, Foods e Diet Plans sem colisão de providers.
- Há duas rotinas de aritmética decimal: normalização de provider e cálculo de
  snapshot planejado. Elas são compatíveis, mas podem compartilhar uma utility
  futura para reduzir manutenção.
- Os bancos E2E são instâncias separadas por suite; helpers com schemas
  sobrepostos não compartilham estado.

## 7. Issues e funcionalidades ainda não implementadas

### Já presentes na `main`

- #1/BE-002, #2/BE-001 e #3/BE-003.

### Implementadas nas PRs e elegíveis para encerramento após os merges

- #4/BE-004, #5/BE-005, #6/BE-007, #7/BE-008, #8/BE-006,
  #9/BE-010, #10/BE-009, #11/BE-012 e #12/BE-011.
- #13/BE-015, #15/BE-014, #16/BE-016 e #20/BE-017.
- #19/BE-021, #22/BE-022, #27/BE-027 e #33/BE-033.

Essas issues não devem ser encerradas antes de os commits correspondentes
chegarem à `main` e as verificações obrigatórias passarem.

### Parciais ou aguardando aceite

- #14/BE-013: cadastro seguro pronto, mas o aceite de termos não possui coluna
  de auditoria e a semântica de “perfil inicial” diverge do schema canônico.
- #17/BE-018: contratos e exemplos existem; falta aceite humano do frontend.
- #28/BE-028: CRUD, itens e totais prontos; falta definição/persistência de
  horário.
- #55/BE-055, #57/BE-057, #58/BE-058, #59/BE-059, #67/BE-066,
  #68/BE-068, #70/BE-069 e #71/BE-072 dependem de ambiente, massa, carga ou
  validação final.
- #73/BE-075, #74/BE-073 e #75/BE-074 são atividades de apresentação/plantão.

### Pendentes

- #18/BE-020, #23/BE-025, #24/BE-024, #25/BE-026, #26/BE-023,
  #29/BE-029, #30/BE-030 e #31/BE-031.
- #34/BE-032, #37/BE-037, #38/BE-039, #39/BE-041 e #41/BE-038.
- #42/BE-042 a #54/BE-054, cobrindo gamificação, social e recompensas.
- #56/BE-056, #60/BE-060, #61/BE-062, #62/BE-064,
  #65/BE-063 e #66/BE-067.

### Bloqueadas por decisão ou dependência externa

- #21/BE-019: contrato estável da TBCA e credencial USDA.
- #32/BE-034, #35/BE-035 e #36/BE-036: progresso diário/timezone e snapshots.
- #40/BE-040: regras de pontuação.
- #63/BE-061: política de rate limiting.
- #64/BE-065: lista de defeitos produzida pelos E2E finais.
- #69/BE-070: baseline de carga e gargalos medidos.
- #72/BE-071: bugs finais e aceite do grupo.
- #82/Infra: diagnóstico do preview provisório Railway.

## 8. Próximos passos

1. Obter revisão humana e confirmar política de checks obrigatórios.
2. Executar o conjunto integrado contra PostgreSQL real e isolado.
3. Mesclar as PRs na ordem do checklist abaixo, retargetando cada PR empilhada
   para `main` somente depois de a dependência anterior chegar à `main`.
4. Aplicar nas branches #84/#85 as resoluções já comprovadas nesta simulação.
5. Reexecutar lint, typecheck, build, testes, docs e audit após cada retarget.
6. Para a apresentação, demonstrar apenas health, autenticação/perfil, cadastro
   manual de alimento, planos e refeições planejadas; não apresentar busca
   externa, consumo, progresso ou recursos sociais como concluídos.

## Checklist de merges seguros

- [ ] Aprovar #80; decidir se o status Railway é obrigatório na proteção da
  branch. Não alterar o Railway durante o merge.
- [ ] Mesclar #80 em `main`.
- [ ] Retargetar #86 para `main`, atualizar sem rebase/force-push, validar e
  mesclar.
- [ ] Retargetar #81 para `main`, validar e mesclar.
- [ ] Retargetar #83 para `main`, validar e mesclar.
- [ ] Mesclar a `main` atualizada em #84, preservando Foods + Diet Plans em
  `README.md`, `AppModule` e Swagger; retargetar #84 para `main`, validar e
  mesclar.
- [ ] Mesclar a `main` atualizada em #85, preservar a auditoria consolidada do
  backlog e a correção CORS para `DELETE`; retargetar #85 para `main`, validar
  e mesclar.
- [ ] Aplicar o alias `docs` e os overrides auditados de dependências por commit
  revisável antes do merge final.
- [ ] Executar PostgreSQL isolado e confirmar o lock de ativação de plano.
- [ ] Confirmar 0 vulnerabilidades de produção e `git diff --check` limpo.
- [ ] Encerrar somente as issues listadas como implementadas após os respectivos
  commits estarem na `main`.

Este relatório aprova a integração de código em ambiente local, com as
ressalvas acima; não declara o projeto finalizado nem autoriza merge automático.
