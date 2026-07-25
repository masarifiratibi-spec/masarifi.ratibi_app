"use client";

import { AlertTriangle, ArrowDownLeft, ArrowUpLeft, CheckCircle2, CircleAlert, Info, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Metric, Severity, SystemStatus } from "@/types/admin";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function MetricCard({ metric, primary = false }: { metric: Metric; primary?: boolean }) {
  return (
    <article className={`metric-card ${primary ? "metric-primary" : ""} tone-${metric.tone ?? "default"}`}>
      <div className="metric-top"><span>{metric.label}</span>{metric.change !== undefined && <Trend value={metric.change} />}</div>
      <strong className="metric-value numbers">{metric.value}</strong>
      {metric.note && <small>{metric.note}</small>}
    </article>
  );
}

export function Trend({ value }: { value: number }) {
  const positive = value >= 0;
  return <span className={`trend ${positive ? "positive" : "negative"}`}>{positive ? <ArrowUpLeft size={14} /> : <ArrowDownLeft size={14} />}<b className="numbers">{Math.abs(value)}%</b></span>;
}

const severityLabels: Record<Severity, string> = { info: "معلومات", low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
const statusLabels: Record<SystemStatus, string> = { operational: "يعمل", degraded: "متراجع", "partial-outage": "انقطاع جزئي", "major-outage": "انقطاع رئيسي", maintenance: "صيانة" };

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = severity === "critical" || severity === "high" ? AlertTriangle : severity === "medium" ? CircleAlert : Info;
  return <span className={`badge severity-${severity}`}><Icon size={13} />{severityLabels[severity]}</span>;
}

export function StatusBadge({ status }: { status: SystemStatus }) {
  const Icon = status === "operational" ? CheckCircle2 : status === "maintenance" ? LoaderCircle : AlertTriangle;
  return <span className={`badge status-${status}`}><Icon size={13} />{statusLabels[status]}</span>;
}

export function Drawer({ open, onClose, title, eyebrow, children }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="drawer" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }} aria-labelledby="drawer-title">
      <div className="drawer-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id="drawer-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button></div>
      <div className="drawer-content">{children}</div>
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirmation" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }} aria-labelledby="confirm-title">
      <div className="confirm-icon"><AlertTriangle size={22} /></div>
      <h2 id="confirm-title">{title}</h2><p>{children}</p>
      <div className="dialog-actions"><button className="button secondary" onClick={onClose}>إلغاء</button><button className="button primary" onClick={() => { onConfirm(); onClose(); }}>تأكيد</button></div>
    </dialog>
  );
}

export function EmptyState({ title = "لا توجد نتائج", message = "جرّب تعديل معايير البحث أو مسح عوامل التصفية." }: { title?: string; message?: string }) {
  return <div className="state-box"><SearchStateIcon /><strong>{title}</strong><p>{message}</p></div>;
}

function SearchStateIcon() { return <CircleAlert size={28} />; }
export function ErrorState() { return <div className="state-box error"><AlertTriangle size={28} /><strong>تعذر تحميل البيانات</strong><p>حاول مرة أخرى. هذه حالة عرض تجريبية.</p></div>; }
export function TableSkeleton() { return <div className="skeleton-list" aria-label="جارٍ التحميل">{[1,2,3,4].map((item) => <span key={item} />)}</div>; }
