import type { ReportSnapshot } from './reports.schemas';

export interface PdfReportSection {
  title: string;
  columns: string[];
  rows: string[][];
}

export const PDF_REPORT_TITLES: Record<ReportSnapshot['reportType'], string> = {
  financial_summary: 'الملخص المالي',
  category_spending: 'المصروفات حسب الفئة',
  budget_performance: 'أداء الميزانيات',
  obligation_progress: 'متابعة الالتزامات',
  savings_progress: 'متابعة أهداف الادخار',
  account_activity: 'حركة الحساب',
};

const LABELS: Record<string, string> = {
  income: 'الإيرادات',
  incomeMinor: 'الإيرادات',
  expense: 'المصروفات',
  expenseMinor: 'المصروفات',
  netCashFlow: 'صافي التدفق النقدي',
  netCashFlowMinor: 'صافي التدفق النقدي',
  transactionCount: 'عدد الحركات',
  savingsRateBasisPoints: 'معدل الادخار',
  budgetMinor: 'حد الميزانية',
  spentMinor: 'المصروف',
  paidMinor: 'المدفوع',
  remainingMinor: 'المتبقي',
  overdueMinor: 'المتأخر',
  targetMinor: 'المستهدف',
  trackedMinor: 'المدخر',
  summaries: 'الملخص',
  planning: 'التخطيط',
  budgets: 'الميزانيات',
  obligations: 'الالتزامات',
  savingsGoals: 'أهداف الادخار',
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fixedInteger(amount: unknown, scale: number): string {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount))
    throw new Error('REPORT_PDF_AMOUNT_INVALID');
  const magnitude = BigInt(amount) < 0n ? -BigInt(amount) : BigInt(amount);
  const divisor = 10n ** BigInt(scale);
  const whole = (magnitude / divisor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = scale ? `.${(magnitude % divisor).toString().padStart(scale, '0')}` : '';
  return `${amount < 0 ? '-' : ''}${whole}${fraction}`;
}

export function formatReportMoney(
  amountMinor: unknown,
  currency: string,
  minorUnits: Readonly<Record<string, unknown>> = {},
): string {
  if (!Object.hasOwn(minorUnits, currency))
    return `${fixedInteger(amountMinor, 0)} ${currency} (وحدة صغرى)`;
  const scale = minorUnits[currency];
  if (typeof scale !== 'number' || !Number.isInteger(scale) || scale < 0 || scale > 4)
    throw new Error('REPORT_PDF_CURRENCY_SCALE_INVALID');
  return `${fixedInteger(amountMinor, scale)} ${currency}`;
}

function label(key: string): string {
  return LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

function text(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value.toString();
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  throw new Error('REPORT_PDF_DATA_INVALID');
}

function fieldRows(
  value: unknown,
  context: { currency: string; minorUnits: Record<string, unknown>; path: string[] },
): string[][] {
  if (Array.isArray(value)) return value.flatMap((entry) => fieldRows(entry, context));
  const record = object(value);
  const currency =
    typeof record.currency === 'string'
      ? record.currency
      : typeof record.currencyCode === 'string'
        ? record.currencyCode
        : context.currency;
  if (Object.hasOwn(record, 'amountMinor')) {
    if (typeof record.amountMinor !== 'number') throw new Error('REPORT_PDF_AMOUNT_INVALID');
    return [
      [
        context.path.join(' / '),
        formatReportMoney(record.amountMinor, currency, context.minorUnits),
      ],
    ];
  }
  if (Object.keys(record).length)
    return Object.entries(record).flatMap(([key, entry]) => {
      if (['currency', 'currencyCode', 'currencyMinorUnits'].includes(key)) return [];
      const path = [...context.path, label(key)];
      if (/(?:Minor|_minor)$/.test(key)) {
        if (typeof entry !== 'number') throw new Error('REPORT_PDF_AMOUNT_INVALID');
        return [[path.join(' / '), formatReportMoney(entry, currency, context.minorUnits)]];
      }
      if (key === 'savingsRateBasisPoints' && typeof entry === 'number')
        return [[path.join(' / '), `${fixedInteger(entry, 2)}%`]];
      return fieldRows(entry, { ...context, currency, path });
    });
  if (value === null || value === undefined || typeof value === 'object') return [];
  return [[context.path.join(' / '), text(value)]];
}

export function buildReportPdfSections(snapshot: ReportSnapshot): PdfReportSection[] {
  const minorUnits = object(snapshot.summary.currencyMinorUnits);
  const context = { currency: snapshot.currencyCode, minorUnits, path: [] as string[] };
  const sections: PdfReportSection[] = [];
  const fields = (title: string, content: unknown) => {
    const rows = fieldRows(content, context);
    if (rows.length) sections.push({ title, columns: ['البند', 'القيمة'], rows });
  };
  const planning = object(snapshot.summary.planning);
  if (
    ['financial_summary', 'category_spending', 'account_activity'].includes(snapshot.reportType)
  ) {
    const summary = Object.fromEntries(
      Object.entries(snapshot.summary).filter(
        ([key]) => !['planning', 'currencyMinorUnits'].includes(key),
      ),
    );
    fields('الملخص المالي', summary);
  }
  for (const [key, reportType] of [
    ['budgets', 'budget_performance'],
    ['obligations', 'obligation_progress'],
    ['savingsGoals', 'savings_progress'],
  ] as const) {
    if (snapshot.reportType === 'financial_summary' || snapshot.reportType === reportType)
      fields(label(key), planning[key]);
  }
  if (
    ['financial_summary', 'category_spending'].includes(snapshot.reportType) &&
    snapshot.breakdowns.length
  )
    sections.push({
      title: 'المصروفات حسب الفئة',
      columns: ['الفئة', 'المصروفات', 'عدد الحركات'],
      rows: snapshot.breakdowns.map((row) => [
        text(row.labelAr ?? row.labelEn, 'غير مصنف'),
        formatReportMoney(
          row.expenseMinor,
          text(row.currencyCode, snapshot.currencyCode),
          minorUnits,
        ),
        text(row.transactionCount),
      ]),
    });
  if (snapshot.reportType === 'account_activity' && snapshot.detailedRows.length) {
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: snapshot.period.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const kinds: Record<string, string> = {
      income: 'إيراد',
      expense: 'مصروف',
      refund: 'استرداد',
      reversal: 'عكس',
      transfer: 'تحويل',
    };
    sections.push({
      title: 'الحركات',
      columns: ['التاريخ', 'النوع', 'المبلغ', 'الفئة'],
      rows: snapshot.detailedRows.map((row) => [
        date.format(new Date(text(row.occurredAt))),
        kinds[text(row.kind)] ?? text(row.kind),
        formatReportMoney(
          row.amountMinor,
          text(row.currencyCode, snapshot.currencyCode),
          minorUnits,
        ),
        text(row.categoryLabel, 'غير مصنف'),
      ]),
    });
  }
  if (!sections.length) fields('البيانات المتاحة', snapshot.summary);
  return sections;
}
