# Performance

O job PostgreSQL 15 cria massa sintética determinística dentro de uma transação:
2.000 snapshots diários e 5.000 registros em refeições, feed, ledger e alimentos.
Ele executa `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` nos hot paths de histórico
nutricional, refeições, feed, ledger/saldo e barcode, registra
`PERFORMANCE_BASELINE` no log da CI e confirma os nove índices usados pelas
consultas de grupos, progresso, catálogo, feed, saldo e inventário. A transação
é revertida ao final.

Tempos são evidência comparativa, não um limite rígido: runners compartilhados
variam. Uma regressão deve comparar o mesmo commit/runner, plano, buffers e p95.
A busca local por nome preserva a semântica de substring (`LIKE %termo%`) e pode
fazer varredura sequencial; antes de volume alto, validar `pg_trgm` no PostgreSQL
gerenciado ou aprovar uma mudança de contrato para busca por prefixo/full text.

## Smoke HTTP em staging descartável

O harness é somente leitura e exige URL/token explícitos. Nunca apontar para
produção sem autorização:

```bash
PERF_BASE_URL=https://preview.example \
PERF_ACCESS_TOKEN='<token de usuário sintético>' \
PERF_ITERATIONS=300 PERF_CONCURRENCY=10 npm run perf:smoke
```

`PERF_ENDPOINTS` aceita caminhos separados por vírgula, permitindo acrescentar
feed e ranking com IDs da massa de staging. A saída JSON contém p50, p95, máximo,
contagem por endpoint e falhas HTTP. Um resultado só é evidência de homologação
quando o log real do ambiente for anexado; a existência do script não representa
uma execução externa bem-sucedida.
