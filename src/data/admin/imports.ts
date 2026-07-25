import type { ChartPoint, ImportRecord, Metric } from "@/types/admin";

export const importMetrics: Metric[] = [
  { label: "إجمالي عمليات الاستيراد", value: "384,620", change: 9.4 },
  { label: "ناجحة", value: "366,482", change: 10.1 },
  { label: "فاشلة", value: "7,240", change: 2.8, tone: "attention" },
  { label: "جزئية", value: "4,916" }, { label: "بانتظار المراجعة", value: "1,284" },
  { label: "مرشحة للتكرار", value: "2,118" }, { label: "تنسيقات غير مدعومة", value: "640" },
  { label: "متوسط المعالجة", value: "1.8 ث" },
];

export const importSourceVolume: ChartPoint[] = [
  { name: "SMS", current: 84, secondary: 4 }, { name: "الإشعارات", current: 68, secondary: 3 },
  { name: "Shortcut", current: 44, secondary: 2 }, { name: "الصور", current: 36, secondary: 6 },
  { name: "CSV", current: 27, secondary: 1 }, { name: "PDF", current: 22, secondary: 3 },
];

export const failureTrend: ChartPoint[] = [
  { name: "20 يوليو", current: 1.4 }, { name: "21 يوليو", current: 1.2 },
  { name: "22 يوليو", current: 1.7 }, { name: "23 يوليو", current: 1.5 },
  { name: "24 يوليو", current: 2.1 }, { name: "25 يوليو", current: 2.8 },
];

export const failedImports: ImportRecord[] = [
  { id: "IMP-77241", user: "USR-10***", source: "Android SMS", bank: "بنك سعودي — عينة", platform: "Android", failureType: "تنسيق غير معروف", parserVersion: "v3.18.2", attempts: 3, severity: "high", time: "2026-07-25T08:21:00+03:00", status: "failed", appVersion: "4.8.1", sanitizedResult: "تعذر تحديد حقل المبلغ بعد إزالة المحتوى الحساس." },
  { id: "IMP-77236", user: "USR-09***", source: "Receipt image", bank: "غير محدد", platform: "iOS", failureType: "جودة صورة منخفضة", parserVersion: "vision-2.4", attempts: 2, severity: "medium", time: "2026-07-25T07:58:00+03:00", status: "review", appVersion: "4.8.2", sanitizedResult: "تم استخراج التاريخ والتاجر، والمبلغ يحتاج مراجعة." },
  { id: "IMP-77210", user: "USR-08***", source: "PDF statement", bank: "بنك إماراتي — عينة", platform: "iOS", failureType: "PDF محمي", parserVersion: "pdf-1.9", attempts: 1, severity: "low", time: "2026-07-25T06:44:00+03:00", status: "unsupported", appVersion: "4.7.9", sanitizedResult: "لم تتم قراءة محتوى الملف المحمي." },
  { id: "IMP-77192", user: "USR-10***", source: "Android notification", bank: "بنك سعودي — عينة", platform: "Android", failureType: "قاعدة محلل قديمة", parserVersion: "v3.17.8", attempts: 4, severity: "critical", time: "2026-07-25T05:32:00+03:00", status: "failed", appVersion: "4.8.0", sanitizedResult: "تغير قالب الإشعار؛ لم تُحفظ أي بيانات مالية." },
];
