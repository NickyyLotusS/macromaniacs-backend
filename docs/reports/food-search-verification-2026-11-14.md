# Verificação da busca de alimentos — 14/11/2026

## Escopo

A verificação externa foi feita contra o Search-a-licious oficial do Open Food
Facts, com `langs=pt,en`, relevância padrão, `boost_phrase=true`, 12 itens por
termo e somente os campos consumidos pelo adapter. As chamadas foram espaçadas
em 8 segundos. Nenhum teste automatizado acessa provedores reais.

Um item foi contado como utilizável somente quando tinha código, nome, energia,
proteína, carboidrato e gordura e quando os valores estavam entre zero e os
limites físicos aplicados pelo backend (900 kcal e 100 g de cada macro por
100 g).

| Termo enviado no diagnóstico | Total informado pelo provedor | Utilizáveis entre 12 | Exemplos úteis |
| --- | ---: | ---: | --- |
| `sorvete` | 363 | 11 | Sorvete; Sorvete mini; Sorvete vegano |
| `sorvete de chocolate` | 10.000* | 8 | Sorvete de chocolate; Sorvete de chocolate meio amargo |
| `sorvete de creme` | 10.000* | 9 | Sorvete de creme; Sorvete Qualitá Creme |
| `arroz` | 1.198 | 10 | Arroz integral; arroz parboilizado |
| `feijão` | 339 | 9 | Feijão; Feijão preto; Feijão manteiga |
| `feijao` | 269 | 10 | Feijao; Feijao frade; Feijao moyashi |
| `pão` | 1.312 | 11 | Pão fatiado; Pão de forma; Pão de hambúrguer |
| `pao` | 283 | 7 | Pao sem glúten; Pao de forma proteico |
| `banana` | 8.897 | 8 | Banana; produtos de banana com rótulo completo |
| `leite` | 2.098 | 8 | Leite condensado; doce de leite; leite em pó |

\* O serviço reportou 10.000 como limite superior, não como contagem exata.

## Conclusões

- O endpoint legado `/cgi/search.pl` retornou itens pouco relevantes para
  `sorvete`; Search-a-licious trouxe correspondências exatas em português.
- Consultas com e sem acento produziam conjuntos diferentes. O adapter agora
  transforma `feijao`/`feijoes` em `feijão` e `pao`/`paes` em `pão` antes da
  única chamada, e o cache usa a forma sem acento. As variantes passam a
  compartilhar resposta sem dobrar o tráfego.
- A busca externa é adequada para produtos embalados. `arroz`, `banana` e
  `leite` podem privilegiar marcas ou produtos processados, não uma composição
  genérica brasileira cozida/in natura.
- USDA pode complementar cobertura quando uma chave real estiver configurada,
  mas tende a fornecer nomes em inglês. TBCA tem boa cobertura brasileira, mas
  continua desativada porque o projeto não adotou uma API pública estável e não
  faz scraping.
- Itens incompletos ou fisicamente inválidos são descartados, nunca preenchidos
  com nutrientes fictícios.

## Provas automatizadas relacionadas

- endpoint de sugestão externa e fallback local em `test/food-cache.e2e-spec.ts`;
- cache, TTL e coalescência em `tests/unit/food-search-cache.service.spec.ts`;
- combinação, deduplicação, paginação e indisponibilidade em
  `tests/unit/food-lookup.service.spec.ts`;
- 429, Retry-After e contratos dos providers em
  `tests/unit/food-providers.spec.ts`;
- debounce, cancelamento lógico, respostas fora de ordem e estados da UI no
  frontend.

O fluxo foi validado por testes de componente até a inclusão da sugestão externa
no rascunho da refeição. A checagem visual final em aparelho físico com Expo Go
permanece recomendada e não é declarada como executada neste relatório.
