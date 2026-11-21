import { createLiveAssistantApiService } from './assistant-api-service';

it('preserves an actual server403 as a denial for saved Assistant history', async () => {
  const request = jest.fn(
    async () =>
      ({
        ok: false,
        status: 403,
        json: async () => ({ code: 'FORBIDDEN' })
      }) as Response
  );
  const service = createLiveAssistantApiService({
    baseUrl: 'https://inert.invalid',
    token: async () => 'fixture-token',
    request
  });
  await expect(service.listConversations({})).rejects.toMatchObject({
    code: 'forbidden'
  });
  expect(request).toHaveBeenCalledTimes(1);
});
