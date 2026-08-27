import { buildPsqlArguments, buildPsqlEnvironment } from '../../performance/run-psql';

describe('performance psql runner', () => {
  it('passes database credentials through libpq environment variables', () => {
    expect(
      buildPsqlEnvironment('postgresql://runner:p%40ss@127.0.0.1:54322/masarifi?sslmode=disable'),
    ).toMatchObject({
      PGHOST: '127.0.0.1',
      PGPORT: '54322',
      PGUSER: 'runner',
      PGPASSWORD: 'p@ss',
      PGDATABASE: 'masarifi',
      PGSSLMODE: 'disable',
    });
  });

  it('rejects non-PostgreSQL connection URLs', () => {
    expect(() => buildPsqlEnvironment('https://example.com/database')).toThrow(
      'DATABASE_URL_INVALID',
    );
  });

  it('returns a stable error for malformed secret input', () => {
    expect(() => buildPsqlEnvironment('not-a-url-with-secret')).toThrow(
      new Error('DATABASE_URL_INVALID'),
    );
  });

  it('wraps the SQL file and temporary owner grant in one transaction', () => {
    expect(buildPsqlArguments('fixture.sql')).toEqual([
      '--no-psqlrc',
      '--single-transaction',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      'grant masarifi_migration to current_user with set true, inherit false',
      '--command',
      'set local role masarifi_migration',
      '--file',
      'fixture.sql',
      '--command',
      'reset role',
      '--command',
      'revoke masarifi_migration from current_user granted by current_user',
    ]);
  });
});
