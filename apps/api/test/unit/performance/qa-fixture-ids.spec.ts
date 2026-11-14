import {
  decodeLedgerCursor,
  encodeLedgerCursor,
  normalizeTransactionId,
} from '../../../src/ledger/ledger.dto';
import { isUuid, normalizeCreateCategory } from '../../../src/reference/reference.dto';
import { normalizeSummaryQuery } from '../../../src/reports/reports.dto';
import { normalizeQaSetupOperation } from '../../performance/qa-api/qa-ledger-setup';

interface FixtureIds {
  accounts: { id: string }[];
  categories: { id: string }[];
  expected: { transactions: { id: string }[] };
}
const { fixtureId, buildFixture } = jest.requireActual<{
  fixtureId: (owner: string, table: string, ordinal: number) => string;
  buildFixture: (tier: number) => FixtureIds;
}>('../../../../../scripts/qa/performance/fixture-oracle.cjs');
const { buildSecondaryFixture } = jest.requireActual<{ buildSecondaryFixture: () => FixtureIds }>(
  '../../../../../scripts/qa/performance/secondary-fixture.cjs',
);
const v1 = 'ef49189b-35aa-5cfe-bd2d-8102d4529136';
const { buildAdmissionFixture } = jest.requireActual<{ buildAdmissionFixture: () => FixtureIds }>(
  '../../../../../scripts/qa/performance/admission-fixture.cjs',
);
const current = fixtureId('owner', 'transactions', 1);
const occurredAt = '2025-01-15T09:00:00.000Z';

describe('fixture identifiers against real API contracts', () => {
  it('admits every five-owner financial ID through real v4 predicates without collisions', () => {
    const seen = new Set<string>();
    for (const fixture of [
      ...[0, 1000, 10000].map(buildFixture),
      buildSecondaryFixture(),
      buildAdmissionFixture(),
    ]) {
      for (const row of [
        ...fixture.accounts,
        ...fixture.categories,
        ...fixture.expected.transactions,
      ]) {
        expect(normalizeTransactionId(row.id)).toBe(row.id);
        expect(isUuid(row.id)).toBe(true);
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
    }
    expect(seen.size).toBe(11045);
  });
  it.each([
    [v1, false],
    [current, true],
  ] as const)('enforces actual reference/report/ledger/cursor contracts for %s', (id, accepted) => {
    const boundaries = [
      () => normalizeTransactionId(id),
      () =>
        normalizeCreateCategory({
          kind: 'expense',
          labelAr: 'اختبار',
          labelEn: 'QA',
          parentId: id,
        }),
      () =>
        normalizeSummaryQuery(
          { type: 'financial_summary', period: 'monthly', accountIds: id },
          true,
        ),
      () =>
        normalizeQaSetupOperation({
          kind: 'createTransaction',
          body: {
            kind: 'income',
            amountMinor: 100,
            currency: 'SAR',
            accountId: id,
            categoryId: id,
            title: 'QA',
            occurredAt,
          },
        }),
      () =>
        normalizeQaSetupOperation({
          kind: 'transfer',
          body: {
            sourceAccountId: id,
            destinationAccountId: '00000000-0000-4000-8000-000000000001',
            amountMinor: 100,
            currency: 'SAR',
            title: 'QA',
            occurredAt,
          },
        }),
      () =>
        normalizeQaSetupOperation({
          kind: 'reviseTransaction',
          transactionId: id,
          body: { expectedVersion: 1, categoryId: id, reason: 'QA' },
        }),
      () =>
        normalizeQaSetupOperation({
          kind: 'reverseTransaction',
          transactionId: id,
          body: { expectedVersion: 1, occurredAt, reason: 'QA' },
        }),
      () => decodeLedgerCursor(encodeLedgerCursor({ id, occurredAt })),
    ];
    expect(isUuid(id)).toBe(accepted);
    for (const invoke of boundaries) {
      if (accepted) expect(invoke).not.toThrow();
      else expect(invoke).toThrow();
    }
    if (accepted)
      expect(decodeLedgerCursor(encodeLedgerCursor({ id, occurredAt }))).toEqual({
        id,
        occurredAt,
      });
  });
});
