import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { validateDatabaseUrl } from '../src/shared/config/env.validation';

const url = new URL(validateDatabaseUrl(process.env.DATABASE_URL));
const user = decodeURIComponent(url.username);
const database = decodeURIComponent(url.pathname.slice(1));
const password = decodeURIComponent(url.password);
const port = url.port || '5432';
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  user !== 'postgres' ||
  database !== 'macromaniacs_db' ||
  port !== '5433' ||
  !password ||
  (process.env.POSTGRES_USER && process.env.POSTGRES_USER !== user) ||
  (process.env.POSTGRES_DB && process.env.POSTGRES_DB !== database) ||
  (process.env.POSTGRES_PORT && process.env.POSTGRES_PORT !== port) ||
  (process.env.POSTGRES_VOLUME &&
    process.env.POSTGRES_VOLUME !== 'macromaniacs-backend_pgdata') ||
  (process.env.POSTGRES_PASSWORD && process.env.POSTGRES_PASSWORD !== password)
)
  throw new Error(
    'Configuração local divergente da infraestrutura preservada. Confira .env sem expor credenciais.',
  );
const result = spawnSync(
  process.env.DOCKER_BIN || 'docker',
  [
    'compose',
    '-f',
    'infra/docker/compose.yaml',
    '--env-file',
    '.env',
    ...(process.argv.includes('--check')
      ? ['config', '--quiet']
      : ['up', '-d', '--wait']),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      POSTGRES_USER: user,
      POSTGRES_DB: database,
      POSTGRES_PORT: port,
      POSTGRES_PASSWORD: password,
    },
  },
);
process.exitCode = result.status ?? 1;
