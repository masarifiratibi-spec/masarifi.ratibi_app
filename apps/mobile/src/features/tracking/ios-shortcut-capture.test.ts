import { decodeIosShortcut, prepareIosShortcut } from './ios-shortcut-capture';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, text: string) =>
    jest
      .requireActual('node:crypto')
      .createHash('sha256')
      .update(text)
      .digest('hex')
}));

const token = 'aaaaaaaa-1111-4111-8111-111111111111';
const now = Date.parse('2026-11-16T12:00:00Z');
const message = {
  token,
  messageId: 'qa-message-001',
  sender: 'QA BANK',
  receivedAt: '2026-11-16T11:59:00Z',
  body: 'Purchase SAR 12.34 at QA SHOP card XX4242'
};
const link = (value: unknown) =>
  `masarifi://capture-ios?payload=${encodeURIComponent(JSON.stringify(value))}`;

test('captures a synthetic purchase with correct minor units without persisting source text', async () => {
  const input = decodeIosShortcut(link(message), now)!;
  const result = await prepareIosShortcut(input);
  expect(result).toMatchObject({
    amountMinor: 1234,
    currency: 'SAR',
    kind: 'expense'
  });
  expect(JSON.stringify(result)).not.toContain(message.body);
  expect(JSON.stringify(result)).not.toContain(token);
  expect(JSON.stringify(result)).not.toContain('4242');
});

test('replays have stable identity while two distinct identical messages retain distinct identities', async () => {
  const first = await prepareIosShortcut(message);
  const retry = await prepareIosShortcut({ ...message });
  const second = await prepareIosShortcut({
    ...message,
    messageId: 'qa-message-002'
  });
  expect(retry?.sourceItemKey).toBe(first?.sourceItemKey);
  expect(second?.sourceItemKey).not.toBe(first?.sourceItemKey);
});

test.each([
  'Your OTP is 123456 for purchase SAR 12.34',
  'رمز التحقق 123456 لشراء بقيمة 12.34 SAR',
  'Your balance is SAR 12.34',
  'Purchase SAR 12.34 failed',
  'Purchase SAR 12.34 pending',
  'SAR 12.34 refunded to card XX4242',
  'Transfer SAR 12.34 to account XX4242',
  'Hello from QA'
])('excludes unsafe or unsupported input locally: %s', async (body) => {
  expect(await prepareIosShortcut({ ...message, body })).toBeNull();
});

test.each([
  'masarifi://capture-ios?payload=%ZZ',
  link({ ...message, ownerId: 'external-owner' }),
  link({ ...message, accountId: 'external-account' }),
  link({ ...message, body: 'x'.repeat(2001) }),
  link({ ...message, messageId: '' }),
  link({ ...message, receivedAt: '2027-11-16T11:59:00Z' }),
  link({ ...message, receivedAt: '2026-10-16T11:59:00Z' }),
  link({ ...message, token: 'wrong' }),
  link(message) + '&payload=duplicate',
  link(message) + '#unexpected',
  link(message).replace('masarifi:', 'https:'),
  link(message).replace('capture-ios', 'user@capture-ios')
])(
  'rejects malformed/untrusted fields without throwing or echoing input',
  (url) => {
    expect(decodeIosShortcut(url, now)).toBeNull();
  }
);

test('extracts an incoming salary without reversing its sign', async () => {
  expect(
    await prepareIosShortcut({
      ...message,
      body: 'Salary SAR 5500.00 credited to account XX4242'
    })
  ).toMatchObject({ amountMinor: 550000, currency: 'SAR', kind: 'income' });
});
