import type { ChartPoint, Incident, ServiceHealth } from "@/types/admin";

export const services: ServiceHealth[] = [
  ["NestJS API", "operational", "99.99%", "118 ms", "0.08%", "18 يوماً", "الآن"],
  ["Supabase Database", "operational", "99.98%", "24 ms", "0.02%", "31 يوماً", "الآن"],
  ["Supabase Auth", "operational", "99.99%", "94 ms", "0.04%", "42 يوماً", "الآن"],
  ["Supabase Storage", "operational", "99.95%", "180 ms", "0.12%", "12 يوماً", "منذ دقيقة"],
  ["Redis", "operational", "99.99%", "6 ms", "0.01%", "64 يوماً", "الآن"],
  ["BullMQ Workers", "degraded", "99.81%", "420 ms", "1.14%", "نشط", "منذ دقيقة"],
  ["Stripe", "operational", "99.97%", "286 ms", "0.07%", "23 يوماً", "منذ دقيقتين"],
  ["AI Providers", "partial-outage", "98.72%", "2.4 s", "4.82%", "نشط", "منذ دقيقة"],
  ["Email Provider", "operational", "99.94%", "340 ms", "0.18%", "9 أيام", "منذ دقيقتين"],
  ["Push Provider", "operational", "99.91%", "310 ms", "0.21%", "7 أيام", "منذ دقيقتين"],
  ["Exchange Rate Provider", "maintenance", "99.87%", "510 ms", "0.34%", "صيانة مجدولة", "منذ 3 دقائق"],
  ["Sentry", "operational", "99.99%", "102 ms", "0.02%", "55 يوماً", "الآن"],
].map(([name, status, uptime, latency, errorRate, lastIncident, lastCheck]) => ({
  name, status, uptime, latency, errorRate, lastIncident, lastCheck,
})) as ServiceHealth[];

export const requestVolume: ChartPoint[] = [
  { name: "00:00", current: 44 }, { name: "04:00", current: 31 }, { name: "08:00", current: 82 },
  { name: "12:00", current: 104 }, { name: "16:00", current: 96 }, { name: "20:00", current: 71 },
];

export const latencyTrend: ChartPoint[] = requestVolume.map((point, index) => ({
  name: point.name, current: [104, 96, 124, 138, 118, 110][index], previous: 200,
}));

export const incidents: Incident[] = [
  { id: "INC-2048", severity: "critical", service: "AI Providers", title: "تراجع أداء معالجة الإيصالات", detail: "تأخر في معالجة صور الإيصالات مع تفعيل المزود البديل.", startedAt: "2026-07-25T07:42:00+03:00", status: "قيد المعالجة", affectedArea: "استيراد الإيصالات", timeline: ["07:42 اكتشاف ارتفاع زمن الاستجابة", "07:49 تفعيل المزود البديل", "08:12 انخفاض معدل الخطأ"] },
  { id: "INC-2044", severity: "medium", service: "BullMQ Workers", title: "تراكم مهام التقارير", detail: "زمن الانتظار أعلى من الهدف التشغيلي.", startedAt: "2026-07-25T04:05:00+03:00", status: "مراقبة", affectedArea: "التقارير الشهرية", timeline: ["04:05 رصد التراكم", "04:22 زيادة العمال", "05:10 بدء انخفاض القائمة"] },
];
