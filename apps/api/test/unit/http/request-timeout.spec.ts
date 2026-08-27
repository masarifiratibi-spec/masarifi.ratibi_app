import { firstValueFrom, Observable, of } from 'rxjs';

import { RequestTimeoutInterceptor } from '../../../src/platform/http/request-timeout.interceptor';

describe('RequestTimeoutInterceptor', () => {
  it('passes values within the configured deadline', async () => {
    const interceptor = new RequestTimeoutInterceptor({
      get: () => 100,
    } as never);
    await expect(
      firstValueFrom(interceptor.intercept({} as never, { handle: () => of('ok') })),
    ).resolves.toBe('ok');
  });

  it('returns a safe timeout and unsubscribes stalled work', async () => {
    const teardown = jest.fn();
    const interceptor = new RequestTimeoutInterceptor({
      get: () => 10,
    } as never);
    const stalled = new Observable(() => teardown);

    await expect(
      firstValueFrom(interceptor.intercept({} as never, { handle: () => stalled })),
    ).rejects.toMatchObject({ status: 408 });
    expect(teardown).toHaveBeenCalledTimes(1);
  });
});
