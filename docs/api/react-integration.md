# Integração da autenticação com React

## Configuração

```env
VITE_API_URL=http://localhost:3000
```

O valor usado em `VITE_API_URL` não deve terminar com `/`. A origem do React
também deve estar presente em `CORS_ORIGINS` no backend.

## Contratos

Cadastro:

```json
{
  "email": "user@example.com",
  "username": "macro_user",
  "password": "strong-password-123",
  "termsAccepted": true
}
```

Login:

```json
{
  "identifier": "user@example.com",
  "password": "strong-password-123"
}
```

O login responde:

```json
{
  "accessToken": "jwt"
}
```

## Cliente HTTP mínimo

```ts
const API_URL = import.meta.env.VITE_API_URL;

type ApiError = {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
    },
  });

  const body = (await response.json()) as T | ApiError;

  if (!response.ok) {
    throw body as ApiError;
  }

  return body as T;
}
```

Uso:

```ts
const session = await apiRequest<{ accessToken: string }>(
  '/v1/auth/login',
  {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  },
);

const currentUser = await apiRequest(
  '/v1/auth/me',
  { method: 'GET' },
  session.accessToken,
);
```

## Perfil nutricional e onboarding

Depois de autenticar ou restaurar o token, consulte `GET /v1/users/me`. O campo
`onboardingCompleted` retornado pelo servidor decide a navegação. Um perfil
novo retorna `false`, `currentMeasurement: null` e `nutrition: null`.

O envio final do onboarding usa `PATCH /v1/users/me`:

```json
{
  "displayName": "Nicolly",
  "dateOfBirth": "1996-09-19",
  "heightCm": 165,
  "currentWeightKg": 68.5,
  "biologicalSex": "FEMALE",
  "goal": "LOSE_WEIGHT",
  "activityLevel": "MODERATE",
  "targetWeightKg": 62,
  "targetDate": "2027-03-01",
  "dietaryRestrictions": "Sem lactose"
}
```

O servidor valida o payload, registra a medida e calcula as métricas na mesma
transação. Exemplo resumido da resposta:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "macro_user",
  "displayName": "Nicolly",
  "onboardingCompleted": true,
  "currentMeasurement": {
    "id": "uuid",
    "heightCm": 165,
    "weightKg": 68.5,
    "measuredAt": "2026-09-19T21:00:00.000Z"
  },
  "nutrition": {
    "ageYears": 30,
    "bmrKcalPerDay": 1405,
    "tdeeKcalPerDay": 2178,
    "calorieTargetKcalPerDay": 1869,
    "calculatedAt": "2026-09-19T21:00:00.000Z"
  }
}
```

Os enums aceitos estão documentados no Swagger. `targetWeightKg` e
`targetDate` são opcionais, porém devem ser preenchidos juntos. O cliente não
envia TMB, TDEE, meta calórica nem `onboardingCompleted`.

Durante a demonstração, o token pode ser mantido no estado do React. Se for
necessário persistir a sessão após atualizar a página, o frontend pode usar
`sessionStorage`, entendendo que tokens acessíveis ao JavaScript exigem uma
política forte contra XSS. Uma futura adoção de cookies `HttpOnly` exige mudar
o contrato de autenticação e não faz parte deste MVP.

## Fluxo esperado da interface

1. Cadastro chama `POST /v1/auth/register`.
2. Após o cadastro, a interface encaminha para o login.
3. Login armazena o `accessToken` no estado da sessão.
4. A aplicação chama `GET /v1/users/me` com `Authorization: Bearer <token>`.
5. Perfil incompleto abre o onboarding; perfil completo abre a Home.
6. O onboarding chama `PATCH /v1/users/me` e só abre a Home após receber
   `onboardingCompleted: true`.
7. Respostas `401` limpam a sessão e encaminham novamente ao login.
8. Respostas `400` exibem as mensagens de validação.
9. Respostas `409` informam que o e-mail ou username já está em uso.
