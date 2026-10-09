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
  it('keeps a transfer to another owned but tracking-disabled account in review', async () => {
    const event = (
      await prepareSmsImport(
        [
          message({
            body: 'Outgoing transfer SAR8.49 from account XX4242 to account XX2323'
          })
        ],
        options({
          accounts: [
            account(),
            account({
              id: '10000000-0000-4000-8000-000000000003',
              lastFour: '2323',
              automaticTrackingEnabled: false
            })
          ]
        })
      )
    ).events[0];
    expect(event).toMatchObject({
      kind: 'transfer',
      classification: { disposition: 'review' }
    });
    expect(event?.classification?.reasonCodes).toContain(
      'transfer_counterparty_required'
    );
  });
  it.each(['incoming', 'outgoing'] as const)(
    'classifies an external %s transfer as ordinary income/expense without requiring a counterpart mapping',
    async (direction) => {
      const body =
        direction === 'incoming'
          ? 'Incoming transfer SAR8.47 to account XX4242'
          : 'Outgoing transfer SAR8.48 from account XX4242 to Ahmed';
      const event = (await prepareSmsImport([message({ body })], options()))
        .events[0];
      expect(event).toMatchObject({
        kind: direction === 'incoming' ? 'income' : 'expense',
        accountId: account().id,
        classification: {
          direction,
          subtype:
            direction === 'incoming' ? 'transfer_received' : 'transfer_sent',
          disposition: 'capture_candidate',
          reasonCodes: []
        }
      });
      expect(event?.destinationAccountId).toBeUndefined();
    }
  );
  it('uses only a previously confirmed cash destination for a withdrawal', async () => {
    const bank = account({ currencyCode: 'AED' });
    const cash = account({
      id: '10000000-0000-4000-8000-000000000002',
      type: 'cash',
      currencyCode: 'AED',
      lastFour: null
    });
    const input = message({
      sender: 'ADCBAlert',
      body: 'Cash withdrawal AED8.19 card XX4242'
    });
    const unmapped = (
      await prepareSmsImport([input], options({ accounts: [bank, cash] }))
    ).events[0];
    expect(unmapped?.destinationAccountId).toBeUndefined();
    expect(unmapped?.classification?.reasonCodes).toContain(
      'cash_destination_required'
    );
    const configured = {
      accounts: [bank, cash],
      senderRules: [{ ...sender(), normalizedSender: 'adcbalert' }],
      bindings: [
        {
          provider: 'adcb',
          role: 'cash_card',
          suffix: '4242',
          accountId: cash.id
        }
      ]
    };
    const mapped = (await prepareSmsImport([input], options(configured)))
      .events[0];
    expect(mapped).toMatchObject({
      kind: 'transfer',
      accountId: bank.id,
      destinationAccountId: cash.id,
      amountMinor: -819,
      currency: 'AED',
      classification: {
        subtype: 'withdrawal',
        direction: 'outgoing',
        disposition: 'capture_candidate',
        reasonCodes: []
      }
    });
    const disabled = (
      await prepareSmsImport(
        [input],
        options({
          ...configured,
          accounts: [bank, { ...cash, automaticTrackingEnabled: false }]
        })
      )
    ).events[0];
    expect(disabled?.destinationAccountId).toBeUndefined();
    expect(disabled?.classification?.reasonCodes).toContain(
      'cash_destination_required'
    );
  });
  it('sends only a digest of the explicit original refund reference and keeps missing linkage in review', async () => {
    const event = (
      await prepareSmsImport(
        [
          message({
            body: 'Refund SAR 5 card XX4242 original reference OLD123456'
          })
        ],
        options()
      )
    ).events[0];
    expect(event?.originalProviderReferenceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(event?.providerReferenceDigest).toBeUndefined();
    expect(event?.metadata?.referenceScheme).toBe('plain-v2');
    expect(event?.classification?.reasonCodes).toContain(
      'original_transaction_required'
    );
    expect(JSON.stringify(event)).not.toContain('OLD123456');
  });
  it('records the SMS native observation time as provenance without replacing the bank event timestamp', async () => {
    const event = (
      await prepareSmsImport(
        [message({ observedAt: message().receivedAt + 5000 })],
        options()
      )
    ).events[0];
    expect(event?.metadata?.nativeObservedAt).toBe(message().receivedAt + 5000);
    expect(event?.receivedAt).toBe(
      new Date(message().receivedAt).toISOString()
    );
  });
  it('retains equal reference digests across unknown notification and trusted SMS without trusting the unknown source', async () => {
    const text = 'Purchase SAR 12 with card XX4242 reference ABC123456';
    const captures = await prepareFinancialMessageImport(
      [
        message({ body: text }),
        {
          key: 'app-reference',
          packageName: 'com.unknown.bank',
          title: '',
          text,
          postedAt: message().receivedAt
        }
      ],
      options()
    );
    expect(captures.events).toHaveLength(2);
    expect(captures.events[0]?.providerReferenceDigest).toBe(
      captures.events[1]?.providerReferenceDigest
    );
    expect(captures.events[1]?.metadata).toMatchObject({
      referenceScheme: 'plain-v2',
      sourcePackage: 'com.unknown.bank'
    });
    expect(captures.events[1]?.classification?.reasonCodes).toContain(
      'source_untrusted'
    );
    expect(JSON.stringify(captures.events)).not.toContain('ABC123456');
  });
  it('keeps numeric SMS source identity as a digest so configured trust can be checked without a raw phone number', async () => {
    const numeric = '+201012345678';
    const event = (
      await prepareSmsImport(
        [message({ sender: numeric })],
        options({ senderRules: [{ ...sender(), normalizedSender: numeric }] })
      )
    ).events[0];
    expect(event?.sender).toBeUndefined();
    expect(event?.metadata?.sourceIdentityDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event)).not.toContain(numeric);
  });
  it.each([
    [
      'تحويل صادر SAR 5 من حساب XX1111 إلى حساب XX2222',
      'outgoing',
      -500,
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002'
    ],
    [
      'Incoming transfer SAR 5 from account XX1111 to account XX2222',
      'incoming',
      500,
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001'
    ]
  ])(
    'resolves both owned transfer endpoints without converting movement into expense/income: %s',
    async (body, direction, amountMinor, accountId, destinationAccountId) => {
      const event = (
        await prepareSmsImport(
          [message({ body: String(body) })],
          options({
            accounts: [
              account({ lastFour: '1111' }),
              account({
                id: '10000000-0000-4000-8000-000000000002',
                lastFour: '2222'
              })
            ]
          })
        )
      ).events[0];
      expect(event).toMatchObject({
        kind: 'transfer',
        amountMinor,
        accountId,
        destinationAccountId,
        classification: {
          direction,
          status: 'completed',
          disposition: 'capture_candidate',
          reasonCodes: []
        }
      });
    }
  );
  it('binds eligibility to the exact owner configuration used for capture', async () => {
    const configurationRevision = 'b'.repeat(64);
    const event = (
      await prepareSmsImport([message()], options({ configurationRevision }))
    ).events[0];
    expect(event?.metadata?.ruleConfigurationRevision).toBe(
      configurationRevision
    );
  });
  it.each(['Hello SAR 5', 'MyBank alert SAR 5', 'Available Balance SAR 5'])(
    'discards weak unknown content without submitting financial fields: %s',
    async (body) => {
      const result = await prepareSmsImport(
        [message({ body, sender: 'UNKNOWN' })],
        options({ keywordRules: [keyword('MyBank alert')] })
      );
      expect(result.events).toHaveLength(0);
    }
  );
  it('blocks a disabled source even if its content is strongly financial', async () => {
    const result = await prepareSmsImport(
      [message()],
      options({ senderRules: [sender(false)] })
    );
    expect(result.events).toHaveLength(0);
  });
  it('retains unknown strong evidence without assigning the single currency account', async () => {
    const result = await prepareSmsImport(
      [message({ sender: 'UNKNOWN', body: 'Purchase SAR 5' })],
      options()
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.accountId).toBeUndefined();
    expect(result.events[0]?.classification?.reasonCodes).toContain(
      'source_untrusted'
    );
  });
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
    if (!body.startsWith('deposit')) expect(event?.kind).not.toBe('income');
  });
  it.each([
    'Deposited SAR 5 to account XX4242',
    'SAR 5 credited to account XX4242'
  ])('prepares a complete bank credit as ordinary income: %s', async (body) => {
    const event = (await prepareSmsImport([message({ body })], options()))
      .events[0];
    expect(event).toMatchObject({
      kind: 'income',
      amountMinor: 500,
      accountId: account().id,
      classification: {
        direction: 'incoming',
        status: 'completed',
        disposition: 'capture_candidate'
      }
    });
  });
  it('does not map a trusted EGP notification to the only EGP account without instrument proof', async () => {
    const event = (
      await prepareSmsImport(
        [message({ body: 'Payment EGP 5' })],
        options({ accounts: [account({ currencyCode: 'EGP' })] })
      )
    ).events[0];
    expect(event?.accountId).toBeUndefined();
    expect(event?.classification?.reasonCodes).toContain('ambiguous_account');
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
  it('custom wording without independent financial evidence cannot invent income', async () => {
    const result = await prepareSmsImport(
      [message({ body: 'Funding SAR 12' })],
      options({ keywordRules: [{ ...keyword('Funding'), group: 'income' }] })
    );
    expect(result.events).toHaveLength(0);
  });
  it('disabling action wording prevents automatic eligibility', async () => {
    const result = await prepareSmsImport(
      [message()],
      options({ keywordRules: [keyword('paid', false)] })
    );
    expect(result.events).toHaveLength(0);
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
