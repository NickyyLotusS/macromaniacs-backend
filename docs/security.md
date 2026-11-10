# Segurança operacional

- JWT expirável, hash `scrypt`, mensagens genéricas no login e nenhum hash em
  respostas/logs.
- ValidationPipe global com whitelist e rejeição de campos extras.
- Ownership aplicado em perfil, planos, refeições e inventário; grupos privados
  exigem associação e ações administrativas exigem papel `ADMIN`.
- CORS usa allowlist explícita; nunca configure `*` com credenciais.
- Headers defensivos são enviados globalmente. Login possui orçamento de rate
  limit menor que o restante da API.
- Idempotency keys e constraints parciais protegem refeições, pontos, posts
  automáticos e compras contra retries.
- O ledger rejeita `UPDATE`/`DELETE` direto; remoções por cascade na exclusão do
  usuário continuam possíveis.
- Erros 5xx retornam mensagem genérica e correlation ID, sem payload, segredo ou
  stack trace.

O rate limit atual é por processo. Antes de escalar horizontalmente, adote um
contador compartilhado (por exemplo Redis) e ratifique os limites com Infra.
`TRUST_PROXY=true` só deve ser usado com um único proxy confiável controlado.
