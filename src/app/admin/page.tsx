"use client";

import { Activity, ArrowLeft, Clock3, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ChartCard, DonutChart, TrendChart, VolumeChart } from "@/components/admin/Charts";
import { MetricCard, PageHeader, SeverityBadge, StatusBadge } from "@/components/admin/ui";
import { attentionItems, importVolume, overviewMetrics, overviewServices, recentActivity, userGrowth } from "@/data/admin/overview";
import type { DateRange } from "@/types/admin";

export default function OverviewPage() {
  const [range, setRange] = useState<DateRange>("30d");
  const [refreshed, setRefreshed] = useState("الآن");
  return (
    <div className="page">
      <PageHeader
        eyebrow="المنصة / نظرة عامة"
        title="صباح الخير، Waleed"
        description="ملخص تشغيلي لما يحتاج انتباه فريق الإدارة اليوم. جميع البيانات المعروضة تجريبية."
        actions={<><select className="select" value={range} onChange={(event) => setRange(event.target.value as DateRange)} aria-label="النطاق الزمني"><option value="7d">آخر 7 أيام</option><option value="30d">آخر 30 يوماً</option><option value="90d">آخر 90 يوماً</option></select><button className="button" onClick={() => setRefreshed("منذ لحظات")}><RefreshCw size={16} /><span>تحديث</span></button></>}
      />
      <div className="metrics-grid">{overviewMetrics.slice(0, 4).map((metric) => <MetricCard key={metric.label} metric={metric} primary />)}</div>
      <div className="metrics-grid" style={{ marginTop: 14 }}>{overviewMetrics.slice(4).map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>

      <section className="section-grid">
        <ChartCard title="نمو المستخدمين" subtitle="بالآلاف · الفترة الحالية مقابل السابقة" summary="ارتفع عدد المستخدمين من 95 ألفاً إلى 128 ألفاً خلال ستة أشهر.">
          <TrendChart data={userGrowth} compare />
        </ChartCard>
        <article className="card attention-card">
          <div className="card-heading"><div><h2>يتطلب انتباهك</h2><p>3 حالات تشغيلية مفتوحة</p></div><button className="button"><span>عرض الكل</span><ArrowLeft size={15} /></button></div>
          <div className="attention-list">{attentionItems.map((item) => <div className="attention-item" key={item.id}><div className="attention-title"><h3>{item.title}</h3><SeverityBadge severity={item.severity} /></div><p>{item.detail}</p><div className="attention-meta"><span className="ltr">{item.id}</span><span>{item.service}</span></div></div>)}</div>
        </article>
      </section>

      <section className="section-grid equal">
        <ChartCard title="حجم الاستيراد" subtitle="بالآلاف حسب اليوم" summary="بلغ أعلى حجم للاستيراد يوم الأربعاء، وكانت الإشعارات المصدر الثانوي الأكبر.">
          <VolumeChart data={importVolume} stacked />
        </ChartCard>
        <div className="section-grid equal" style={{ marginTop: 0 }}>
          <ChartCard title="توزيع الاشتراكات" summary="المجاني 58%، الأساسي 27%، Premium بنسبة 15%."><DonutChart data={[{ name: "مجاني", value: 58 }, { name: "أساسي", value: 27 }, { name: "Premium", value: 15 }]} /><div className="legend"><span><i style={{background:"#1C3934"}}/>مجاني 58%</span><span><i style={{background:"#CFA47A"}}/>أساسي 27%</span><span><i style={{background:"#46756C"}}/>Premium 15%</span></div></ChartCard>
          <ChartCard title="المنصات" summary="أجهزة iOS تمثل 54% وأجهزة Android تمثل 46%."><DonutChart data={[{ name: "iOS", value: 54 }, { name: "Android", value: 46 }]} /><div className="legend"><span><i style={{background:"#1C3934"}}/>iOS 54%</span><span><i style={{background:"#CFA47A"}}/>Android 46%</span></div></ChartCard>
        </div>
      </section>

      <section className="section-grid">
        <article className="card"><div className="card-heading"><div><h2>الصحة التشغيلية</h2><p>آخر فحص: {refreshed}</p></div><StatusBadge status="degraded" /></div><div className="health-list">{overviewServices.map((service) => <div className="health-row" key={service.name}><div className="health-name"><span className={`health-dot ${service.status === "operational" ? "" : service.status === "degraded" ? "warn" : "danger"}`} />{service.name}</div><div className="health-cell"><small>الحالة</small><StatusBadge status={service.status} /></div><div className="health-cell"><small>التوافر</small><strong className="numbers ltr">{service.uptime}</strong></div><div className="health-cell"><small>الاستجابة</small><strong className="numbers ltr">{service.latency}</strong></div><div className="health-cell"><small>الخطأ</small><strong className="numbers ltr">{service.errorRate}</strong></div></div>)}</div></article>
        <article className="card"><div className="card-heading"><div><h2>النشاط الأخير</h2><p>أحداث إدارية وتشغيلية</p></div></div><div className="activity-list">{recentActivity.map((item) => <div className="activity-item" key={item.meta}><span className="activity-icon"><Activity size={16} /></span><div><strong>{item.title}</strong><small>{item.meta}</small></div></div>)}</div><div style={{display:"flex", alignItems:"center", gap:6, marginTop:14, color:"var(--text-muted)", fontSize:11}}><Clock3 size={14}/> آخر تحديث متزامن مع النطاق {range}</div></article>
      </section>
    </div>
  );
}
