import { localDateAt } from '../reports/reports.period';

export interface ResolvedAssistantContext {
  locale: 'ar' | 'en';
  timezone: string;
  startDate: string;
  endDate: string;
  currency: string | null;
  purchasePriceMinor: string | null;
  clarification:
    'period_required' | 'price_required' | 'currency_required' | 'scope_required' | null;
}

const monthNames = [
  ['january', 'يناير'],
  ['february', 'فبراير'],
  ['march', 'مارس'],
  ['april', 'أبريل', 'ابريل'],
  ['may', 'مايو'],
  ['june', 'يونيو'],
  ['july', 'يوليو'],
  ['august', 'أغسطس', 'اغسطس'],
  ['september', 'سبتمبر'],
  ['october', 'أكتوبر', 'اكتوبر'],
  ['november', 'نوفمبر'],
  ['december', 'ديسمبر'],
];
const currencies = /\b(SAR|USD|EUR|GBP|AED|KWD|BHD|OMR|JPY|QAR)\b|ريال|دولار|يورو/giu;
const currencyCode = (value: string) =>
  ({ ريال: 'SAR', دولار: 'USD', يورو: 'EUR' })[value] ?? value.toUpperCase();
const day = (value: string) => new Date(`${value}T00:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);
const validDay = (value: string) =>
  Number.isFinite(day(value).valueOf()) && iso(day(value)) === value;

/** Only question text selects scope; identity and timezone come from the authenticated owner. */
export function resolveAssistantContext(
  question: string,
  timezone: string,
  now = new Date(),
): ResolvedAssistantContext {
  const text = question
    .normalize('NFKC')
    .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/gu, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .toLowerCase();
  const today = localDateAt(now, timezone);
  let month = today.slice(0, 7);
  let clarification: ResolvedAssistantContext['clarification'] = null;
  if (/(last|previous) month|الشهر (الماضي|السابق|اللي قبله)/u.test(text)) {
    const previous = day(`${month}-01`);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    month = iso(previous).slice(0, 7);
  }
  const namedMonths = monthNames.flatMap((names, index) =>
    names.some((name) => text.includes(name)) ? [index] : [],
  );
  const namedMonth = namedMonths[0] ?? -1;
  const numericMonth = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/u);
  if (namedMonth >= 0)
    month = `${text.match(/\b20\d{2}\b/u)?.[0] ?? today.slice(0, 4)}-${String(namedMonth + 1).padStart(2, '0')}`;
  if (numericMonth?.[1] && numericMonth[2]) month = `${numericMonth[1]}-${numericMonth[2]}`;
  let startDate = `${month}-01`;
  const end = day(startDate);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  let endDate = iso(end);
  const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/gu) ?? [];
  if (dates.length) {
    const firstDate = dates[0],
      secondDate = dates[1];
    if (
      dates.length !== 2 ||
      !firstDate ||
      !secondDate ||
      !dates.every(validDay) ||
      firstDate > secondDate
    )
      clarification = 'period_required';
    else {
      startDate = firstDate;
      endDate = secondDate;
    }
  } else if (/week|أسبوع|اسبوع/u.test(text)) {
    const start = day(today);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    if (/last|previous|الماضي|السابق/u.test(text)) start.setUTCDate(start.getUTCDate() - 7);
    startDate = iso(start);
    start.setUTCDate(start.getUTCDate() + 6);
    endDate = iso(start);
  } else if (/year|سنة|عام/u.test(text) && namedMonth < 0) {
    const year =
      Number(text.match(/\b20\d{2}\b/u)?.[0] ?? today.slice(0, 4)) -
      (/last|previous|الماضي|السابق/u.test(text) ? 1 : 0);
    startDate = `${year.toString()}-01-01`;
    endDate = `${year.toString()}-12-31`;
  } else if (/quarter|ربع|yesterday|أمس|امس|last \d+|آخر \d+/u.test(text))
    clarification = 'period_required';
  const explicitMonths = text.match(/\b20\d{2}-(?:0[1-9]|1[0-2])(?!-\d{2})\b/gu) ?? [];
  const periodKinds = [
    dates.length > 0,
    /week|أسبوع|اسبوع/u.test(text),
    /year|سنة|عام/u.test(text) && namedMonth < 0,
    namedMonths.length > 0 || explicitMonths.length > 0 || /month|الشهر/u.test(text),
  ].filter(Boolean).length;
  if (
    namedMonths.length > 1 ||
    explicitMonths.length > 1 ||
    periodKinds > 1 ||
    /\btoday\b|\bdaily\b|\bday\b|اليوم|يومي|quarter|ربع|yesterday|أمس|امس|last \d+|آخر \d+/u.test(
      text,
    ) ||
    (/(?:this|current) month|هذا الشهر/u.test(text) &&
      /(?:last|previous) month|الشهر (?:الماضي|السابق)/u.test(text))
  )
    clarification = 'period_required';
  if (/\baccount\b|حساب (?:ال|بنك)|حسابي في/u.test(text)) clarification = 'scope_required';
  const codes = [...new Set([...text.matchAll(currencies)].map((match) => currencyCode(match[0])))];
  let currency = codes.length === 1 ? (codes[0] ?? null) : null;
  let purchasePriceMinor: string | null = null;
  if (codes.length > 1) clarification = 'currency_required';
  if (/afford|buy|purchase|اشتري|أشتري|شراء|اشتريت/u.test(text)) {
    const prices = [
      ...text.matchAll(
        /([0-9]+(?:[.,][0-9]+)?)\s*(sar|usd|eur|gbp|aed|kwd|bhd|omr|jpy|qar|ريال|دولار|يورو)/giu,
      ),
    ];
    const price = prices[0];
    if (prices.length !== 1 || !price?.[1] || !price[2]) clarification = 'price_required';
    else {
      currency = currencyCode(price[2]);
      const precision =
        new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
          .maximumFractionDigits ?? 2;
      const [whole, fraction = ''] = price[1].replace(',', '.').split('.');
      if (!whole || fraction.length > precision || price[1].includes(','))
        clarification = 'price_required';
      else {
        const minor =
          BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, '0') || '0');
        if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER))
          clarification = 'price_required';
        else purchasePriceMinor = minor.toString();
      }
    }
  }
  return {
    locale: /[\u0600-\u06ff]/u.test(question) ? 'ar' : 'en',
    timezone,
    startDate,
    endDate,
    currency,
    purchasePriceMinor,
    clarification,
  };
}
