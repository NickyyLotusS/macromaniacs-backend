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

Open Food Facts usa leitura v3 por barcode e busca textual documentada, com
User-Agent próprio. USDA usa FoodData Central quando `USDA_API_KEY` está
configurada. TBCA permanece explicitamente desativada porque não foi encontrado
contrato público estável/licenciado; o backend não faz scraping.

Timeout, retry limitado e circuit breaker são configuráveis. A busca tenta os
provedores habilitados, normaliza e grava resultados; barcode retorna `404`
quando ao menos um provedor respondeu sem resultado e `503` quando todos os
provedores habilitados estão indisponíveis. Testes usam fixtures, nunca chamadas
externas instáveis.
