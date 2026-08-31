# ADR 0001 - Arquitetura inicial do backend

## Status

Proposta

## Contexto

O backend sera desenvolvido por uma equipe de tres pessoas e precisa atender
autenticacao, dieta, macros, check-ins, grupos, feed, ranking e conquistas.

## Decisao

Iniciar como monolito modular. Os modulos representam limites funcionais, nao
servicos implantados separadamente. Jobs de IA/OCR e notificacoes podem ser
executados de forma assincrona.

## Consequencias

- Menor custo operacional e de coordenacao no MVP.
- Contratos claros entre modulos continuam obrigatorios.
- Modulos poderao ser extraidos no futuro se houver necessidade comprovada.


## Limites dos componentes

### `src/modules`

Contém as capacidades de negócio, como autenticação, usuários, alimentos,
dietas, refeições, progresso e gamificação.

Pode depender de:

- Código compartilhado de `src/shared`.
- Contratos públicos exportados por outros módulos.
- Interfaces e tokens de injeção de dependência.

Não pode depender diretamente de:

- SDKs de provedores externos.
- Implementações de `src/integrations`.
- Processamentos definidos em `src/jobs`.
- Arquivos internos de outros módulos.

### `src/shared`

Contém recursos genéricos compartilhados, como tipos, decorators, erros,
utilitários, pipes e contratos técnicos.

Não deve conter regras específicas de um domínio e não pode depender de
`modules`, `integrations` ou `jobs`.

### `src/integrations`

Contém adaptadores para serviços externos, como provedores nutricionais,
armazenamento, e-mail e outros serviços de terceiros.

É o único local autorizado a importar diretamente SDKs externos. Os
adaptadores devem implementar contratos definidos pelo núcleo da aplicação.

### `src/jobs`

Contém pontos de entrada para processamentos assíncronos e tarefas agendadas.

Jobs podem chamar serviços públicos dos módulos, mas não devem conter regras
de negócio nem ser importados pelos módulos.

### `src/app.module.ts`

É a raiz de composição da aplicação. Pode conectar módulos, adapters e
implementações concretas, mas não deve implementar regras de negócio.

## Regras de dependência

1. Dependências sempre apontam para contratos ou componentes mais internos.
2. SDKs externos só podem ser importados por `src/integrations`.
3. Módulos não podem acessar arquivos internos de outros módulos.
4. Integrações implementam contratos; módulos não conhecem suas implementações.
5. Dependências circulares são proibidas.
6. Regras de negócio não devem existir em controllers, jobs ou adapters.