"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/core/localization/provider";
import { mocksEnabled } from "@/core/api/client";
import { ApiError } from "@/core/api/errors";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import { SessionExpired } from "@/components/admin/SessionExpired";
import { AccessDeniedState, ConfirmDialog, ConflictState, ErrorState, LoadingState, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/lib/admin-utils";
import type { AccessScope, TemporaryWorkspace } from "./contracts";
import { useEndTemporaryAccess, useTemporaryWorkspace } from "./hooks";

const scopeNames: Record<AccessScope, [string, string]> = {
  "profile-contact": ["بيانات التواصل المخفية", "Masked contact data"], "account-status": ["حالة الحساب", "Account status"],
  "device-diagnostics": ["تشخيص الأجهزة", "Device diagnostics"], "session-diagnostics": ["تشخيص الجلسات", "Session diagnostics"],
  "subscription-summary": ["ملخص الاشتراك", "Subscription summary"], "import-summary": ["ملخص الاستيراد", "Import summary"],
};
const fieldNames: Array<[string[], string, string]> = [
  [["emailMasked", "البريد الإلكتروني"], "البريد الإلكتروني", "Masked email"], [["phoneMasked"], "الهاتف المخفي", "Masked phone"],
  [["status", "الحالة"], "الحالة", "Status"], [["total", "الأجهزة المسجلة"], "الأجهزة المسجلة", "Registered devices"],
  [["active"], "النشط", "Active"], [["الجلسات النشطة"], "الجلسات النشطة", "Active sessions"], [["lastSeenAt"], "آخر ظهور", "Last seen"],
  [["available", "Unavailable"], "التوفر", "Availability"], [["اللغة"], "اللغة", "Language"],
  [["الخطة"], "الخطة", "Plan"], [["آخر مزامنة"], "آخر مزامنة", "Last sync"],
];

export function WorkspaceProjection({ workspace }: { workspace: TemporaryWorkspace }) {
  const { locale } = useLocale();
  const text = locale === "ar" ? { notice: "إشعار الوصول المؤقت", ticket: "التذكرة", assignee: "المكلّف", scope: "النطاق", expires: "ينتهي في", audit: "مرجع الوصول" }
    : { notice: "Temporary access notice", ticket: "Ticket", assignee: "Assignee", scope: "Scope", expires: "Expires", audit: "Access reference" };
  return (
    <>
      <aside className="privacy-notice workspace-banner" aria-label={text.notice}>
        <strong>{locale === "ar" ? "هذه مساحة دعم مؤقتة ومراقبة، وتعرض البيانات المعتمدة فقط." : "Time-limited monitored support access. Only approved fields are shown."}</strong>
        <span>{text.ticket}: <bdi>{workspace.supportTicketId}</bdi></span>
        <span>{text.assignee}: <bdi>{workspace.assignee}</bdi></span>
        <span>{text.scope}: {workspace.approvedScope.map(scope => scopeNames[scope][locale === "ar" ? 0 : 1]).join(locale === "ar" ? "، " : ", ")}</span>
        <span>{text.expires}: <time dateTime={workspace.expiresAt}>{formatDate(workspace.expiresAt, true)}</time></span>
        <span>{text.audit}: <bdi>{workspace.auditIndicator}</bdi></span>
      </aside>
      <div className="detail-grid workspace-sections">
        {workspace.sections.map((section) => (
          <section className="card" key={section.scope} aria-labelledby={`scope-${section.scope}`}>
            <h2 id={`scope-${section.scope}`}>{scopeNames[section.scope][locale === "ar" ? 0 : 1]}</h2>
            <dl>
              {section.fields.map((field) => (
                <div className="detail-item" data-classification={field.classification} key={field.label}>
                  <dt>{fieldNames.find(([aliases]) => aliases.includes(field.label))?.[locale === "ar" ? 1 : 2] ?? field.label}</dt><dd>{field.value === null ? (locale === "ar" ? "غير متاح" : "Unavailable") : mocksEnabled() && locale === "en" && typeof field.value === "string" ? ({ "نشط": "Active", "العربية": "Arabic", "متاحة": "Available" } as Record<string, string>)[field.value] ?? field.value : field.value}</dd>
                  <small>{locale === "ar" ? ({ masked: "مخفي", aggregate: "مجمّع", status: "حالة" } as const)[field.classification] : field.classification}</small>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}

export function ExpiredWorkspace() {
  const { locale } = useLocale();
  return (
    <section className="state-box error" role="alert" aria-live="assertive">
      <strong>{locale === "ar" ? "انتهت صلاحية الوصول المؤقت" : "Temporary access expired"}</strong>
      <p>{locale === "ar" ? "تمت إزالة المحتوى المحمي والمدخلات المحلية. يلزم اعتماد جديد للعودة." : "Protected content and local inputs were cleared. A new approval is required."}</p>
    </section>
  );
}

export function TemporaryAccessWorkspace({ requestId }: { requestId: string }) {
  const role = useSimulatedRole();
  const router = useRouter();
  const scenario = useSearchParams().get("__scenario") ?? undefined;
  const query = useTemporaryWorkspace(requestId, role, scenario);
  const gone = query.expired || (query.error instanceof ApiError && query.error.code === "gone");

  if (gone) return <ExpiredWorkspace />;
  if (query.isPending) return <LoadingState />;
  if (query.error instanceof ApiError && query.error.code === "forbidden") {
    return <AccessDeniedState permission="support.access.use" />;
  }
  if (query.error instanceof ApiError && query.error.code === "session_expired") {
    return <SessionExpired unsavedChanges temporary onReturn={() => router.replace(`/admin/access-requests/${requestId}`)} />;
  }
  if (query.error instanceof ApiError && ["conflict", "not_found"].includes(query.error.code)) {
    return <ConflictState />;
  }
  if (query.isError || !query.data) return <ErrorState error={query.error} />;
  return <ActiveWorkspace requestId={requestId} role={role} workspace={query.data} />;
}

function ActiveWorkspace({
  requestId,
  role,
  workspace,
}: {
  requestId: string;
  role: ReturnType<typeof useSimulatedRole>;
  workspace: TemporaryWorkspace;
}) {
  const router = useRouter();
  const endAccess = useEndTemporaryAccess(requestId, role);
  const { locale } = useLocale();
  const text = locale === "ar" ? {
    title: "مساحة الدعم المؤقتة", description: "تعرض هذه الصفحة الأقسام المعتمدة فقط، وتزيلها فور انتهاء الصلاحية.", end: "إنهاء الوصول", note: "ملاحظة محلية غير محفوظة",
    confirm: "إنهاء الوصول المؤقت", consequence: "سيُزال المحتوى فوراً ولن يمكن فتحه دون اعتماد جديد.", success: "تم إنهاء الوصول", failure: "تعذر إنهاء الوصول", conflict: "انتهى الوصول مسبقاً",
  } : {
    title: "Temporary support workspace", description: "Only approved sections are displayed and cleared when access expires.", end: "End access", note: "Unsaved local note",
    confirm: "End temporary access", consequence: "Protected content will be cleared. A new approval is required to reopen it.", success: "Access ended", failure: "Failed to end access", conflict: "Access has already ended",
  };
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="page">
      <PageHeader
        title={text.title}
        description={text.description}
        actions={<button className="button primary" onClick={() => setConfirmEnd(true)}>{text.end}</button>}
      />
      <WorkspaceProjection workspace={workspace} />
      <section className="card">
        <label htmlFor="workspace-note">{text.note}</label>
        <textarea id="workspace-note" className="input" value={note} onChange={(event) => setNote(event.target.value)} />
      </section>
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => endAccess.mutate({ expectedVersion: workspace.version }, { onSuccess: () => {
          setNote("");
          setConfirmEnd(false);
          router.replace(`/admin/access-requests/${requestId}`);
        } })}
        title={text.confirm}
        scope={workspace.approvedScope.join("، ")}
        consequence={text.consequence}
        permission="support.access.use"
        auditEvent={mocksEnabled() ? "admin.access.ended" : "security.end-support-access"}
        pending={endAccess.isPending}
        outcomes={{ success: text.success, failure: text.failure, conflict: text.conflict }}
      />
      {endAccess.error && (
        endAccess.error instanceof ApiError && endAccess.error.code === "forbidden"
          ? <AccessDeniedState permission="support.access.use" />
          : endAccess.error instanceof ApiError && endAccess.error.code === "conflict"
            ? <ConflictState />
            : <ErrorState error={endAccess.error} />
      )}
    </div>
  );
}
