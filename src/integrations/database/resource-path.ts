import { join, resolve } from 'node:path';

export function databaseResourcePath(relative: string): string {
  // Nest/CLI build is CommonJS; Jest uses ESM for the NestJS 12 dependencies.
  const directory =
    typeof __dirname === 'string'
      ? __dirname
      : resolve('src/integrations/database');
  return join(directory, relative);
}
