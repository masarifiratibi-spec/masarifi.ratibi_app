import {
  ExpoPushProvider,
  type HttpTransport,
} from '../../../src/engagement/notification.providers';

describe('DEV Expo receipts', () => {
  it('omits authorization when Expo enhanced push security is disabled', async () => {
    const transport = jest
      .fn<ReturnType<HttpTransport>, Parameters<HttpTransport>>()
      .mockResolvedValue({ status: 200, json: { data: {} } });
    await new ExpoPushProvider(transport, '').receipt('ticket');
    expect(transport.mock.calls[0]?.[0].headers).toEqual({ 'content-type': 'application/json' });
  });
  it.each([
    [{ status: 'ok' }, { status: 'confirmed' }],
    [
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'rejected', code: 'TOKEN_INVALID' },
    ],
    [undefined, { status: 'pending' }],
    [
      { status: 'error', message: 'private provider body' },
      { status: 'rejected', code: 'PROVIDER_REJECTED' },
    ],
  ])('separates provider receipt from send acceptance', async (receipt, expected) => {
    const transport = jest
      .fn()
      .mockResolvedValue({ status: 200, json: { data: { ticket: receipt } } });
    expect(await new ExpoPushProvider(transport, 'fixture').receipt('ticket')).toEqual(expected);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://exp.host/--/api/v2/push/getReceipts',
        body: { ids: ['ticket'] },
      }),
    );
  });
});
