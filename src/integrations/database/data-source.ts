import 'dotenv/config';
import { DatabaseSource } from './database-source';
import { databaseOptions } from './database.options';

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL é obrigatória para executar comandos do banco de dados.',
  );
}

export default new DatabaseSource(databaseOptions(databaseUrl));
