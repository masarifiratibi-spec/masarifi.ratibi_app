import { SecurityService } from '../../../src/security/security.service';

describe('immediate account deletion admission', () => {
  const operationId = '9d04a565-4fe1-4e37-89a8-cb1323d65651';

  it.each([
    [undefined, operationId],
    ['short', operationId],
    ['A'.repeat(64), operationId],
    ['a'.repeat(64), 'non-uuid-operation'],
  ])(
    'requires a strong recovery capability and bound operation before execution (%s, %s)',
    async (token, key) => {
      const execute = jest.fn();
      const service = new SecurityService(
        { consumeRateLimit: () => Promise.resolve(true), execute } as never,
        { get: () => 600, getRequired: () => 0 } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        service.execute({
          operation: 'createMyDeletionRequest',
          principal: {
            userId: 'user_disposable',
            sessionId: 'session_disposable',
            factorAgeSeconds: 0,
          },
          body: {
            confirmation: 'DELETE_MY_ACCOUNT',
            ...(token === undefined ? {} : { completionToken: token }),
          },
          query: {},
          params: {},
          requestId: 'request-1',
          idempotencyKey: key,
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
