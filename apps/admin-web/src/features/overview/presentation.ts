import type { Locale } from "@/core/localization/direction";
import { getPlanLabel } from "@/core/localization/display-labels";
export function formatOverviewMetric(
  metric: { id: string; numericValue: number | null; formattedValue: string },
  locale: Locale,
): string {
  return metric.numericValue === null
    ? locale === "ar"
      ? "غير متاح"
      : "Unavailable"
    : metric.formattedValue;
}
export function planLabel(plan: string, locale: Locale): string {
  return getPlanLabel(locale, plan);
}
export function paidCustomerNote(
  paid: number | null,
  total: number,
  locale: Locale,
): string | undefined {
  if (paid === null || total === 0) return undefined;
  const percent = Math.round((paid / total) * 100);
  return locale === "ar" ? `${percent}% من الإجمالي` : `${percent}% of total`;
}
