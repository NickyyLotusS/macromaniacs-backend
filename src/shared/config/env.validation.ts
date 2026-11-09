const environments = ['development', 'test', 'staging', 'production'] as const;

type Environment = (typeof environments)[number];

function integerBetween(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} deve ser um inteiro entre ${minimum} e ${maximum}`,
    );
  }
  return parsed;
}

export function validateDatabaseUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('DATABASE_URL é obrigatória');
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL válida');
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    parsed.pathname === '/' ||
    !parsed.pathname
  ) {
    throw new Error(
      'DATABASE_URL deve conter protocolo PostgreSQL, host, usuário e banco',
    );
  }
  return value.trim();
}

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const appEnv = String(config.APP_ENV ?? 'development');

  if (!environments.includes(appEnv as Environment)) {
    throw new Error(`APP_ENV inválido: ${appEnv}`);
  }

  const appPort = Number(config.APP_PORT ?? config.PORT ?? 3000);

  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
    throw new Error('APP_PORT deve ser um número entre 1 e 65535');
  }

  const databaseUrl = validateDatabaseUrl(config.DATABASE_URL);

  const jwtSecret = config.JWT_SECRET;

  if (
    typeof jwtSecret !== 'string' ||
    jwtSecret.trim().length < 32 ||
    jwtSecret.trim() === 'replace-with-at-least-32-random-characters'
  ) {
    throw new Error('JWT_SECRET deve possuir pelo menos 32 caracteres');
  }

  const jwtExpiresIn = config.JWT_EXPIRES_IN;

  if (
    typeof jwtExpiresIn !== 'string' ||
    !/^\d+(s|m|h|d|w)$/.test(jwtExpiresIn.trim())
  ) {
    throw new Error('JWT_EXPIRES_IN deve usar um valor como 15m, 1h, 7d ou 1w');
  }

  const corsOriginsValue = String(
    config.CORS_ORIGINS ?? 'http://localhost:5173',
  );
  const corsOrigins = corsOriginsValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS deve possuir pelo menos uma origem');
  }

  const normalizedCorsOrigins = corsOrigins.map((origin) => {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Origem CORS inválida: ${origin}`);
    }

    if (
      !['http:', 'https:'].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin !== origin.replace(/\/$/, '')
    ) {
      throw new Error(`Origem CORS inválida: ${origin}`);
    }

    return parsedOrigin.origin;
  });

  const termsVersion = String(config.TERMS_VERSION ?? '2026-11-08').trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(termsVersion)) {
    throw new Error('TERMS_VERSION deve identificar uma versão válida');
  }

  const defaultTimezone = String(config.DEFAULT_TIMEZONE ?? 'UTC').trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: defaultTimezone }).format(0);
  } catch {
    throw new Error('DEFAULT_TIMEZONE deve usar um identificador IANA válido');
  }

  const foodProviderTimeoutMs = integerBetween(
    config.FOOD_PROVIDER_TIMEOUT_MS,
    3000,
    'FOOD_PROVIDER_TIMEOUT_MS',
    100,
    30_000,
  );
  const foodProviderRetries = integerBetween(
    config.FOOD_PROVIDER_RETRIES,
    1,
    'FOOD_PROVIDER_RETRIES',
    0,
    3,
  );
  const foodProviderCircuitFailures = integerBetween(
    config.FOOD_PROVIDER_CIRCUIT_FAILURES,
    3,
    'FOOD_PROVIDER_CIRCUIT_FAILURES',
    1,
    20,
  );
  const foodProviderCircuitResetMs = integerBetween(
    config.FOOD_PROVIDER_CIRCUIT_RESET_MS,
    30_000,
    'FOOD_PROVIDER_CIRCUIT_RESET_MS',
    1000,
    600_000,
  );
  const rateLimitWindowMs = integerBetween(
    config.RATE_LIMIT_WINDOW_MS,
    60_000,
    'RATE_LIMIT_WINDOW_MS',
    1000,
    3_600_000,
  );
  const rateLimitMax = integerBetween(
    config.RATE_LIMIT_MAX,
    120,
    'RATE_LIMIT_MAX',
    1,
    100_000,
  );
  const loginRateLimitMax = integerBetween(
    config.LOGIN_RATE_LIMIT_MAX,
    10,
    'LOGIN_RATE_LIMIT_MAX',
    1,
    rateLimitMax,
  );
  const trustProxy = String(config.TRUST_PROXY ?? 'false') === 'true';

  return {
    ...config,
    APP_ENV: appEnv,
    APP_PORT: appPort,
    DATABASE_URL: databaseUrl.trim(),
    JWT_SECRET: jwtSecret.trim(),
    JWT_EXPIRES_IN: jwtExpiresIn.trim(),
    CORS_ORIGINS: normalizedCorsOrigins.join(','),
    TERMS_VERSION: termsVersion,
    DEFAULT_TIMEZONE: defaultTimezone,
    FOOD_PROVIDER_TIMEOUT_MS: foodProviderTimeoutMs,
    FOOD_PROVIDER_RETRIES: foodProviderRetries,
    FOOD_PROVIDER_CIRCUIT_FAILURES: foodProviderCircuitFailures,
    FOOD_PROVIDER_CIRCUIT_RESET_MS: foodProviderCircuitResetMs,
    RATE_LIMIT_WINDOW_MS: rateLimitWindowMs,
    RATE_LIMIT_MAX: rateLimitMax,
    LOGIN_RATE_LIMIT_MAX: loginRateLimitMax,
    TRUST_PROXY: trustProxy,
  };
}
