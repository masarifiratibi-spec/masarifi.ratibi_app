import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';

export function buildPsqlEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL_INVALID');

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
  if (url.username) environment.PGUSER = decodeURIComponent(url.username);
  if (url.password) environment.PGPASSWORD = decodeURIComponent(url.password);
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode) environment.PGSSLMODE = sslMode;
  delete environment.DATABASE_URL;
  return environment;
}

export function buildPsqlArguments(sqlPath: string): string[] {
  return [
    '--no-psqlrc',
    '--single-transaction',
    '--set',
    'ON_ERROR_STOP=1',
    '--command',
    'grant masarifi_migration to current_user with set true, inherit false',
    '--command',
    'set local role masarifi_migration',
    '--file',
    sqlPath,
    '--command',
    'reset role',
    '--command',
    'revoke masarifi_migration from current_user granted by current_user',
  ];
}

export function runPsql(): number {
  const databaseUrl = process.env.DATABASE_URL;
  const requestedPath = process.argv[2];
  if (!databaseUrl) throw new Error('DATABASE_URL_REQUIRED');
  if (!requestedPath) throw new Error('SQL_FILE_REQUIRED');

  const performanceDirectory = resolve(__dirname);
  const sqlPath = resolve(process.cwd(), requestedPath);
  const pathFromPerformanceDirectory = relative(performanceDirectory, sqlPath);
  if (
    isAbsolute(pathFromPerformanceDirectory) ||
    pathFromPerformanceDirectory.startsWith('..') ||
    !sqlPath.endsWith('.sql')
  ) {
    throw new Error('SQL_FILE_INVALID');
  }

  const result = spawnSync('psql', buildPsqlArguments(sqlPath), {
    env: buildPsqlEnvironment(databaseUrl),
    stdio: 'inherit',
  });
  if (result.error) throw new Error('PSQL_NOT_AVAILABLE');
  return result.status ?? 1;
}

if (require.main === module) {
  try {
    process.exitCode = runPsql();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'PSQL_RUN_FAILED'}\n`);
    process.exitCode = 1;
  }
}
