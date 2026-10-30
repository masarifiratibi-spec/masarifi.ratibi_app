import { ReportsService } from '../../../src/reports/reports.service';

describe('ReportsService generation', () => {
  const principal = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 10 };
  const command = {
    type: 'financial_summary',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    format: 'pdf',
    delivery: 'download',
  };

  it('keeps email generation behind recent authentication and requires a bounded idempotency key', async () => {
    const repository = { captureSnapshot: jest.fn() };
    const service = new ReportsService(repository as never);
    await expect(
      service.createReport({ ...principal, factorAgeSeconds: 999 }, { ...command, delivery: 'email', recipient: 'owner@example.test' }, 'request-key', 'r'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.createReport(principal, command, 'short', 'r')).rejects.toMatchObject({
      status: 400,
    });
    expect(repository.captureSnapshot).not.toHaveBeenCalled();
  });

  it('accepts owner PDF downloads with a valid session regardless of factor age', async () => {
    const repository = { captureSnapshot: jest.fn().mockResolvedValue({ attemptId: 'id', status: 'queued' }) };
    const service = new ReportsService(repository as never);
    const signedIn = { ...principal, factorAgeSeconds: 86_400 };
    await expect(service.createReport(signedIn, command, 'download-operation', 'r')).resolves.toMatchObject({ status: 'queued' });
    expect(repository.captureSnapshot).toHaveBeenCalledWith(signedIn, expect.objectContaining({ format: 'pdf', delivery: 'download' }), 'download-operation', 'r');
  });

  it('polls and signs only owner-scoped PDF downloads without an extra identity challenge, keeping admin and other output protections', async () => {
    const repository = { getAttempt: jest.fn().mockResolvedValue({ status: 'ready', format: 'pdf', delivery: 'download', storageRef: 'private-key', expiresAt: '2026-10-30T00:00:00Z' }) };
    const storage = { sign: jest.fn().mockResolvedValue('https://storage.test/private') };
    const service = new ReportsService(repository as never, storage as never);
    const signedIn = { ...principal, factorAgeSeconds: 86_400 };
    await expect(service.getReportAttempt(signedIn, '99000000-0000-4000-8000-000000000001', 'r', new Date('2026-10-29T00:00:00Z'))).resolves.toMatchObject({ downloadUrl: 'https://storage.test/private' });
    expect(repository.getAttempt).toHaveBeenCalledWith(signedIn, '99000000-0000-4000-8000-000000000001', 'r');
    expect(() => service.getAdminExport(signedIn, '99000000-0000-4000-8000-000000000001', 'r')).toThrow();
    repository.getAttempt.mockResolvedValue({ status: 'ready', format: 'pdf', delivery: 'email', storageRef: 'private-key', expiresAt: '2026-10-30T00:00:00Z' });
    await expect(service.getReportAttempt(signedIn, '99000000-0000-4000-8000-000000000001', 'r')).rejects.toMatchObject({ status: 403 });
    expect(storage.sign).toHaveBeenCalledTimes(1);
  });

  it('verifies an email recipient against the authenticated identity without persisting it', async () => {
    const repository = {
      captureSnapshot: jest.fn().mockResolvedValue({ attemptId: 'id', status: 'queued' }),
    };
    const identity = {
      getIdentityUser: jest
        .fn()
        .mockResolvedValue({ id: 'owner', primaryEmail: 'reports@example.test' }),
    };
    const service = new ReportsService(
      repository as never,
      undefined,
      undefined,
      identity as never,
    );
    await service.createReport(
      principal,
      { ...command, delivery: 'email', recipient: 'REPORTS@example.test' },
      'request-key',
      'r',
    );
    expect(repository.captureSnapshot).toHaveBeenCalledWith(
      principal,
      expect.objectContaining({ recipient: null }),
      'request-key',
      'r',
    );
    identity.getIdentityUser.mockResolvedValue({ id: 'owner', primaryEmail: 'other@example.test' });
    await expect(
      service.createReport(
        principal,
        { ...command, delivery: 'email', recipient: 'reports@example.test' },
        'request-key-2',
        'r',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('signs only ready, unexpired owner output and strips its private storage key', async () => {
    const repository = {
      getAttempt: jest.fn().mockResolvedValue({
        id: 'id',
        status: 'ready',
        storageRef: 'private-key',
        expiresAt: '2026-09-05T00:00:00.000Z',
      }),
    };
    const storage = { sign: jest.fn().mockResolvedValue('https://storage.test/private') };
    const service = new ReportsService(repository as never, storage as never);
    const result = (await service.getReportAttempt(
      principal,
      '99000000-0000-4000-8000-000000000001',
      'r',
      new Date('2026-09-04T00:00:00Z'),
    )) as Record<string, unknown>;
    expect(result.downloadUrl).toBe('https://storage.test/private');
    expect(result.downloadUrlExpiresAt).toBe('2026-09-04T00:05:00.000Z');
    expect(result.storageRef).toBeUndefined();
    expect(storage.sign).toHaveBeenCalledWith('private-key', 300);
  });

  it('never signs output beyond the report retention boundary', async () => {
    const repository = {
      getAttempt: jest.fn().mockResolvedValue({
        id: 'id',
        status: 'ready',
        storageRef: 'private-key',
        expiresAt: '2026-09-04T00:02:00.000Z',
      }),
    };
    const storage = { sign: jest.fn().mockResolvedValue('https://storage.test/private') };
    const service = new ReportsService(repository as never, storage as never);

    const result = (await service.getReportAttempt(
      principal,
      '99000000-0000-4000-8000-000000000001',
      'r',
      new Date('2026-09-04T00:00:00Z'),
    )) as Record<string, unknown>;

    expect(storage.sign).toHaveBeenCalledWith('private-key', 120);
    expect(result.downloadUrlExpiresAt).toBe('2026-09-04T00:02:00.000Z');
  });
});

it('preserves selected accounts, currency and captured timezone through validated report creation', async () => {
  const repository = {
    captureSnapshot: jest.fn().mockResolvedValue({ attemptId: 'id', status: 'queued' }),
  };
  const service = new ReportsService(repository as never);
  const id = '11111111-1111-4111-8111-111111111111';
  const principal = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 1 };
  const command = {
    type: 'financial_summary',
    periodStart: '2026-10-25',
    periodEnd: '2026-11-24',
    format: 'pdf',
    delivery: 'download',
    accountIds: [id],
    currency: 'KWD',
    timezone: 'Asia/Riyadh',
  };
  await service.createReport(principal, command, 'scoped-report-operation', 'request');
  expect(repository.captureSnapshot).toHaveBeenCalledWith(
    principal,
    expect.objectContaining({ accountIds: [id], currency: 'KWD', timezone: 'Asia/Riyadh' }),
    'scoped-report-operation',
    'request',
  );
  await expect(
    service.createReport(
      principal,
      { ...command, accountIds: ['owner-from-another-account'] },
      'invalid-report-operation',
      'request',
    ),
  ).rejects.toMatchObject({ status: 400 });
});
