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

`createdAt` e `updatedAt` são a trilha de auditoria do cache local. O instante
`retrievedAt` permanece no limite da integração para políticas futuras de
expiração; não existe coluna canônica para persistir esse instante e esta entrega
não altera o schema.

Cadastro manual usa `POST /v1/foods/manual`, exige JWT e grava `source=MANUAL`
com `externalId=null`. Nome, barcode, nutrientes e porção são validados antes da
persistência; os limites respeitam `NUMERIC(6,2)` e barcode duplicado retorna
conflito controlado.

## Próximos adapters

Os clientes de Open Food Facts, TBCA e USDA devem ficar em `src/integrations`,
mapear seus payloads para `ProviderFood`, possuir timeout e permitir substituição
por fakes nos testes. Ordem de fallback e distinção entre “não encontrado” e
“indisponível” pertencem a BE-019/BE-020 e não são inventadas neste contrato.
