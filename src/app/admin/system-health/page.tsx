"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ChartCard, TrendChart, VolumeChart } from "@/components/admin/Charts";
import { Drawer, PageHeader, SeverityBadge, StatusBadge } from "@/components/admin/ui";
import { incidents, latencyTrend, requestVolume, services } from "@/data/admin/system-health";
import { formatDate } from "@/lib/admin-utils";
import type { Incident } from "@/types/admin";

export default function SystemHealthPage() {
  const [active, setActive] = useState<Incident | null>(null);
  const [lastCheck, setLastCheck] = useState("منذ دقيقة");
  return (
    <div className="page">
      <PageHeader eyebrow="المنصة / صحة النظام" title="صحة النظام" description="مراقبة خدمات مساريفي ومزوديها. جميع القياسات تجريبية ومخصصة للعرض." actions={<><span className="environment"><span/> الإنتاج</span><button className="button" onClick={() => setLastCheck("الآن")}><RefreshCw size={16}/><span>فحص الآن</span></button></>} />
      <div className="summary-strip">{[
        ["الخدمات العاملة","9 / 12"],["الخدمات المتراجعة","2"],["الحوادث النشطة","2"],["متوسط استجابة API","118 ms"],["معدل الخطأ","0.08%"],["قائمة الانتظار","1,284"],
      ].map(([label,value]) => <div className="summary-item" key={label}><small>{label}</small><strong className="numbers">{value}</strong></div>)}</div>
      <section className="section-grid equal">
        <ChartCard title="حجم طلبات API" subtitle="بالآلاف خلال 24 ساعة" summary="بلغت الطلبات ذروتها عند الساعة الثانية عشرة."><VolumeChart data={requestVolume}/></ChartCard>
        <ChartCard title="زمن استجابة API" subtitle="القيمة الحالية مقابل حد 200 مللي ثانية" summary="ظل زمن الاستجابة دون حد 200 مللي ثانية في كل الفترات."><TrendChart data={latencyTrend} compare/></ChartCard>
      </section>
      <section className="section-grid equal">
        <ChartCard title="معدل الخطأ" subtitle="النسبة المئوية لكل أربع ساعات" summary="معدل الخطأ الحالي 0.08 بالمئة."><TrendChart data={requestVolume.map((point,index) => ({...point,current:[.06,.04,.08,.12,.09,.08][index]}))}/></ChartCard>
        <article className="card"><div className="card-heading"><div><h2>صحة قوائم الانتظار</h2><p>آخر 24 ساعة</p></div></div><div className="summary-strip" style={{gridTemplateColumns:"repeat(3,1fr)",margin:0}}>{[["بانتظار","1,284"],["نشطة","86"],["مكتملة","42,840"],["فاشلة","37"],["مؤجلة","112"],["معادة","64"]].map(([label,value]) => <div className="summary-item" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></article>
      </section>
      <section className="section-grid">
        <article className="card"><div className="card-heading"><div><h2>الخدمات</h2><p>آخر فحص: {lastCheck}</p></div><StatusBadge status="degraded"/></div><div className="health-list">{services.map((service) => <div className="health-row" key={service.name}><div className="health-name"><span className={`health-dot ${service.status === "operational" ? "" : service.status === "degraded" || service.status === "maintenance" ? "warn" : "danger"}`}/><span className="ltr">{service.name}</span></div><div className="health-cell"><small>الحالة</small><StatusBadge status={service.status}/></div><div className="health-cell"><small>التوافر</small><strong className="ltr">{service.uptime}</strong></div><div className="health-cell"><small>الاستجابة</small><strong className="ltr">{service.latency}</strong></div><div className="health-cell"><small>معدل الخطأ</small><strong className="ltr">{service.errorRate}</strong></div></div>)}</div></article>
        <article className="card"><div className="card-heading"><div><h2>الحوادث الحالية</h2><p>تحتاج متابعة فريق العمليات</p></div></div><div className="incident-list">{incidents.map((incident) => <button key={incident.id} className="mobile-data-card" style={{textAlign:"start",color:"inherit"}} onClick={() => setActive(incident)}><div className="mobile-data-head"><SeverityBadge severity={incident.severity}/><span className="ltr" style={{color:"var(--text-muted)",fontSize:11}}>{incident.id}</span></div><h3>{incident.title}</h3><p style={{color:"var(--text-muted)"}}>{incident.detail}</p><div className="attention-meta" style={{color:"var(--text-muted)"}}><span className="ltr">{incident.service}</span><span>{formatDate(incident.startedAt,true)}</span></div></button>)}</div></article>
      </section>
      <Drawer open={Boolean(active)} onClose={() => setActive(null)} title={active?.title ?? ""} eyebrow={active?.id}>
        {active && <><div style={{display:"flex",gap:8,alignItems:"center"}}><SeverityBadge severity={active.severity}/><span className="badge status-degraded">{active.status}</span></div><div className="detail-grid"><div className="detail-item"><small>الخدمة المتأثرة</small><strong className="ltr">{active.service}</strong></div><div className="detail-item"><small>النطاق المتأثر</small><strong>{active.affectedArea}</strong></div><div className="detail-item"><small>وقت البدء</small><strong>{formatDate(active.startedAt,true)}</strong></div><div className="detail-item"><small>أثر المستخدم</small><strong>تأخير جزئي، دون فقد بيانات</strong></div></div><h3 style={{marginTop:22}}>الإجراءات والخط الزمني</h3><div className="timeline">{active.timeline.map((item) => <div className="timeline-item" key={item}>{item}</div>)}</div><div className="privacy-notice" style={{marginTop:22}}><Activity size={18}/> الحالة الحالية: الفريق يراقب التعافي ويحدّث الملاحظات الداخلية.</div></>}
      </Drawer>
    </div>
  );
}
