"use client";

import { AlertTriangle, ArrowDownLeft, ArrowUpLeft, CheckCircle2, CircleAlert, Info, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { Locale } from "@/core/localization/direction";
import { getSeverityLabel, getStatusLabel } from "@/core/localization/display-labels";
import { useLocale, useT } from "@/core/localization/provider";
import type { Metric, Severity, SystemStatus } from "@/types/admin";

export interface RegionStateLike {
  availability?: "available" | "empty" | "stale" | "partial" | "unavailable" | "forbidden";
  message?: string;
  retryable?: boolean;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p><span dir="auto">{description}</span></p></div>
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
      {metric.context && <span className="sr-only">{metric.context}</span>}
    </article>
  );
}

export function Trend({ value }: { value: number }) {
  const positive = value >= 0;
  return <span className={`trend ${positive ? "positive" : "negative"}`}>{positive ? <ArrowUpLeft size={14} /> : <ArrowDownLeft size={14} />}<b className="numbers">{Math.abs(value)}%</b></span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { locale } = useLocale();
  const Icon = severity === "critical" || severity === "high" ? AlertTriangle : severity === "medium" ? CircleAlert : Info;
  return <span className={`badge severity-${severity}`}><Icon size={13} />{getSeverityLabel(locale, severity)}</span>;
}

export function StatusBadge({ status }: { status: SystemStatus }) {
  const { locale } = useLocale();
  const Icon = status === "operational" ? CheckCircle2 : status === "maintenance" ? LoaderCircle : AlertTriangle;
  return <span className={`badge status-${status}`}><Icon size={13} />{getStatusLabel(locale, status)}</span>;
}

export function Drawer({ open, onClose, title, eyebrow, children, className }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const t = useT();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      trigger.current?.focus();
    }
    return () => trigger.current?.focus();
  }, [open]);
  return (
    <dialog ref={ref} className={`drawer${className ? ` ${className}` : ""}`} onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }} aria-labelledby="drawer-title">
      <div className="drawer-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id="drawer-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label={t("common.close")}><X size={20} /></button></div>
      <div className="drawer-content">{children}</div>
    </dialog>
  );
}

export interface ConfirmOutcomes {
  success: string;
  failure: string;
  conflict: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  scope,
  consequence,
  permission,
  auditEvent,
  pending,
  confirmDisabled = false,
  outcomes,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  scope: string;
  consequence: string;
  permission: string;
  auditEvent: string;
  pending: boolean;
  confirmDisabled?: boolean;
  outcomes: ConfirmOutcomes;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const trigger = useRef<HTMLElement | null>(null);
  const t = useT();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      trigger.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
      trigger.current?.focus();
    }
    return () => trigger.current?.focus();
  }, [open]);
  return (
    <dialog ref={ref} className="confirmation" onClose={onClose} onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }} aria-labelledby={titleId}>
      <div className="confirmation-body">
        <div className="confirm-icon"><AlertTriangle size={22} /></div>
        <h2 id={titleId}>{title}</h2>
        {children && <div className="confirmation-fields">{children}</div>}
        <dl className="confirmation-details">
          <div><dt>{t("confirmation.scope")}</dt><dd>{scope}</dd></div>
          <div><dt>{t("confirmation.consequence")}</dt><dd>{consequence}</dd></div>
          <div><dt>{t("confirmation.permission")}</dt><dd className="ltr">{permission}</dd></div>
          <div><dt>{t("confirmation.auditEvent")}</dt><dd className="ltr">{auditEvent}</dd></div>
        </dl>
        <span className="sr-only">{outcomes.success}. {outcomes.failure}. {outcomes.conflict}.</span>
      </div>
      <div className="dialog-actions"><button className="button secondary" disabled={pending} onClick={onClose}>{t("common.cancel")}</button><button className="button primary" disabled={pending || confirmDisabled} onClick={onConfirm}>{pending ? t("confirmation.pending") : t("common.confirm")}</button></div>
    </dialog>
  );
}

export function EmptyState({ title, message }: { title?: string; message?: string }) {
  const t = useT();
  return <div className="state-box"><SearchStateIcon /><strong>{title ?? t("common.noResults")}</strong><p>{message ?? t("states.emptyMessage")}</p></div>;
}

