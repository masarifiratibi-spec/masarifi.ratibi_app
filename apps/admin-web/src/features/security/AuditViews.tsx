"use client";

import { ErrorState, LoadingState, PageHeader } from "@/components/admin/ui";
import { getActionLabel, getSeverityLabel, getStatusLabel } from "@/core/localization/display-labels";
import { useLocale } from "@/core/localization/provider";
import { useAuditEvent, useSecurityList } from "./hooks";
import type { AuditEventDetail, AuditEventSummary } from "./contracts";

function Id({ value }: { value: string }) {
  return <bdi className="ltr">{value}</bdi>;
}

function TextValue({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span>-</span>;
  if (typeof value === "number") return <span className="numbers">{value}</span>;
  return <span>{String(value)}</span>;
}

function Badge({ value, tone = "neutral" }: { value: string; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <span className={`badge badge-${tone}`}>{value}</span>;
}

function resultTone(result: string): "success" | "warning" | "danger" {
  return result === "success" ? "success" : result === "blocked" ? "warning" : "danger";
}

function severityTone(severity: string): "danger" | "warning" | "success" | "info" {
  return severity === "critical" || severity === "high" ? "danger" : severity === "medium" ? "warning" : severity === "low" ? "success" : "info";
}

const copy = {
  ar: {
    action: "الإجراء",
    actor: "المسؤول",
    after: "بعد",
    auditId: "معرف التدقيق",
    beforeAndAfter: "قبل وبعد",
    comparison: "مقارنة الحالة فقط",
    correlation: "الارتباط",
    detailDescription: "بيانات مسموحة فقط؛ سجل التدقيق ثابت ولا يمكن تعديله.",
    entries: "سجلات ثابتة",
    event: "الحدث",
    eventList: "قائمة أحداث التدقيق",
    evidence: "الدليل",
    immutableRecord: "سجل ثابت",
    listCaption: "سجلات التدقيق",
    listDescription: "دليل تدقيق ثابت ومنقح بدون إجراءات إنشاء أو تعديل أو حذف.",
    metadata: "البيانات الوصفية",
    metadataFields: "حقول مسموحة",
    region: "المنطقة",
    resource: "المورد",
    result: "النتيجة",
    severity: "الخطورة",
    target: "الهدف",
    timestamp: "التوقيت",
    title: "سجلات التدقيق",
    time: "الوقت",
  },
  en: {
    action: "Action",
    actor: "Actor",
    after: "After",
    auditId: "Audit ID",
    beforeAndAfter: "Before and After",
    comparison: "State comparison only",
    correlation: "Correlation",
    detailDescription: "Allowlisted metadata only; audit evidence is immutable.",
    entries: "immutable entries",
    event: "Event",
    eventList: "Audit event list",
    evidence: "Evidence",
    immutableRecord: "immutable record",
    listCaption: "Audit log entries",
    listDescription: "Immutable, sanitized audit evidence with no create, edit, delete, retry, rollback, or replace action.",
    metadata: "Metadata",
    metadataFields: "allowlisted fields",
    region: "Region",
    resource: "Resource",
    result: "Result",
    severity: "Severity",
    target: "Target",
    timestamp: "Timestamp",
    title: "Audit Logs",
    time: "Time",
  },
} as const;

function DetailCard({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`audit-detail-item${className ? ` ${className}` : ""}`}>
      <small>{label}</small>
      <strong>{children}</strong>
    </div>
  );
}

function MetadataGrid({ rows }: { rows: AuditEventDetail["metadata"] }) {
  return (
    <div className="audit-detail-grid audit-metadata-grid">
      {rows.map((entry) => (
        <DetailCard key={entry.key} label={entry.label}>
          <TextValue value={entry.value} />
        </DetailCard>
      ))}
    </div>
  );
}

export function AuditExplorerRoute() {
  const query = useSecurityList("audit", { page: 1, pageSize: 25 });
  const { locale } = useLocale();
  const c = copy[locale];
  return (
    <div className="page">
      <PageHeader title={c.title} description={c.listDescription} />
      {query.isPending ? <LoadingState /> : query.isError ? <ErrorState /> : (
        <section className="table-card ops-table-card audit-table-card" aria-labelledby="audit-title">
          <div className="card-heading ops-card-heading"><div><h2 id="audit-title">{c.eventList}</h2><p>{query.data.pagination.totalItems} {c.entries}</p></div></div>
          <AuditTable events={query.data.items as AuditEventSummary[]} />
        </section>
      )}
    </div>
  );
}

function AuditTable({ events }: { events: AuditEventSummary[] }) {
  const { locale } = useLocale();
  const c = copy[locale];
  return (
    <>
      <div className="desktop-table">
        <table className="data-table ops-data-table audit-data-table">
          <caption>{c.listCaption}</caption>
          <thead><tr><th>{c.auditId}</th><th>{c.event}</th><th>{c.actor}</th><th>{c.target}</th><th>{c.result}</th><th>{c.severity}</th><th>{c.timestamp}</th></tr></thead>
          <tbody>{events.map((event) => (
            <tr key={event.id}>
              <td><a className="table-link audit-id-link" href={`/admin/audit/${event.id}`}><Id value={event.id} /></a><small><Id value={event.correlationId} /></small></td>
              <td><strong className="audit-event-key"><Id value={event.action} /></strong><small>{getActionLabel(locale, event.action)} · {event.resource}</small></td>
              <td>{event.actor.label}</td>
              <td>{event.target.label}</td>
              <td><Badge value={getStatusLabel(locale, event.result)} tone={resultTone(event.result)} /></td>
              <td><Badge value={getSeverityLabel(locale, event.severity)} tone={severityTone(event.severity)} /></td>
              <td className="audit-time-cell"><Id value={event.occurredAt} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mobile-cards ops-mobile-cards">{events.map((event) => (
        <article className="mobile-data-card" key={event.id}>
          <div className="mobile-data-head"><a className="table-link audit-id-link" href={`/admin/audit/${event.id}`}><Id value={event.id} /></a><Badge value={getStatusLabel(locale, event.result)} tone={resultTone(event.result)} /></div>
          <strong className="audit-event-key"><Id value={event.action} /></strong>
          <p>{event.actor.label} · {event.resource} · {event.target.label}</p>
          <div className="mobile-data-meta"><div><small>{c.severity}</small><Badge value={getSeverityLabel(locale, event.severity)} tone={severityTone(event.severity)} /></div><div><small>{c.time}</small><Id value={event.occurredAt} /></div></div>
        </article>
      ))}</div>
    </>
  );
}

export function AuditEventDetailRoute({ eventId }: { eventId: string }) {
  const event = useAuditEvent(eventId);
  const { locale } = useLocale();
  const c = copy[locale];
  if (event.isPending) return <div className="page"><LoadingState /></div>;
  if (event.isError) return <div className="page"><ErrorState /></div>;
  const data = event.data;
  return (
    <div className="page">
      <PageHeader title={`Audit Event ${data.id}`} description={c.detailDescription} />
      <section className="table-card audit-detail-card" aria-labelledby="audit-evidence-title">
        <div className="card-heading ops-card-heading"><div><h2 id="audit-evidence-title">{c.evidence}</h2><p><Id value={data.id} /> · {c.immutableRecord}</p></div></div>
        <div className="audit-detail-grid">
          <DetailCard label={c.result}><Badge value={getStatusLabel(locale, data.result)} tone={resultTone(data.result)} /></DetailCard>
          <DetailCard label={c.action} className="audit-detail-wide"><span className="audit-event-key"><Id value={data.action} /></span></DetailCard>
          <DetailCard label={c.region}>{data.region}</DetailCard>
          <DetailCard label={c.correlation}><Id value={data.correlationId} /></DetailCard>
        </div>
      </section>
      <section className="table-card audit-detail-card" aria-labelledby="audit-metadata-title">
        <div className="card-heading ops-card-heading"><div><h2 id="audit-metadata-title">{c.metadata}</h2><p>{data.metadata.length} {c.metadataFields}</p></div></div>
        <MetadataGrid rows={data.metadata} />
      </section>
      <section className="table-card audit-detail-card" aria-labelledby="audit-before-after-title">
        <div className="card-heading ops-card-heading"><div><h2 id="audit-before-after-title">{c.beforeAndAfter}</h2><p>{c.comparison}</p></div></div>
        <div className="audit-comparison-grid">
          {data.before.map((entry) => (
            <DetailCard className="audit-compare-before" key={`before-${entry.key}`} label={entry.label}>
              <TextValue value={entry.value} />
            </DetailCard>
          ))}
          {data.after.map((entry) => (
            <DetailCard className="audit-compare-after" key={`after-${entry.key}`} label={entry.label}>
              <TextValue value={entry.value} />
            </DetailCard>
          ))}
        </div>
      </section>
    </div>
  );
}
