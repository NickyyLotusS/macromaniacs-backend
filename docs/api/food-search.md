# Busca de alimentos

## Diagnóstico corrigido

O autocomplete do app enviava `external=false`, portanto consultava somente o
PostgreSQL. A busca completa chamava cada provedor sequencialmente, persistia os
itens e executava a mesma página local novamente. Em páginas maiores que 1, um
item externo recém-importado podia ficar fora da página solicitada; a ordenação
alfabética também descartava a relevância original do provedor.

O Open Food Facts era consultado pelo endpoint legado `/cgi/search.pl`. Em uma
verificação com `sorvete`, ele devolveu nomes sem relação legível com o termo nos
primeiros resultados. O Search-a-licious oficial retornou correspondências como
“Sorvete”, “Sorvete de chocolate” e “Sorvete de creme”, com os campos
nutricionais necessários.

## Contratos

### Sugestões

```http
GET /v1/foods/suggestions?q=sorv&limit=8
```

`q` aceita de 3 a 100 caracteres e `limit` de 1 a 20. Exemplo:

```json
{
  "items": [
    {
      "id": "uuid-do-catalogo",
      "name": "Sorvete de creme (Marca)",
      "source": "OPEN_FOOD_FACTS",
      "externalId": "7890000000000",
      "barcode": "7890000000000",
      "caloriesPer100g": 180,
      "proteinPer100g": 3,
      "carbsPer100g": 25,
      "fatPer100g": 8,
      "fiberPer100g": 0,
      "servingSizeG": 100,
      "retrievedAt": "2026-11-14T12:00:00.000Z",
      "createdAt": "2026-11-14T12:00:00.000Z",
      "updatedAt": "2026-11-14T12:00:00.000Z"
    }
  ],
  "externalStatus": "AVAILABLE"
}
```

`externalStatus=UNAVAILABLE` significa que nenhum provedor habilitado respondeu.
`items` ainda pode conter o fallback local; o cliente não deve apresentar isso
como “nenhum alimento encontrado”.

### Busca completa

`GET /v1/foods` mantém o contrato anterior, inclusive `external=false`,
paginação e metadados. Com fontes externas habilitadas, a página local e a
página dos provedores são combinadas diretamente, persistidas e ordenadas antes
da resposta. Uma falha externa só produz `503` quando não existe resultado local
e nenhum provedor respondeu.

## Controle de tráfego

- app: mínimo de 3 caracteres, debounce de 650 ms e cancelamento pelo
  `AbortSignal`;
- backend: cache por provedor/termo/página/limite, TTL padrão de 15 minutos e
  reaproveitamento da mesma Promise para consultas simultâneas;
- Open Food Facts: teto local padrão de 8 buscas/minuto e 12 produtos/minuto;
- USDA: teto local padrão de 900/hora, somente com `USDA_API_KEY`;
- timeout de 3 s, um retry exponencial para rede/5xx, sem retry imediato de 429,
  respeito a `Retry-After` e circuit breaker;
- falha externa preserva os dados locais disponíveis.

Referências oficiais:

- [Open Food Facts — uso e rate limits](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
- [Search-a-licious — API de busca textual](https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/)
- [USDA FoodData Central — API e cota](https://fdc.nal.usda.gov/api-guide/)
- [TBCA/USP](https://fcf.usp.br/tbca/) — catálogo consultável, sem contrato de
  API pública estável adotado pelo projeto.

Para escala superior ao MVP, o caminho recomendado pelo Open Food Facts é
indexar os exports oficiais localmente. O limitador em memória é por instância;
uma implantação com múltiplas réplicas deve mover cache e quota para um serviço
compartilhado antes de ampliar tráfego.

## Teste local

```powershell
Copy-Item .env.example .env
# Substitua senhas, JWT_SECRET e o contato do User-Agent.
$env:POSTGRES_PASSWORD = 'senha-local'
docker compose -f infra/docker/compose.yaml up -d
npm run migration:run
npm run start:dev
```

Em outro terminal:

```powershell
Invoke-RestMethod 'http://localhost:3000/v1/foods/suggestions?q=sorv&limit=8'
Invoke-RestMethod 'http://localhost:3000/v1/foods?q=feijao&page=1&limit=20'
```

Execute também `npm test -- --runInBand`, `npm run typecheck`, `npm run lint` e
`npm run format:check`. As suítes automatizadas usam mocks; não consomem cotas
dos provedores.
