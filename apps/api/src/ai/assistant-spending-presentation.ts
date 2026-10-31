import type { AssistantFact } from './assistant-agent';
import type { AssistantDataQuery } from './assistant-agent-data';
import { assistantComparisons, assistantPeriodTotals } from './assistant-agent-comparisons';
import { redactAiText } from './ai.schemas';

type Read = { query: AssistantDataQuery; snapshot: { data: Record<string, unknown> } };
type Period = { startDate: string; endDate: string };
type Format = (value: string, key: string, parent: Record<string, unknown>) => string;
export interface SpendingPresentation {
  version: 1;
  locale: 'ar' | 'en';
  cards: Array<{
    title: string;
    amount: string;
    period: string;
    comparisonNotice: string | null;
    comparison: null | {
      direction: 'up' | 'down' | 'flat';
      difference: string;
      percentage: string | null;
      previousAmount: string;
      previousPeriod: string;
    };
    explanation: string | null;
    saving: null | { text: string; target: string | null };
  }>;
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const rows = (v: unknown) =>
  Array.isArray(v)
    ? v.map(object)
    : Array.isArray(object(v).items)
      ? (object(v).items as unknown[]).map(object)
      : [];
const integer = (v: unknown): v is string => typeof v === 'string' && /^-?\d+$/u.test(v);
const period = (v: unknown): Period | undefined => {
  const p = object(v);
  return typeof p.startDate === 'string' &&
    typeof p.endDate === 'string' &&
    p.startDate <= p.endDate &&
    [p.startDate, p.endDate].every(
      (d) =>
        /^\d{4}-\d{2}-\d{2}$/u.test(d) &&
        Number.isFinite(Date.parse(`${d}T00:00Z`)) &&
        new Date(`${d}T00:00Z`).toISOString().slice(0, 10) === d,
    )
    ? { startDate: p.startDate, endDate: p.endDate }
    : undefined;
};
const samePeriod = (a: unknown, b: unknown) =>
  JSON.stringify(period(a)) === JSON.stringify(period(b));
const sameScope = (a: Read, b: Read) =>
  (!a.query.currency || !b.query.currency || a.query.currency === b.query.currency) &&
  ['account', 'category', 'kind', 'search', 'minAmountMinor', 'maxAmountMinor'].every(
    (k) =>
      (Reflect.get(a.query, k) ?? (k === 'kind' ? 'expense' : null)) ===
      (Reflect.get(b.query, k) ?? (k === 'kind' ? 'expense' : null)),
  );
const sameBasis = (a: Read, b: Read) =>
  (a.query.kind ?? null) === (b.query.kind ?? null) &&
  (a.query.currency ?? null) === (b.query.currency ?? null);

export function assistantPresentationLocale(question: string): 'ar' | 'en' {
  const normalized = question
    .normalize('NFKC')
    .replace(/[\u064b-\u065f\u0670]/gu, '')
    .replace(/[أإآ]/gu, 'ا');
  const englishRequest =
    /(?:جاوب(?:ني)?|رد|اجب|اكتب|خل(?:ي|ّ)?\s+الرد).{0,24}(?:بالانجليزي|باللغة الانجليزية)|\b(?:answer|reply|respond)\s+in\s+english\b|\bin english\s+please\b/iu;
  const negativeEnglish = /(?:لا|مو|مش)\s+(?:تجاوب|ترد|تكتب|بالانجليزي).{0,24}(?:انجليزي)?/u;
  if (englishRequest.test(normalized) && !negativeEnglish.test(normalized)) return 'en';
  return /[\u0600-\u06ff]/u.test(question) ? 'ar' : 'en';
}

function target(reads: Read[], fact: AssistantFact): number | undefined {
  const m = /^reads\[(\d+)\]\.data\.(summaries|financialEffects|items)\[(\d+)\]\.(\w+Minor)$/u.exec(
    fact.path,
  );
  if (!m) return undefined;
  const index = Number(m[1]),
    item = Number(m[3]),
    collection = m[2] ?? '',
    field = m[4] ?? '';
  if (m[2] === 'items' && index === reads.length + 1) {
    const total = assistantPeriodTotals(reads)[item];
    return total?.kind === 'expense' && m[4] === 'confirmedMinor' ? total.readIndex : undefined;
  }
  if (m[2] === 'items' && index === reads.length) {
    const c = assistantComparisons(reads)[item];
    if (
      c?.kind !== 'expense' ||
      !['currentMinor', 'previousMinor', 'differenceMinor'].includes(field)
    )
      return undefined;
    const candidates = reads
      .map((r, i) =>
        samePeriod(r.snapshot.data.period, c.currentPeriod) &&
        assistantPeriodTotals([r]).some(
          (t) =>
            t.kind === 'expense' &&
            t.currency === c.currency &&
            t.confirmedMinor === c.currentMinor,
        )
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    const first = candidates[0] === undefined ? undefined : reads[candidates[0]];
    return first &&
      candidates.every((i) => {
        const candidate = reads[i];
        return candidate && sameScope(first, candidate);
      })
      ? candidates[0]
      : undefined;
  }
  const read = reads[index];
  if (!read || read.snapshot.data.status !== 'ok') return undefined;
  const r = rows(read.snapshot.data[collection])[item];
  if (
    collection === 'summaries' &&
    r &&
    !assistantPeriodTotals([read]).some(
      (t) =>
        t.kind === 'expense' && t.currency === r.currency && t.confirmedMinor === r.amountMinor,
    )
  )
    return undefined;
  return r &&
    integer(r[field]) &&
    ((m[2] === 'financialEffects' && m[4] === 'expenseMinor') ||
      (m[2] === 'summaries' &&
        r.kind === 'expense' &&
        r.status === 'confirmed' &&
        m[4] === 'amountMinor'))
    ? index
    : undefined;
}
function references(answer: string, facts: AssistantFact[]) {
  return Array.from(answer.matchAll(/\{\{(F\d+)\}\}/gu)).flatMap((m) => {
    const fact = facts.find((f) => f.key === m[1]);
    return fact ? [fact] : [];
  });
}
export function selectSpendingSummaryRead(
  reads: Read[],
  answer: string,
  facts: AssistantFact[],
): Read | undefined {
  const allRefs = references(answer, facts);
  const refs = allRefs.filter((f) => /Minor$/u.test(f.path));
  if (
    allRefs.some(
      (f) =>
        !/Minor$/u.test(f.path) &&
        !/\.period\.(?:startDate|endDate)$/u.test(f.path) &&
        !/\.percentageBasisPoints$/u.test(f.path),
    )
  )
    return undefined;
  const first = refs[0];
  if (!first) return undefined;
  if (target(reads, first) === undefined) return undefined;
  const anchors = refs.flatMap((f) => {
    const i = target(reads, f);
    return i === undefined || !reads[i] ? [] : [reads[i]];
  });
  const selected = anchors.sort((a, b) =>
    String(object(b.snapshot.data.period).startDate).localeCompare(
      String(object(a.snapshot.data.period).startDate),
    ),
  )[0];
  if (!selected || !period(selected.snapshot.data.period) || selected.snapshot.data.status !== 'ok')
    return undefined;
  for (const f of refs) {
    const i = target(reads, f);
    const category =
      /^reads\[(\d+)\]\.data\.topExpenseCategories(?:\.items)?\[\d+\]\.amountMinor$/u.exec(f.path);
    const source = i === undefined ? (category ? reads[Number(category[1])] : undefined) : reads[i];
    if (!source || source.snapshot.data.status !== 'ok' || !sameScope(selected, source))
      return undefined;
  }
  return selected;
}
export function previousSpendingPeriod(p: Period): Period | undefined {
  if (
    !period(p) ||
    !p.startDate.endsWith('-01') ||
    p.startDate.slice(0, 7) !== p.endDate.slice(0, 7)
  )
    return undefined;
  const start = new Date(`${p.startDate}T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
  const priorStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const currentMonthLastDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  if (Number(p.endDate.slice(-2)) !== currentMonthLastDay)
    end.setUTCDate(Math.min(Number(p.endDate.slice(-2)), end.getUTCDate()));
  return {
    startDate: priorStart.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function buildSpendingPresentation({
  reads,
  answer,
  facts,
  locale,
  format,
  additionalPrevious,
}: {
  reads: Read[];
  answer: string;
  facts: AssistantFact[];
  locale: 'ar' | 'en';
  format: Format;
  additionalPrevious?: Read;
}): SpendingPresentation | undefined {
  const selected = selectSpendingSummaryRead(reads, answer, facts);
  if (!selected) return undefined;
  const refs = references(answer, facts);
  const all = additionalPrevious ? [...reads, additionalPrevious] : reads;
  const currentPeriod = period(selected.snapshot.data.period);
  if (!currentPeriod) return undefined;
  // An overview and an expense-only query can agree, but refunds/fees may make
  // their bases differ. Verify every differently filtered kind/currency reference
  // against an actual same-basis read before displaying a compact card.
  for (const f of refs.filter((f) => /Minor$/u.test(f.path))) {
    const category =
      /^reads\[(\d+)\]\.data\.topExpenseCategories(?:\.items)?\[(\d+)\]\.amountMinor$/u.exec(
        f.path,
      );
    const index = target(reads, f) ?? (category ? Number(category[1]) : undefined);
    const source = index === undefined ? undefined : reads[index];
    if (!source || sameBasis(source, selected)) continue;
    const canonical = all.find(
      (r) =>
        r.snapshot.data.status === 'ok' &&
        sameScope(r, selected) &&
        sameBasis(r, selected) &&
        samePeriod(r.snapshot.data.period, source.snapshot.data.period),
    );
    if (!canonical) return undefined;
    const expense = (r: Read) =>
      assistantPeriodTotals([r]).find((t) => t.kind === 'expense' && t.currency === f.currency)
        ?.confirmedMinor;
    if (expense(source) === undefined || expense(source) !== expense(canonical)) return undefined;
    if (category) {
      const row = rows(source.snapshot.data.topExpenseCategories)[Number(category[2])];
      const counterpart = rows(canonical.snapshot.data.topExpenseCategories).find(
        (r) => r.currency === row?.currency && r.category === row?.category,
      );
      if (!row || !counterpart || row.amountMinor !== counterpart.amountMinor) return undefined;
    }
  }
  const comparisons = assistantComparisons(
    all.filter((r) => sameScope(r, selected) && sameBasis(r, selected)),
  );
  const originalComparisons = assistantComparisons(reads);
  for (const f of refs) {
    const derived =
      /^reads\[(\d+)\]\.data\.items\[(\d+)\]\.(currentMinor|previousMinor|differenceMinor|percentageBasisPoints)$/u.exec(
        f.path,
      );
    if (!derived || Number(derived[1]) !== reads.length) continue;
    const original = originalComparisons[Number(derived[2])];
    const field = derived[3];
    if (
      !original ||
      !field ||
      !comparisons.some(
        (c) =>
          c.currency === original.currency &&
          c.kind === original.kind &&
          samePeriod(c.currentPeriod, original.currentPeriod) &&
          samePeriod(c.previousPeriod, original.previousPeriod) &&
          Reflect.get(c, field) === Reflect.get(original, field),
      )
    )
      return undefined;
  }
  const currencies = new Set(refs.flatMap((f) => (f.currency ? [f.currency] : [])));
  const totals = assistantPeriodTotals([selected]).filter(
    (t) => t.kind === 'expense' && currencies.has(t.currency),
  );
  if (!totals.length) return undefined;
  const ar = locale === 'ar';
  const dateRange = (p: Period) =>
    `${format(p.startDate, 'startDate', {})} – ${format(p.endDate, 'endDate', {})}`;
  const cards: SpendingPresentation['cards'] = [];
  for (const total of totals) {
    const matching = Array.from(
      new Map(
        comparisons
          .filter(
            (c) =>
              c.currency === total.currency &&
              c.kind === 'expense' &&
              samePeriod(c.currentPeriod, currentPeriod),
          )
          .map((c) => [
            JSON.stringify([
              c.currency,
              c.kind,
              period(c.currentPeriod),
              period(c.previousPeriod),
              c.currentMinor,
              c.previousMinor,
            ]),
            c,
          ]),
      ).values(),
    );
    if (matching.length > 1) return undefined;
    const c = matching[0];
    const previousPeriod = period(c?.previousPeriod);
    const previous = c
      ? all.find(
          (r) =>
            samePeriod(r.snapshot.data.period, c.previousPeriod) &&
            sameScope(r, selected) &&
            sameBasis(r, selected) &&
            r.snapshot.data.status === 'ok',
        )
      : undefined;
    const money = (v: string) => format(v, 'amountMinor', { currency: total.currency });
    const categories = rows(selected.snapshot.data.topExpenseCategories).filter(
      (r) => r.currency === total.currency && integer(r.amountMinor) && BigInt(r.amountMinor) > 0n,
    );
    const paired = categories
      .flatMap((r) => {
        const prior = rows(previous?.snapshot.data.topExpenseCategories).find(
          (p) =>
            p.currency === r.currency &&
            p.category === r.category &&
            typeof p.category === 'string',
        );
        if (!prior || !integer(prior.amountMinor) || !integer(r.amountMinor)) return [];
        return [
          { current: r, previous: prior, delta: BigInt(r.amountMinor) - BigInt(prior.amountMinor) },
        ];
      })
      .filter((p) => p.delta !== 0n && c && p.delta > 0n === BigInt(c.differenceMinor) > 0n)
      .sort((a, b) => {
        const x = a.delta < 0n ? -a.delta : a.delta,
          y = b.delta < 0n ? -b.delta : b.delta;
        return x > y ? -1 : x < y ? 1 : 0;
      });
    const changed = c && BigInt(c.differenceMinor) !== 0n ? paired[0] : undefined;
    const top =
      changed?.current ??
      [...categories].sort((a, b) =>
        BigInt(String(a.amountMinor)) > BigInt(String(b.amountMinor)) ? -1 : 1,
      )[0];
    const name = top?.[ar ? 'labelAr' : 'labelEn'];
    const safeName =
      typeof name === 'string' && name.trim() ? redactAiText(name).slice(0, 300) : null;
    let explanation: string | null = null,
      saving: SpendingPresentation['cards'][number]['saving'] = null;
    if (safeName && top && BigInt(total.confirmedMinor) > 0n) {
      explanation = changed
        ? ar
          ? `من التغيّرات المسجلة: ${safeName} ${changed.delta > 0n ? 'زاد' : 'قل'} صرفها ${money((changed.delta < 0n ? -changed.delta : changed.delta).toString())}.`
          : `One recorded change: spending on ${safeName} ${changed.delta > 0n ? 'increased' : 'decreased'} by ${money((changed.delta < 0n ? -changed.delta : changed.delta).toString())}.`
        : ar
          ? `من الفئات المسجلة، ${safeName} عليها صرف بقيمة ${money(String(top.amountMinor))}.`
          : `Recorded spending on ${safeName}: ${money(String(top.amountMinor))}.`;
      saving =
        changed && changed.delta > 0n && BigInt(String(changed.previous.amountMinor)) >= 0n
          ? {
              text: ar
                ? `راجع إمكانية ترجع صرف ${safeName} لمستوى الفترة السابقة: ${money(String(changed.previous.amountMinor))}.`
                : `Consider bringing ${safeName} spending back to its recorded previous level: ${money(String(changed.previous.amountMinor))}.`,
              target: money(changed.delta.toString()),
            }
          : {
              text: ar
                ? `راجع عمليات ${safeName} وحدّد المصروف اللي تقدر تستغني عنه.`
                : `Review your ${safeName} transactions and identify an expense you can skip.`,
              target: null,
            };
    }
    cards.push({
      title: ar ? 'مصروفاتك' : 'Your spending',
      amount: money(total.confirmedMinor),
      period: dateRange(currentPeriod),
      comparisonNotice:
        !c && all.some((r) => sameScope(r, selected) && r.snapshot.data.status !== 'ok')
          ? ar
            ? 'مقارنة الفترة السابقة مو متاحة ببيانات موثوقة الحين.'
            : 'A reliable previous-period comparison is unavailable.'
          : null,
      comparison:
        c && previous && previousPeriod
          ? {
              direction:
                BigInt(c.differenceMinor) > 0n
                  ? 'up'
                  : BigInt(c.differenceMinor) < 0n
                    ? 'down'
                    : 'flat',
              difference: money(
                (BigInt(c.differenceMinor) < 0n
                  ? -BigInt(c.differenceMinor)
                  : BigInt(c.differenceMinor)
                ).toString(),
              ),
              percentage:
                c.percentageBasisPoints === null
                  ? null
                  : format(c.percentageBasisPoints, 'percentageBasisPoints', {}),
              previousAmount: money(c.previousMinor),
              previousPeriod: dateRange(previousPeriod),
            }
          : null,
      explanation,
      saving,
    });
  }
  return cards.length <= 5 ? { version: 1, locale, cards } : undefined;
}
