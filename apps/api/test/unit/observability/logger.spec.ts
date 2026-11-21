import {
  PlatformLogger,
  redactSensitive,
} from '../../../src/platform/observability/platform-logger';
import { logContext } from '../../../src/platform/observability/log-context';

describe('PlatformLogger', () => {
  it('preserves safe existing structured events while dropping financial payloads and free text', () => {
    const lines: string[] = [];
    const logger = new PlatformLogger((line) => lines.push(line));
    logContext.run({ requestId: 'actual-request' }, () => {
      logger.log(
        {
          event: 'mutation.received',
          requestId: 'embedded-request',
          outcome: 'hash_mismatch',
          payload: 'private-fixture-content',
          amount: 7654321,
        },
        'SyncService' as never,
      );
    });
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      message: 'mutation.received',
      operation: 'mutation.received',
      state: 'hash_mismatch',
      outcome: 'failure',
      requestId: 'actual-request',
      context: 'SyncService',
    });
    expect(lines[0]).not.toContain('private-fixture-content');
    expect(lines[0]).not.toContain('7654321');
  });
  it('gives standalone events a correlation ID and uses durable job IDs for worker events', () => {
    const lines: string[] = [];
    const logger = new PlatformLogger((line) => lines.push(line));
    logger.info('application.started');
    const jobId = '99000000-0000-4000-8000-000000000001';
    logger.info('job.completed', { jobName: 'import.parse', resourceId: jobId });
    expect((JSON.parse(lines[0] ?? '{}') as { requestId: string }).requestId).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect((JSON.parse(lines[1] ?? '{}') as { requestId: string }).requestId).toBe(jobId);
  });
  it('inherits request correlation and rejects unapproved payload fields and free text', async () => {
    const lines: string[] = [];
    const logger = new PlatformLogger((line) => lines.push(line));
    await Promise.all(
      ['request-a', 'request-b'].map((requestId) =>
        logContext.run({ requestId }, async () => {
          await new Promise((resolve) => setImmediate(resolve));
          logger.info('request.completed', { durationMs: 12, code: 'OK' });
        }),
      ),
    );
    expect(
      lines.map((line) => (JSON.parse(line) as { requestId: string }).requestId).sort(),
    ).toEqual(['request-a', 'request-b']);
    const record = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(typeof record.service).toBe('string');
    expect(typeof record.version).toBe('string');
    expect(record).toMatchObject({ operation: 'request.completed', outcome: 'success' });
    logger.error('SMS account balance 12345', {
      payload: 'financial-secret',
      sql: 'select private-fixture',
      amount: 12345,
    } as never);
    const output = lines[2] ?? '';
    for (const sentinel of ['12345', 'financial-secret', 'private-fixture'])
      expect(output).not.toContain(sentinel);
    expect(JSON.parse(output)).toMatchObject({
      message: 'application.message',
      outcome: 'failure',
    });
  });
  it('writes one bounded JSON record with correlation fields', () => {
    const lines: string[] = [];
    const logger = new PlatformLogger((line) => lines.push(line), 'debug');

    logger.info('request.completed', {
      context: 'Http',
      requestId: 'req-1',
      code: 'OK',
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      level: 'info',
      message: 'request.completed',
      context: 'Http',
      requestId: 'req-1',
      code: 'OK',
    });
  });

  it('redacts credential keys and credential-bearing strings recursively', () => {
    const sentinel = 'sentinel-secret-value';
    const value = redactSensitive({
      password: sentinel,
      nested: { authorization: `Bearer ${sentinel}` },
      database: `postgresql://user:${sentinel}@localhost/db`,
      email: 'owner@example.test',
      phone: '+966500000012',
      sessionId: 'session_fixture_a',
    });
    const encoded = JSON.stringify(value);

    expect(encoded).not.toContain(sentinel);
    expect(encoded).toContain('[REDACTED]');
  });

  it('drops messages below the configured level', () => {
    const lines: string[] = [];
    const logger = new PlatformLogger((line) => lines.push(line), 'warn');

    logger.info('ignored');
    logger.warn('kept');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('kept');
  });
});
