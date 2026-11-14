# Avatar DiceBear persistente

O backend é a fonte de verdade para o avatar do perfil no modo real. Ele
persiste somente a configuração visual e nunca recebe nem armazena a imagem.

## Contrato

```json
{
  "style": "adventurer",
  "seed": "abc123xyz789"
}
```

`style` aceita somente `avataaars`, `adventurer`, `big-smile` ou `fun-emoji`.
`seed` deve ser alfanumérica e ter de 6 a 32 caracteres. Campos extras,
arrays, URLs, SVG, HTML e estilos desconhecidos são rejeitados pelo
`ValidationPipe` global.

## Leitura e escrita

As duas operações exigem `Authorization: Bearer <JWT>`:

```http
GET /v1/users/me
```

A resposta sempre contém `avatar`. Perfis sem escolha retornam `avatar: null`,
inclusive quando o banco contém o estado canônico vazio `{}`.

```http
PATCH /v1/users/me
Content-Type: application/json

{
  "avatar": {
    "style": "adventurer",
    "seed": "abc123xyz789"
  }
}
```

Para remover:

```json
{ "avatar": null }
```

O usuário só altera o próprio perfil identificado pelo JWT. Um PATCH exclusivo
de avatar é aceito antes do onboarding, não preenche
`onboarding_completed_at`, não cria medidas e não altera os campos corporais ou
nutricionais.

## Persistência e imagem

A configuração usa a coluna existente `user_profiles.avatar_config` (`jsonb`,
`NOT NULL`, default `{}`, CHECK de objeto JSON). Nenhuma migration é necessária.
Remoção grava `{}` para preservar o contrato físico.

O cliente constrói a imagem exclusivamente em
`https://api.dicebear.com/10.x/<style>/png?seed=<seed>&size=<size>`, depois de
validar estilo e seed. Seeds devem ser aleatórias e nunca derivadas de nome,
email, username, JWT ou ID.

Os DTOs sociais ainda não publicam o avatar de outros membros. Feed, grupos e
ranking preservam as iniciais; isso evita ampliar a superfície pública sem uma
decisão de produto. Itens cosméticos de recompensa do tipo `AVATAR` continuam
independentes e não têm sua propriedade ou estado de equipamento alterados.
