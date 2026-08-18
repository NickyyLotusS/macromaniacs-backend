# MacroManiacs Backend

Backend do MacroManiacs organizado inicialmente como monolito modular.

## Estrutura

- src/modules: modulos de negocio.
- src/shared: componentes compartilhados entre os modulos.
- src/jobs: processamentos assincronos.
- src/integrations: adaptadores para servicos externos.
- tests: testes unitarios, de integracao e ponta a ponta.
- docs: arquitetura, ADRs e contratos da API.
- infra: arquivos de suporte acordados com a equipe de infraestrutura.

## Proximos passos

1. Definir a stack e registrar a decisao em docs/adr.
2. Documentar o contrato da API em docs/api.
3. Preencher .env.example sem adicionar segredos reais.
4. Configurar build, lint e testes no workflow de CI.
5. Implementar primeiro um fluxo vertical completo do MVP.