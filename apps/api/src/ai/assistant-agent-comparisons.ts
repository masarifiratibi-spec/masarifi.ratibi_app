import type { AssistantDataQuery } from './assistant-agent-data';

interface SummaryRead {
  query: AssistantDataQuery;
  snapshot: { data: Record<string, unknown> };
}
interface ExactComparison {
  currency: string;
  kind: string;
  currentPeriod: unknown;
  previousPeriod: unknown;
  currentMinor: string;
  previousMinor: string;
  differenceMinor: string;
  percentageBasisPoints: string | null;
}
const object = (input: unknown): Record<string, unknown> =>
  input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
function totals(read: SummaryRead): Map<string, bigint> {
  const summaries = read.snapshot.data.summaries;
  if (!Array.isArray(summaries)) return new Map();
  return new Map(
    summaries.flatMap((entry) => {
      const row = object(entry);
      if (
        row.status !== 'confirmed' ||
        !['expense', 'income'].includes(String(row.kind)) ||
        !/^[A-Z]{3}$/u.test(String(row.currency)) ||
        !/^-?\d+$/u.test(String(row.amountMinor))
      )
        return [];
      return [
        [`${String(row.currency)}:${String(row.kind)}`, BigInt(String(row.amountMinor))] as const,
      ];
    }),
  );
}
function sameScope(left: SummaryRead, right: SummaryRead): boolean {
  return [
    'currency',
    'account',
    'category',
    'kind',
    'search',
    'minAmountMinor',
    'maxAmountMinor',
  ].every(
    (key) =>
      ((left.query as unknown as Record<string, unknown>)[key] ?? null) ===
      ((right.query as unknown as Record<string, unknown>)[key] ?? null),
  );
}

// Empty grouped sums are an exact zero only after a successful complete aggregate.
// Choose currencies from authenticated financial records, never the global currency catalog.
export function assistantPeriodTotals(reads: SummaryRead[]) {
  const knownCurrencies = new Set<string>();
  for (const { snapshot } of reads) {
    const data = snapshot.data;
    const records: unknown[] = [object(data.latestTransactionAllHistory).transaction];
    for (const collection of [
      object(data.accounts).items,
      object(data.transactions).items,
      data.summaries,
    ]) {
      if (Array.isArray(collection)) {
        const entries: unknown[] = collection;
        records.push(...entries);
      }
    }
    for (const entry of records) {
      const currency = object(entry).currency;
      if (typeof currency === 'string' && /^[A-Z]{3}$/u.test(currency))
        knownCurrencies.add(currency);
    }
  }
  return reads.flatMap((read, readIndex) => {
    const data = read.snapshot.data;
    if (data.status !== 'ok' || !Array.isArray(data.summaries)) return [];
    const kinds = read.query.kind
      ? ['expense', 'income'].filter((kind) => kind === read.query.kind)
      : ['expense', 'income'];
    const currencies = read.query.currency ? [read.query.currency] : Array.from(knownCurrencies);
    return currencies.flatMap((currency) =>
      kinds.map((kind) => {
        const rows = (data.summaries as unknown[])
          .map(object)
          .filter(
            (row) => row.currency === currency && row.kind === kind && row.status === 'confirmed',
          );
        return {
          readIndex,
          period: data.period,
          filters: read.query,
          currency,
          kind,
          confirmedMinor: rows
            .reduce((sum, row) => sum + BigInt(String(row.amountMinor)), 0n)
            .toString(),
          confirmedCount: rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
          completeConfirmedAggregate: true,
        };
      }),
    );
  });
}
export function assistantComparisons(reads: SummaryRead[]): ExactComparison[] {
  const available = reads.filter(
    (read) =>
      read.snapshot.data.status === 'ok' &&
      Array.isArray(read.snapshot.data.summaries) &&
      typeof object(read.snapshot.data.period).startDate === 'string',
  );
  const comparisons: ExactComparison[] = [];
  for (let index = 0; index < available.length; index += 1) {
    for (const other of available.slice(index + 1)) {
      const first = available[index];
      if (!first) continue;
      const firstStart = String(object(first.snapshot.data.period).startDate);
      const otherStart = String(object(other.snapshot.data.period).startDate);
      if (firstStart === otherStart || !sameScope(first, other)) continue;
      const [current, previous] = firstStart > otherStart ? [first, other] : [other, first];
      const currentTotals = totals(current),
        previousTotals = totals(previous);
      for (const key of new Set([...currentTotals.keys(), ...previousTotals.keys()])) {
        const amount = currentTotals.get(key) ?? 0n,
          baseline = previousTotals.get(key) ?? 0n;
        const difference = amount - baseline;
        const [currency, kind] = key.split(':');
        if (!currency || !kind) continue;
        comparisons.push({
          currency,
          kind,
          currentPeriod: current.snapshot.data.period,
          previousPeriod: previous.snapshot.data.period,
          currentMinor: amount.toString(),
          previousMinor: baseline.toString(),
          differenceMinor: difference.toString(),
          percentageBasisPoints:
            baseline === 0n
              ? null
              : ((difference * 10000n) / (baseline < 0n ? -baseline : baseline)).toString(),
        });
      }
    }
  }
  return comparisons;
}
