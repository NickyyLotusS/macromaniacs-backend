# MacroManiacs Backend

Backend do MacroManiacs organizado inicialmente como monolito modular.

Estrutura

- src/modules: modulos de negocio.
- src/shared: componentes compartilhados entre os modulos.
- src/jobs: processamentos assincronos.
- src/integrations: adaptadores para servicos externos.
- tests: testes unitarios, de integracao e ponta a ponta.
- docs: arquitetura, ADRs e contratos da API.
- infra: arquivos de suporte acordados com a equipe de infraestrutura.

Regras de dependência

- `src/modules` contém as regras e capacidades de negócio.
- `src/shared` contém somente componentes genéricos reutilizáveis.
- `src/integrations` encapsula serviços externos e seus SDKs.
- `src/jobs` inicia processamentos assíncronos usando serviços públicos.
- `src/app.module.ts` conecta as implementações concretas.

Módulos de negócio não devem importar SDKs externos nem acessar arquivos
internos de outros módulos. A comunicação deve acontecer por contratos,
serviços públicos ou eventos.
