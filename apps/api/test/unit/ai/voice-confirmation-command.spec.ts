import { voiceDecision } from '../../../src/ai/ai.dto';

const operation = '99000000-0000-4000-8000-000000000001';
const fields = {
  amountMinor: '1250',
  currency: 'SAR',
  categoryId: operation,
  accountId: operation,
  date: '2026-10-02',
  merchant: null,
  note: null,
};
const decision = {
  expectedVersion: 4,
  editedFields: fields,
  reason: null,
  occurredAt: '2026-10-01T21:00:00.000Z',
  timezoneOffsetMinutes: -180,
};
it('normalizes today in Riyadh before UTC noon using the reviewed local date', () => {
  expect(voiceDecision(decision, operation, new Date('2026-10-02T06:00:00Z'))).toMatchObject({
    command: {
      occurredAt: '2026-10-01T21:00:00.000Z',
      amountMinor: 1250,
      source: 'voice',
      externalRef: 'voice:' + operation,
    },
  });
});
it.each([
  { ...decision, occurredAt: '2026-10-02T21:00:00.000Z' },
  { ...decision, editedFields: { ...fields, date: '2026-02-30' } },
  { ...decision, editedFields: { ...fields, amountMinor: '9007199254740992' } },
  { ...decision, editedFields: { ...fields, note: 'bad\u0001text' } },
  { ...decision, editedFields: { ...fields, accountId: null } },
  { ...decision, editedFields: { ...fields, categoryId: null } },
])('rejects an invalid date, amount or reference before a confirmation claim', (body) => {
  expect(() => voiceDecision(body, operation, new Date('2026-10-02T06:00:00Z'))).toThrow();
});
