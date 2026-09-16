const environments = ['development', 'test', 'staging', 'production'] as const;

type Environment = (typeof environments)[number];

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

  const appPort = Number(config.APP_PORT ?? 3000);

  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
    throw new Error('APP_PORT deve ser um número entre 1 e 65535');
  }

  const databaseUrl = validateDatabaseUrl(config.DATABASE_URL);

  return {
    ...config,
    APP_ENV: appEnv,
    APP_PORT: appPort,
    DATABASE_URL: databaseUrl.trim(),
  };
}
