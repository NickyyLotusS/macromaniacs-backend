# Entrega e deploy para Infra

1. Provisionar PostgreSQL 15 e configurar segredos conforme `.env.example`.
2. Executar `npm ci`, qualidade e testes antes do build.
3. Gerar `npm run build`.
4. Em etapa separada, aprovada e com backup, executar
   `npm run migration:run:prod`. Nunca habilitar `synchronize` ou migrations no
   startup.
5. Executar `npm run seed:prod` para catálogos idempotentes.
6. Iniciar com `npm run start:prod` e verificar `/health` e `/health/ready`.
7. Validar CORS, proxy confiável, limites e logs/correlation IDs no ambiente.

Rollback da aplicação deve preservar o banco. A migration de conclusão só pode
ser revertida em ambiente controlado e recusa o down quando existem perfis
iniciais incompletos. #82/Railway continua sob responsabilidade de Infra; esta
branch não altera ambientes externos.
