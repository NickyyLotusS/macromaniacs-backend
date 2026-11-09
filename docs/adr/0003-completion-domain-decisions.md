# ADR 0003 — Decisões conservadoras da conclusão do domínio

Status: proposta implementada, pendente de ratificação de Produto para valores
de pontuação. Data: 2026-11-09.

## Contexto

O backlog exigia aceite auditável de termos, datas alimentares explícitas,
eventos duráveis, pontuação antifarming e compras atômicas, mas não fixava todos
os detalhes de produto.

## Decisão

- O cadastro cria `user_profiles` incompleto, `user_stats` e uma linha
  append-only em `user_terms_acceptances` com versão e instante. Usuários
  anteriores não recebem consentimento fabricado.
- A data alimentar é derivada do instante consumido no timezone IANA do perfil
  e gravada com o timezone usado. O padrão configurável é `UTC`.
- `scheduled_time` é horário civil local opcional (`HH:mm`), interpretado no
  timezone atual do usuário.
- Refeições escrevem `outbox_events` na mesma transação. O consumidor aplica
  gamificação e publicação social depois da confirmação da refeição.
- O ledger `point_transactions` é append-only e cada efeito usa chave
  idempotente. `user_stats.total_points` é uma projeção reconciliável pela soma
  do ledger.
- A proposta `2026-11-v1` concede 5 pontos para no máximo três refeições por
  data alimentar; `FIRST_MEAL`, `STREAK_3` e `STREAK_7` concedem 10, 25 e 75.
  Missões usam os valores versionados no catálogo.
- Compras bloqueiam a projeção do usuário, recalculam o saldo pelo ledger e
  inserem débito e inventário na mesma transação.
- TBCA permanece desabilitada: não foi encontrado contrato de API pública
  estável e adequado. Não há scraping. USDA só é ativado com chave real.

## Consequências

As escolhas são aditivas, configuráveis e reversíveis por nova migration/regra
versionada. A pontuação precisa de ratificação de Produto. Um consumidor de
outbox dedicado pode substituir o processamento oportunístico sem alterar o
contrato persistido.
