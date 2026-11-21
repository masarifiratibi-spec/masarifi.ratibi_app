import { correlatedStorageFetch } from '../../../src/platform/storage/storage-configuration';
import { logContext } from '../../../src/platform/observability/log-context';

it('forwards the API correlation without changing storage credentials, cancellation or caller headers', async () => {
  const fetcher = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(new Response('{}'));
  const correlated = correlatedStorageFetch(fetcher);
  const headers = { authorization: 'Bearer fixture-storage-key', apikey: 'fixture-storage-key' };
  const controller = new AbortController();
  await logContext.run({ requestId: 'fixture-api-request' }, () =>
    correlated('https://api.example.test/storage', {
      method: 'POST',
      headers,
      signal: controller.signal,
    }),
  );
  const sent = fetcher.mock.calls[0]?.[1];
  expect(new Headers(sent?.headers).get('x-request-id')).toBe('fixture-api-request');
  expect(new Headers(sent?.headers).get('authorization')).toBe(headers.authorization);
  expect(sent?.signal).toBe(controller.signal);
  expect(headers).not.toHaveProperty('x-request-id');
  await correlated('https://api.example.test/storage', { headers });
  expect(fetcher.mock.calls[1]?.[1]?.headers).toBe(headers);
});
