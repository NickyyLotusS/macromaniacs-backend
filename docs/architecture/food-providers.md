# Contrato de provedores alimentares

O domínio de alimentos recebe integrações externas somente pelo contrato
`FoodProvider`. Open Food Facts, TBCA e USDA devem implementar `search` e
`findByBarcode` e devolver `ProviderFood`; controllers e repositórios não devem
importar SDKs ou formatos específicos de um provedor.

## Unidade canônica

`NutritionNormalizer` converte energia e macronutrientes da base declarada pelo
provedor para **100 g**:

- energia: `kcal/100 g`;
- proteína, carboidrato, gordura e fibra: `g/100 g`;
- porção: gramas.

Valores atravessam o contrato como strings decimais. A normalização usa
aritmética inteira e arredondamento half-up para duas casas, evitando conversão
silenciosa de `NUMERIC` para ponto flutuante. Base/porção devem ser positivas e
nutrientes não podem ser negativos. Fibra ausente é normalizada para zero;
macros obrigatórios ausentes ou inválidos rejeitam o item.

## Auditoria

Todo alimento normalizado preserva `source`, `externalId` e `retrievedAt`.
`source + externalId` é a identidade externa usada pelo repositório local, de
acordo com a constraint canônica. O payload bruto não é persistido nem logado
por este contrato.

## Repositório local e cache

`FoodCacheService` consulta o banco por barcode antes de chamar um provider.
Resultados externos válidos são normalizados e persistidos pela identidade
`source + externalId`; consultas repetidas devolvem o mesmo registro local. A
constraint de barcode impede duplicação entre fontes, inclusive sob corrida.

`createdAt`, `updatedAt` e `retrievedAt` são a trilha de auditoria do cache
local. A migration aditiva persiste o instante de obtenção externa.

Cadastro manual usa `POST /v1/foods/manual`, exige JWT e grava `source=MANUAL`
com `externalId=null`. Nome, barcode, nutrientes e porção são validados antes da
persistência; os limites respeitam `NUMERIC(6,2)` e barcode duplicado retorna
conflito controlado.

## Adapters e fallback

Open Food Facts usa leitura v3 por barcode e o Search-a-licious oficial para
busca textual relevante em português/inglês, com User-Agent próprio. O endpoint
legado `/cgi/search.pl` não é usado: além de devolver resultados pouco
relevantes para consultas em português, a documentação o desaconselha para
integrações novas. USDA usa FoodData Central quando `USDA_API_KEY` está
configurada. TBCA permanece explicitamente desativada porque não foi encontrado
contrato público estável/licenciado; o backend não faz scraping.

`GET /v1/foods/suggestions` consulta catálogo e provedores em paralelo, combina
os resultados sem uma segunda busca paginada no banco, ordena correspondência
exata/prefixo/palavra/trecho e elimina duplicações por barcode ou identidade
nutricional. O cache em memória é compartilhado pelo processo, tem TTL de 15
minutos e agrega requisições simultâneas equivalentes. O resultado externo
válido também é persistido no catálogo PostgreSQL para fallback futuro.

Timeout, retry exponencial limitado, circuit breaker, HTTP 429 e limitador local
por provedor são configuráveis. O padrão fica abaixo das cotas oficiais: 8
buscas/minuto e 12 leituras de produto/minuto no Open Food Facts; USDA só é
ativado com chave e usa no máximo 900 requisições/hora. A documentação oficial
informa 10 buscas/minuto e 15 leituras/minuto para Product Opener, e 1.000/hora
para uma chave normal do USDA. Testes usam fixtures, nunca chamadas externas
instáveis.

Itens sem energia, proteína, carboidrato ou gordura são descartados. Energia
acima de 900 kcal/100 g ou macronutriente acima de 100 g/100 g também é
rejeitado; nenhum valor obrigatório é inventado. Fibra ausente continua zero,
como previsto pelo contrato canônico.
