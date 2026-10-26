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

## Próximos adapters

Os clientes de Open Food Facts, TBCA e USDA devem ficar em `src/integrations`,
mapear seus payloads para `ProviderFood`, possuir timeout e permitir substituição
por fakes nos testes. Ordem de fallback e distinção entre “não encontrado” e
“indisponível” pertencem a BE-019/BE-020 e não são inventadas neste contrato.
