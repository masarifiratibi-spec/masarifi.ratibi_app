import { createSmsInboxService } from './sms-inbox-service';
import { createAndroidSmsInboxService } from './sms-inbox-service.android';

describe('SMS inbox platform service', () => {
  it('skips a blank native row between valid messages without aborting the batch', async () => {
    const first = {
      id: '1',
      sender: 'BANK',
      body: 'Purchase SAR 1',
      receivedAt: 100
    };
    const last = { ...first, id: '3' };
    const service = createAndroidSmsInboxService({
      readRecentSms: jest.fn(async () => [
        first,
        { ...first, id: '2', body: '' },
        last
      ]),
      isNetworkAvailable: jest.fn()
    });
    await expect(service.readRecent({ since: 0, limit: 100 })).resolves.toEqual(
      [first, last]
    );
  });
  it('keeps the scanned cursor of a filtered-empty native page', async () => {
    const native = {
      readRecentSms: jest.fn(),
      isNetworkAvailable: jest.fn(),
      readFinancialSmsPageV2: jest.fn(async () => ({
        version: 2,
        messages: [],
        lastScanned: { receivedAt: 100, id: '42' },
        hasMore: true,
        scanned: 1000
      }))
    };
    const service = createAndroidSmsInboxService(native);
    await expect(
      service.readPage!({ since: 0, limit: 50, ownerId: 'user_owner' })
    ).resolves.toMatchObject({
      messages: [],
      lastScanned: { receivedAt: 100, id: '42' },
      hasMore: true
    });
  });
  it('preserves the actual native read time separately from the SMS received time', async () => {
    const row = {
      id: '42',
      sender: 'BANK',
      body: 'fixture',
      receivedAt: 1000,
      observedAt: 2000
    };
    const service = createAndroidSmsInboxService({
      readRecentSms: jest.fn().mockResolvedValue([row]),
      isNetworkAvailable: jest.fn()
    });
    expect(await service.readRecent({ since: 0, limit: 1 })).toEqual([row]);
  });
  it('rejects an invalid native observation timestamp', async () => {
    const service = createAndroidSmsInboxService({
      readRecentSms: jest.fn().mockResolvedValue([
        {
          id: '42',
          sender: 'BANK',
          body: 'fixture',
          receivedAt: 1000,
          observedAt: -1
        }
      ]),
      isNetworkAvailable: jest.fn()
    });
    await expect(service.readRecent({ since: 0, limit: 1 })).resolves.toEqual(
      []
    );
  });
  it('is explicitly unavailable outside Android', async () => {
    const service = createSmsInboxService();

    expect(service.available).toBe(false);
    await expect(service.readRecent({ since: 1, limit: 100 })).resolves.toEqual(
      []
    );
    await expect(service.isNetworkAvailable()).resolves.toBe(false);
  });

  it('forwards bounded reads and validates native rows', async () => {
    const native = {
      readRecentSms: jest.fn().mockResolvedValue([
        {
          id: '42',
          sender: 'BANK',
          body: 'fixture body',
          receivedAt: 1_757_678_401_000
        }
      ]),
      isNetworkAvailable: jest.fn().mockResolvedValue(true)
    };
    const service = createAndroidSmsInboxService(native);

    await expect(
      service.readRecent({ since: 1_757_678_400_000, limit: 100 })
    ).resolves.toEqual([
      {
        id: '42',
        sender: 'BANK',
        body: 'fixture body',
        receivedAt: 1_757_678_401_000
      }
    ]);
    expect(native.readRecentSms).toHaveBeenCalledWith(1_757_678_400_000, 100);
    await expect(service.isNetworkAvailable()).resolves.toBe(true);
  });

  it.each([
    [{ id: '', sender: 'BANK', body: 'body', receivedAt: 1 }],
    [{ id: '1', sender: null, body: 'body', receivedAt: 1 }],
    [{ id: '1', sender: 'BANK', body: 42, receivedAt: 1 }],
    [{ id: '1', sender: 'BANK', body: 'body', receivedAt: -1 }]
  ])('skips invalid native rows %#', async (rows) => {
    const service = createAndroidSmsInboxService({
      readRecentSms: jest.fn().mockResolvedValue([rows]),
      isNetworkAvailable: jest.fn().mockResolvedValue(false)
    });

    await expect(service.readRecent({ since: 0, limit: 10 })).resolves.toEqual(
      []
    );
  });

  it('rejects invalid read bounds before calling native code', async () => {
    const native = {
      readRecentSms: jest.fn(),
      isNetworkAvailable: jest.fn()
    };
    const service = createAndroidSmsInboxService(native);

    await expect(service.readRecent({ since: -1, limit: 101 })).rejects.toThrow(
      'sms_inbox_invalid_request'
    );
    expect(native.readRecentSms).not.toHaveBeenCalled();
  });
});