function SearchStateIcon() { return <CircleAlert size={28} />; }
export function ErrorState() { const t = useT(); return <div className="state-box error"><AlertTriangle size={28} /><strong>{t("states.errorTitle")}</strong><p>{t("states.errorMessage")}</p></div>; }
export function TableSkeleton() { const t = useT(); return <div className="skeleton-list" aria-label={t("common.loading")}>{[1,2,3,4].map((item) => <span key={item} />)}</div>; }
export function LoadingState() { const t = useT(); return <div className="state-box" role="status"><LoaderCircle size={28} /><strong>{t("states.loading")}</strong></div>; }
export function SuccessState({ message }: { message?: string }) { const t = useT(); return <div className="state-box state-warning" role="status"><CheckCircle2 size={28} /><strong>{message ?? t("states.success")}</strong></div>; }
export function WarningState({ message }: { message?: string }) { const t = useT(); return <div className="state-box state-warning" role="status"><AlertTriangle size={28} /><strong>{message ?? t("states.warning")}</strong></div>; }
export function ConflictState() { const t = useT(); return <div className="state-box state-warning" role="alert"><CircleAlert size={28} /><strong>{t("states.conflictTitle")}</strong><p>{t("states.conflictMessage")}</p></div>; }
export function UnavailableState() { const t = useT(); return <div className="state-box error" role="alert"><AlertTriangle size={28} /><strong>{t("states.unavailableTitle")}</strong><p>{t("states.unavailableMessage")}</p></div>; }
export function AccessDeniedState({ permission }: { permission: string }) { const t = useT(); return <div className="state-box error" role="alert"><ShieldIcon /><strong>{t("states.accessDenied")}</strong><p className="ltr">{permission}</p></div>; }
function ShieldIcon() { return <CircleAlert size={28} />; }

export function RegionState({
  isPending,
  isError,
  region,
  error,
  onRetry,
  emptyLabel,
  permission = "attention.read",
  children,
}: {
  isPending: boolean;
  isError: boolean;
  region?: RegionStateLike;
  error?: { code?: string };
  onRetry?: () => void;
  emptyLabel?: string;
  permission?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  if (isPending) return <LoadingState />;
  const availability = region?.availability;
  if (isError || availability === "unavailable") {
    const isForbidden = error?.code === "forbidden" || availability === "forbidden";
    return (
      <div className="region-failure" role="alert">
        {isForbidden ? <AccessDeniedState permission={permission} /> : <ErrorState />}
        {onRetry && (region?.retryable ?? true) && (
          <div className="region-retry">
            <button className="button" type="button" onClick={onRetry}><RefreshCw size={15} /><span>{t("common.retry")}</span></button>
          </div>
        )}
      </div>
    );
  }
  if (availability === "forbidden") return <AccessDeniedState permission={permission} />;
  if (availability === "empty") return <EmptyState title={t("common.noData")} message={region?.message ?? emptyLabel ?? t("common.noData")} />;
  const stale = availability === "stale";
  const partial = availability === "partial";
  return (
    <>
      {(stale || partial) && region?.message && (
        <p className={`region-warning${stale ? " region-stale" : ""}`} role="status">
          <AlertTriangle size={14} /> {region.message}
        </p>
      )}
      {children}
    </>
  );
}

export function MetricContext({ kind, scope, period, freshness }: {
  kind: string;
  scope: string;
  period: string;
  freshness?: string;
}) {
  const { locale } = useLocale();
  const labels: Record<string, Record<Locale, string>> = {
    "unique-customers": { ar: "عملاء فريدون", en: "Unique customers" },
    devices: { ar: "أجهزة", en: "Devices" },
    events: { ar: "أحداث", en: "Events" },
    imports: { ar: "واردات", en: "Imports" },
    requests: { ar: "طلبات", en: "Requests" },
    payments: { ar: "مدفوعات", en: "Payments" },
    tickets: { ar: "تذاكر", en: "Tickets" },
    currency: { ar: "عملة", en: "Currency" },
    all: { ar: "الكل", en: "All" },
    ios: { ar: "iOS", en: "iOS" },
    android: { ar: "Android", en: "Android" },
    global: { ar: "عام", en: "Global" },
    unknown: { ar: "غير معروف", en: "Unknown" },
    "7d": { ar: "7 أيام", en: "7 days" },
    "30d": { ar: "30 يوم", en: "30 days" },
    "90d": { ar: "90 يوم", en: "90 days" },
    fresh: { ar: "حديث", en: "Fresh" },
    stale: { ar: "قديم", en: "Stale" },
    partial: { ar: "جزئي", en: "Partial" },
    unavailable: { ar: "غير متاح", en: "Unavailable" },
  };
  const localLabel = (value: string) => labels[value]?.[locale] ?? value;
  return (
    <small className="metric-context">
      <span>{localLabel(kind)}</span>
      <span>·</span>
      <span>{localLabel(scope)}</span>
      <span>·</span>
      <span>{localLabel(period)}</span>
      {freshness && <><span>·</span><span>{localLabel(freshness)}</span></>}
    </small>
  );
}
