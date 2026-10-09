import type { Account } from '@/domain/core-finance';
import type { KeywordRule } from '@/domain/app-shell';
import type { SenderRule } from '@/domain/automatic-tracking';
import type { RawSmsMessage } from '@/services/platform/sms-inbox-service';
import type { RawBankNotification } from '@/services/platform/bank-notification-service';
import { prepareFinancialMessageImport, prepareSmsImport } from './sms-import';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    require('crypto').createHash('sha256').update(value).digest('hex')
}));

const account = (patch: Partial<Account> = {}): Account => ({
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Primary',
  type: 'bank',
  currencyCode: 'SAR',
  openingBalanceMinor: 0,
  institution: 'Example Bank',
  lastFour: '4242',
  creditLimitMinor: null,
  statementDay: null,
  paymentDueDay: null,
  monthlyInterestRateBasisPoints: null,
  minimumPaymentMinor: null,
  automaticTrackingEnabled: true,
  isDefault: false,
  iconKey: null,
  colorKey: null,
  notes: null,
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
  ...patch
});

const message = (patch: Partial<RawSmsMessage> = {}): RawSmsMessage => ({
  id: '1',
  sender: 'EXAMPLEBANK',
  body: 'Paid 12.50 SAR with card 4242',
  receivedAt: 1_757_678_401_000,
  ...patch
});

const keyword = (value: string, enabled = true): KeywordRule => ({
  id: `keyword-${value}`,
  group: 'expense',
  language: 'en',
  value,
  normalizedValue: value.toLowerCase(),
  origin: 'custom',
  enabled
});

const sender = (enabled = true): SenderRule => ({
  id: 'sender-1',
  normalizedSender: 'examplebank',
  displayLabel: 'Example Bank',
  institutionKey: null,
  origin: 'custom',
  enabled,
  trusted: true,
  recentUseCount: 0,
  lastUsedAt: null,
  createdAt: 1,
  updatedAt: 1
});

