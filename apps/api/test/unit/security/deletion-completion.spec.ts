import { createHash } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { DeletionCompletionController } from '../../../src/security/deletion-completion.controller';
import { ImmediateDeletionService } from '../../../src/security/immediate-deletion.service';

describe('deletion completion capability', () => {
  const operation = '18b575a1-d49a-4aa0-ae64-dda395441797';
  const token = 'a'.repeat(64);
  const request = { socket: { remoteAddress: '127.0.0.1' } };

  it('leaves legacy cooling API startup independent of worker credentials and manifest', async () => {
    const getRequired = jest.fn((key: string) => {
      if (key === 'MASARIFI_DELETION_COOLING_OFF_HOURS') return 72;
      throw new Error('LEGACY_API_MUST_NOT_REQUIRE_WORKER_CONFIGURATION');
    });
    const service = new ImmediateDeletionService({ getRequired } as never, {} as never);
    await service.onModuleDestroy();
    expect(getRequired).toHaveBeenCalledTimes(1);
    expect(() => service.runDeletionRequestForOwner('user_1', operation)).toThrow(HttpException);
  });

  it('uses only a hashed receipt and returns actual minimal completion without a Clerk session', async () => {
    const value = {
      id: operation,
      status: 'completed',
      completedAt: '2026-10-16T17:00:00Z',
      errorCode: null,
      version: 3,
    };
    const getCompletion = jest.fn(() => Promise.resolve({ rateLimited: false, value }));
    const controller = new DeletionCompletionController(
      { getCompletion } as never,
      { getRequired: () => 'inert-test-network-hash-secret' } as never,
    );
    await expect(
      controller.getCompletion(operation, `Bearer ${token}`, request as never),
    ).resolves.toEqual(value);
    expect(getCompletion).toHaveBeenCalledWith(
      operation,
      createHash('sha256').update(token).digest('hex'),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it.each([undefined, 'Bearer short', `Bearer ${'A'.repeat(64)}`, `Basic ${token}`])(
    'rejects malformed capabilities %s before lookup',
    async (authorization) => {
      const getCompletion = jest.fn();
      const controller = new DeletionCompletionController({ getCompletion } as never, {} as never);
      await expect(
        controller.getCompletion(operation, authorization, request as never),
      ).rejects.toMatchObject({ status: 404 });
      expect(getCompletion).not.toHaveBeenCalled();
    },
  );

  it.each([
    [false, 404],
    [true, 429],
  ])('reports missing or bounded receipts (%s)', async (rateLimited, status) => {
    const controller = new DeletionCompletionController(
      { getCompletion: () => Promise.resolve({ rateLimited, value: null }) } as never,
      { getRequired: () => 'inert-test-network-hash-secret' } as never,
    );
    await expect(
      controller.getCompletion(operation, `Bearer ${token}`, request as never),
    ).rejects.toMatchObject({ status });
  });
});
