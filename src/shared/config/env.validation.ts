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

  return {
    ...config,
    APP_ENV: appEnv,
    APP_PORT: appPort,
  };
}