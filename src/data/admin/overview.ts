import type { ChartPoint, Incident, Metric, ServiceHealth } from "@/types/admin";

export const overviewMetrics: Metric[] = [
  { label: "إجمالي المستخدمين", value: "128,450", change: 8.4, note: "مقابل الفترة السابقة" },
  { label: "المستخدمون النشطون", value: "84,210", change: 5.2, note: "آخر 30 يوماً" },
  { label: "المستخدمون المدفوعون", value: "31,870", change: 3.8, note: "24.8% من الإجمالي", tone: "premium" },
  { label: "الإيراد الشهري المتكرر", value: "2.48 مليون ر.س", change: 6.1, note: "تقدير تشغيلي" },
  { label: "المعاملات المستوردة", value: "1.92 مليون", change: 11.6 },
  { label: "تذاكر الدعم المفتوحة", value: "184", change: -4.3 },
  { label: "الحوادث الحرجة", value: "2", note: "تحتاج مراجعة", tone: "attention" },
  { label: "المهام الخلفية الفاشلة", value: "37", note: "خلال 24 ساعة", tone: "attention" },
];

export const userGrowth: ChartPoint[] = [
  { name: "يناير", current: 95, previous: 88 }, { name: "فبراير", current: 101, previous: 92 },
  { name: "مارس", current: 108, previous: 96 }, { name: "أبريل", current: 113, previous: 101 },
  { name: "مايو", current: 120, previous: 106 }, { name: "يونيو", current: 128, previous: 111 },
];

export const importVolume: ChartPoint[] = [
  { name: "السبت", current: 42, secondary: 18 }, { name: "الأحد", current: 51, secondary: 22 },
  { name: "الاثنين", current: 47, secondary: 25 }, { name: "الثلاثاء", current: 59, secondary: 27 },
  { name: "الأربعاء", current: 63, secondary: 30 }, { name: "الخميس", current: 56, secondary: 24 },
];

export const attentionItems: Incident[] = [
  {
    id: "INC-2048", severity: "critical", service: "AI Providers",
    title: "تراجع أداء مزود الذكاء الاصطناعي", detail: "ارتفع زمن الاستجابة وأثر في معالجة صور الإيصالات.",
    startedAt: "2026-07-25T07:42:00+03:00", status: "قيد المعالجة", affectedArea: "استيراد الإيصالات",
    timeline: ["07:42 رُصد التراجع", "07:49 فُعّل المزود البديل"],
  },
  {
    id: "INC-2047", severity: "high", service: "Imports",
    title: "ارتفاع فشل الاستيراد", detail: "زيادة في رسائل بنك محدد بعد تغيير تنسيق الإشعار.",
    startedAt: "2026-07-25T06:18:00+03:00", status: "قيد التحقيق", affectedArea: "Android SMS",
    timeline: ["06:18 رُصد الارتفاع", "06:31 أُحيل لفريق المحلل"],
  },
  {
    id: "INC-2044", severity: "medium", service: "BullMQ",
    title: "تراكم في قائمة الانتظار", detail: "زمن الانتظار أعلى من المعتاد لمهام التقارير.",
    startedAt: "2026-07-25T04:05:00+03:00", status: "مراقبة", affectedArea: "التقارير الشهرية",
    timeline: ["04:05 رُصد التراكم", "04:22 زيد عدد العمال"],
  },
];

export const overviewServices: ServiceHealth[] = [
  { name: "واجهة API", status: "operational", uptime: "99.99%", latency: "118 ms", errorRate: "0.08%", lastIncident: "منذ 18 يوماً", lastCheck: "الآن" },
  { name: "قاعدة البيانات", status: "operational", uptime: "99.98%", latency: "24 ms", errorRate: "0.02%", lastIncident: "منذ 31 يوماً", lastCheck: "الآن" },
  { name: "العمال الخلفيون", status: "degraded", uptime: "99.81%", latency: "420 ms", errorRate: "1.14%", lastIncident: "نشط", lastCheck: "منذ دقيقة" },
  { name: "مزود الذكاء الاصطناعي", status: "partial-outage", uptime: "98.72%", latency: "2.4 s", errorRate: "4.82%", lastIncident: "نشط", lastCheck: "منذ دقيقة" },
];

export const recentActivity = [
  { title: "ترقية اشتراك إلى Premium", meta: "USR-83921 · منذ 6 دقائق" },
  { title: "إعادة محاولة استيراد ناجحة", meta: "IMP-77241 · منذ 14 دقيقة" },
  { title: "تحديث قاعدة محلل", meta: "Parser v3.18.2 · منذ 27 دقيقة" },
  { title: "اكتمال طلب حذف بيانات", meta: "REQ-2041 · منذ 42 دقيقة" },
];
