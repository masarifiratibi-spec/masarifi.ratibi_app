import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { assertStagingTarget } = createRequire(__filename)(
  resolve(process.cwd(), '../../scripts/staging-voice-owner-quota-migration.cjs'),
) as { assertStagingTarget: (connectionString: string) => void };

it.each([
  'postgresql://postgres:fixture@db.production.invalid:5432/postgres',
  'postgresql://postgres.foreign:fixture@aws-1.pooler.supabase.com:5432/postgres',
  'postgresql://postgres:fixture@127.0.0.1:54433/postgres',
])('rejects another database identity before constructing any database client', (url) => {
  expect(() => {
    assertStagingTarget(url);
  }).toThrow('STAGING_DATABASE_MISMATCH');
});

it.each(['host', 'port', 'user', 'dbname', 'options'])(
  'rejects connection query override %s before any client is constructed',
  (parameter) => {
    expect(() => {
      assertStagingTarget(
        `postgresql://postgres:fixture@db.fixture.invalid:5432/postgres?${parameter}=foreign`,
      );
    }).toThrow('CONNECTION_QUERY_OVERRIDE_DENIED');
  },
);

it.each(['socket:', 'https:'])('rejects unsupported database protocol %s', (protocol) => {
  expect(() => {
    assertStagingTarget(`${protocol}//postgres@db.fixture.invalid/postgres`);
  }).toThrow('CONNECTION_PROTOCOL_DENIED');
});