const options = (patch: Record<string, unknown> = {}) => ({
  keywordRules: [],
  senderRules: [sender()],
  accounts: [account()],
  knownFingerprints: new Set<string>(),
  deviceId: 'test-device-00000001',
  ...patch
});
describe('financial capture preparation', () => {
  it.each([
    'OTP 123456 purchase SAR 12',
    'payee addition request SAR 12',
    'Purchase SAR 12 declined',
    'Purchase SAR 12 failed',
    'Purchase SAR 12 cancelled',
    'شراء SAR 12 تم رفض العملية'
  ])('never captures excluded lifecycle: %s', async (body) => {
    const result = await prepareSmsImport([message({ body })], options());
    expect(result.events).toHaveLength(0);
    expect(result.skippedFingerprints).toHaveLength(1);
  });
  it.each(['SAR', 'AED', 'USD', 'EUR', 'GBP', 'EGP', 'QAR'])(
    'extracts supported currency %s',
    async (currency) => {
      const result = await prepareSmsImport(
        [message({ body: 'Paid ' + currency + '12.50 with card XX4242' })],
        options({ accounts: [account({ currencyCode: currency })] })
      );
      expect(result.events[0]).toMatchObject({
        amountMinor: -1250,
        currency,
        kind: 'expense',
        accountId: account().id,
        classification: {
          disposition: 'capture_candidate',
          direction: 'outgoing'
        }
      });
    }
  );
  it.each([
    'credited AED12.50',
    'deposit AED12.50',
    'cash withdrawal AED12.50',
    'transfer to SAMPLE AED12.50',
    'AED12.50 refunded',
    'AED12.50 refunded will be credited within 2-3 working days'
  ])('retains accounting ambiguity: %s', async (body) => {
    const event = (
      await prepareSmsImport(
        [message({ body })],
        options({ accounts: [account({ currencyCode: 'AED' })] })
      )
    ).events[0];
    expect(event?.classification?.disposition).toBe('review');
    expect(event?.kind).not.toBe('income');
  });
  it('treats explicit salary as income', async () => {
    const event = (
      await prepareSmsImport([message({ body: 'Salary SAR 1200' })], options())
    ).events[0];
    expect(event).toMatchObject({ amountMinor: 120000, kind: 'income' });
  });
  it('keeps transaction amount separate from balance and fees', async () => {
    const event = (
      await prepareSmsImport(
        [
          message({
            body: 'Debit Card XX4242 was used for AED126.50 at SAMPLE SHOP, AE. Available Balance AED8126.03 fee AED2.00'
          })
        ],
        options({ accounts: [account({ currencyCode: 'AED' })] })
      )
    ).events[0];
    expect(event).toMatchObject({
      amountMinor: -12650,
      merchant: 'SAMPLE SHOP'
    });
  });
  it('normalizes Arabic numbers and du bill acknowledgement without bank account inference', async () => {
    const event = (
      await prepareSmsImport(
        [
          message({
            sender: 'du',
            body: 'شكراً على سدادك مبلغ ٥٠.٠٠ درهم لحسابك 1.99999999. الرقم المرجعي للمعاملة هو 999999999'
          })
        ],
        options({
          accounts: [account({ currencyCode: 'AED' })],
          senderRules: [{ ...sender(), normalizedSender: 'du' }]
        })
      )
    ).events[0];
    expect(event).toMatchObject({
      amountMinor: -5000,
      kind: 'expense',
      classification: { instruments: [], subtype: 'bill_payment' }
    });
  });
  it('holds unsupported SEK and ambiguous embedded dates', async () => {
    const events = (
      await prepareSmsImport(
        [
          message({ id: 'sek', body: 'credited SEK 123.45' }),
          message({ id: 'date', body: 'Paid SAR 12 on 26-09-26 08:56' })
        ],
        options()
      )
    ).events;
    expect(events).toHaveLength(2);
    expect(
      events.every((e) => e.classification?.disposition === 'review')
    ).toBe(true);
  });
  it('retains explicit unmatched/conflicting instruments without default fallback', async () => {
    const event = (
      await prepareSmsImport(
        [message({ body: 'Paid SAR 12 card XX9999 account XX004242' })],
        options({ accounts: [account({ isDefault: true })] })
      )
    ).events[0];
    expect(event?.accountId).toBeUndefined();
    expect(event?.classification?.reasonCodes).toContain('ambiguous_account');
  });
  it('only uses a binding for the resolved provider', async () => {
    const result = await prepareSmsImport(
      [
        message({
          sender: 'ADCBAlert',
          body: 'Debit card XX9999 linked to acc. XX004242 was used for AED12'
        })
      ],
      options({
        accounts: [account({ currencyCode: 'AED', lastFour: '1111' })],
        bindings: [
          {
            provider: 'alinma',
            role: 'card',
            suffix: '9999',
            accountId: account().id
          },
          {
            provider: 'alinma',
            role: 'account',
            suffix: '004242',
            accountId: account().id
          }
        ]
      })
    );
    expect(result.events[0]?.accountId).toBeUndefined();
  });
  it('holds an untrusted sender even with a matching account', async () => {
    const event = (
      await prepareSmsImport([message()], options({ senderRules: [] }))
    ).events[0];
    expect(event?.classification?.reasonCodes).toContain('source_untrusted');
  });
  it.each([
    { status: 'archived' },
    { automaticTrackingEnabled: false },
    { type: 'cash' },
    { type: 'investment' }
  ])('never selects ineligible account %j', async (patch) => {
    const event = (
      await prepareSmsImport(
        [message()],
        options({ accounts: [account(patch as Partial<Account>)] })
      )
    ).events[0];
    expect(event?.accountId).toBeUndefined();
  });
  it('keeps distinct identical-body SMS native IDs and stable replay identity', async () => {
    const input = [message({ id: '1' }), message({ id: '2' })];
    const first = await prepareSmsImport(input, options());
    expect(first.events).toHaveLength(2);
    expect(first.events[0]?.sourceItemKey).not.toBe(
      first.events[1]?.sourceItemKey
    );
    const replay = await prepareSmsImport(
      input,
      options({
        knownFingerprints: new Set(first.events.map((e) => e.sourceItemKey))
      })
    );
    expect(replay.events).toHaveLength(0);
  });
  it('acknowledges notification revisions only after the caller commits them', async () => {
    const notification: RawBankNotification = {
      key: 'revision1',
      nativeKey: 'native1',
      packageName: 'com.bank',
      title: 'Bank',
      text: 'Paid SAR 12',
      postedAt: 100
    };
    const first = await prepareFinancialMessageImport(
      [notification],
      options({ senderRules: [{ ...sender(), normalizedSender: 'com.bank' }] })
    );
    const second = await prepareFinancialMessageImport(
      [{ ...notification, key: 'revision2', text: 'Paid SAR 12.00' }],
      options()
    );
    expect(first.consumedSourceKeys).toEqual(['revision1']);
    expect(second.events[0]?.transport?.nativeIdDigest).toBe(
      first.events[0]?.transport?.nativeIdDigest
    );
    expect(second.events[0]?.sourceItemKey).not.toBe(
      first.events[0]?.sourceItemKey
    );
  });
  it('does not deduplicate SMS and notifications by similar text', async () => {
    const result = await prepareFinancialMessageImport(
      [
        message(),
        {
          key: 'notification',
          packageName: 'com.bank',
          title: '',
          text: message().body,
          postedAt: message().receivedAt
        }
      ],
      options()
    );
    expect(result.events).toHaveLength(2);
  });
  it('retains custom wording as review without guessing earned income', async () => {
    const result = await prepareSmsImport(
      [message({ body: 'Funding SAR 12' })],
      options({ keywordRules: [{ ...keyword('Funding'), group: 'income' }] })
    );
    expect(result.events[0]).toMatchObject({
      classification: { disposition: 'review', subtype: 'generic_credit' }
    });
    expect(result.events[0]?.kind).toBeUndefined();
  });
  it('disabling action wording prevents automatic eligibility', async () => {
    const result = await prepareSmsImport(
      [message()],
      options({ keywordRules: [keyword('paid', false)] })
    );
    expect(result.events[0]?.classification?.disposition).toBe('review');
  });
  it('contains no raw body or reference number in durable financial payload', async () => {
    const result = await prepareSmsImport(
      [message({ body: 'Paid SAR12 reference ABC123456' })],
      options()
    );
    expect(result.events[0]?.body).toBeUndefined();
    expect(JSON.stringify(result.events)).not.toContain('ABC123456');
    expect(result.events[0]?.providerReferenceDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
