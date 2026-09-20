const environments = [
  'development',
  'test',
  'staging',
  'production',
] as const;

type Environment = (typeof environments)[number];

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const appEnv = String(config.APP_ENV ?? 'development');

  if (!environments.includes(appEnv as Environment)) {
    throw new Error(`APP_ENV inválido: ${appEnv}`);
  }

  const appPort = Number(config.APP_PORT ?? 3000);

  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
    throw new Error('APP_PORT deve ser um número entre 1 e 65535');
  }

  const databaseUrl = config.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL é obrigatória');
  }

  let parsedDatabaseUrl: URL;

  try {
    parsedDatabaseUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL válida');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL deve utilizar o protocolo PostgreSQL');
  }

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
    throw new Error(
      'JWT_EXPIRES_IN deve usar um valor como 15m, 1h, 7d ou 1w',
    );
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

  return {
    ...config,
    APP_ENV: appEnv,
    APP_PORT: appPort,
    DATABASE_URL: databaseUrl.trim(),
    JWT_SECRET: jwtSecret.trim(),
    JWT_EXPIRES_IN: jwtExpiresIn.trim(),
    CORS_ORIGINS: normalizedCorsOrigins.join(','),
  };
}
