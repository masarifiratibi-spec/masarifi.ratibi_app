"use client";

import { FileSearch, FilterX, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard, TrendChart, VolumeChart } from "@/components/admin/Charts";
import { ConfirmDialog, Drawer, MetricCard, PageHeader, SeverityBadge } from "@/components/admin/ui";
import { failedImports, failureTrend, importMetrics, importSourceVolume } from "@/data/admin/imports";
import { formatDate } from "@/lib/admin-utils";
import type { ImportRecord } from "@/types/admin";

export default function ImportsPage() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [active, setActive] = useState<ImportRecord | null>(null);
  const [retry, setRetry] = useState<ImportRecord | null>(null);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => failedImports.filter((item) => (!query || `${item.id} ${item.user} ${item.bank}`.toLowerCase().includes(query.toLowerCase())) && (!source || item.source === source)), [query, source]);
  return (
    <div className="page">
      <PageHeader eyebrow="العمليات / الاستيراد" title="الاستيراد والأتمتة" description="مراقبة التقاط المعاملات آلياً ومراجعة الحالات التي تحتاج تدخلاً." actions={<button className="button primary" onClick={() => document.getElementById("failed-imports")?.scrollIntoView({behavior:"smooth"})}><FileSearch size={16}/><span>مراجعة الفشل</span></button>} />
      {message && <div className="privacy-notice" role="status" style={{marginBottom:14}}><RefreshCw size={17}/>{message}</div>}
      <div className="metrics-grid">{importMetrics.slice(0,4).map((metric,index) => <MetricCard metric={metric} primary={index < 2} key={metric.label}/>)}</div>
      <div className="summary-strip" style={{marginTop:14}}>{importMetrics.slice(4).map((metric) => <div className="summary-item" key={metric.label}><small>{metric.label}</small><strong className="numbers">{metric.value}</strong></div>)}</div>
      <section className="section-grid equal">
        <ChartCard title="حجم الاستيراد حسب المصدر" subtitle="ناجح مقابل فاشل · بالآلاف" summary="رسائل Android هي المصدر الأعلى حجماً، بينما الصور تسجل أكبر حجم فشل نسبي."><VolumeChart data={importSourceVolume} stacked/></ChartCard>
        <ChartCard title="اتجاه الفشل" subtitle="النسبة المئوية خلال آخر 6 أيام" summary="ارتفع معدل الفشل من 1.4 إلى 2.8 بالمئة."><TrendChart data={failureTrend}/></ChartCard>
      </section>
      <section className="section-grid equal">
        <article className="card"><div className="card-heading"><div><h2>معدل النجاح حسب المصدر</h2><p>آخر 30 يوماً</p></div></div><div className="progress-list">{[["Android SMS",96],["الإشعارات",97],["iOS Shortcut",98],["صور الإيصالات",88],["CSV",99]].map(([label,value]) => <div className="progress-row" key={label}><span>{label}</span><div className="progress-track"><span style={{width:`${value}%`}}/></div><strong className="numbers ltr">{value}%</strong></div>)}</div></article>
        <article className="card"><div className="card-heading"><div><h2>متوسط وقت المعالجة</h2><p>حسب المصدر</p></div></div><div className="progress-list">{[["SMS","0.4 ث",18],["الإشعارات","0.6 ث",26],["CSV","1.2 ث",48],["PDF","3.8 ث",78],["الصور","4.6 ث",94]].map(([label,value,width]) => <div className="progress-row" key={label}><span>{label}</span><div className="progress-track"><span style={{width:`${width}%`,background:"var(--bronze)"}}/></div><strong className="numbers">{value}</strong></div>)}</div></article>
      </section>
      <section id="failed-imports" style={{scrollMarginTop:90, marginTop:16}}>
        <div className="card-heading"><div><h2>عمليات الاستيراد الفاشلة</h2><p>بيانات منزوعة المحتوى الحساس ومخصصة للعرض.</p></div></div>
        <div className="toolbar"><div className="toolbar-filters"><label className="search-input"><Search size={17}/><span className="sr-only">بحث عمليات الاستيراد</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="معرّف العملية أو المستخدم"/></label><select className="select" value={source} onChange={(event) => setSource(event.target.value)} aria-label="المصدر"><option value="">كل المصادر</option>{[...new Set(failedImports.map((item) => item.source))].map((item) => <option key={item}>{item}</option>)}</select>{(query || source) && <button className="button ghost" onClick={() => {setQuery("");setSource("");}}><FilterX size={16}/> مسح</button>}</div></div>
        <div className="table-card">
          <div className="desktop-table"><table className="data-table"><thead><tr><th>المعرّف</th><th>المستخدم</th><th>المصدر</th><th>البنك</th><th>سبب الفشل</th><th>المحلل</th><th>المحاولات</th><th>الخطورة</th><th>الوقت</th><th>الإجراء</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><button className="table-link ltr" onClick={() => setActive(item)}>{item.id}</button></td><td className="ltr">{item.user}</td><td>{item.source}</td><td>{item.bank}</td><td>{item.failureType}</td><td className="ltr">{item.parserVersion}</td><td>{item.attempts}</td><td><SeverityBadge severity={item.severity}/></td><td>{formatDate(item.time,true)}</td><td><button className="button" onClick={() => setRetry(item)}>إعادة المحاولة</button></td></tr>)}</tbody></table></div>
          <div className="mobile-cards" style={{padding:10}}>{filtered.map((item) => <article className="mobile-data-card" key={item.id}><div className="mobile-data-head"><div><strong className="ltr">{item.id}</strong><small>{item.source}</small></div><SeverityBadge severity={item.severity}/></div><div className="mobile-data-meta"><div><small>الفشل</small><strong>{item.failureType}</strong></div><div><small>المحلل</small><strong className="ltr">{item.parserVersion}</strong></div></div><div className="mobile-data-actions"><button className="button" onClick={() => setActive(item)}>التفاصيل</button><button className="button primary" onClick={() => setRetry(item)}>إعادة المحاولة</button></div></article>)}</div>
        </div>
      </section>
      <Drawer open={Boolean(active)} onClose={() => setActive(null)} title={`تفاصيل ${active?.id ?? ""}`} eyebrow="بيانات معالجة منقحة">
        {active && <><div className="privacy-notice">لا يظهر المحتوى الخام أو أرقام الحسابات أو بيانات الكشوف.</div><div className="detail-grid">{[["المصدر",active.source],["المنصة",active.platform],["البنك",active.bank],["إصدار التطبيق",active.appVersion],["المحلل",active.parserVersion],["سبب الفشل",active.failureType],["المحاولات",String(active.attempts)],["الحالة",active.status]].map(([label,value]) => <div className="detail-item" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="card" style={{marginTop:18}}><h3>نتيجة الاستخراج المنقحة</h3><p style={{color:"var(--text-muted)"}}>{active.sanitizedResult}</p></div><h3 style={{marginTop:22}}>الخط الزمني</h3><div className="timeline">{["استلام المصدر وتطبيق التنقية","تشغيل المحلل المحدد","تسجيل سبب الفشل دون حفظ المحتوى الخام"].map((item) => <div className="timeline-item" key={item}>{item}</div>)}</div><div className="dialog-actions"><button className="button">إضافة ملاحظة</button><button className="button">إسناد مشكلة محلل</button><button className="button primary" onClick={() => setRetry(active)}>إعادة المحاولة</button></div></>}
      </Drawer>
      <ConfirmDialog open={Boolean(retry)} onClose={() => setRetry(null)} onConfirm={() => setMessage(`تمت جدولة إعادة محاولة ${retry?.id} بنجاح.`)} title="إعادة محاولة الاستيراد">سيُعاد تشغيل المعالجة باستخدام أحدث قاعدة محلل متاحة. لا تتغير البيانات الأصلية.</ConfirmDialog>
    </div>
  );
}
