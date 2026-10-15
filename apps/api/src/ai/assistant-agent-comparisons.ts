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
