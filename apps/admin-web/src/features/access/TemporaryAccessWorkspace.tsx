"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/core/api/errors";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import { SessionExpired } from "@/components/admin/SessionExpired";
import { AccessDeniedState, ConfirmDialog, ConflictState, ErrorState, LoadingState, PageHeader } from "@/components/admin/ui";
import { formatDate } from "@/lib/admin-utils";
import type { TemporaryWorkspace } from "./contracts";
import { useEndTemporaryAccess, useTemporaryWorkspace } from "./hooks";

export function WorkspaceProjection({ workspace }: { workspace: TemporaryWorkspace }) {
  return (
    <>
      <aside className="privacy-notice workspace-banner" aria-label="إشعار الوصول المؤقت">
        <strong>{workspace.accessNotice}</strong>
        <span>التذكرة: <bdi>{workspace.supportTicketId}</bdi></span>
        <span>المكلّف: <bdi>{workspace.assignee}</bdi></span>
        <span>النطاق: {workspace.approvedScope.join("، ")}</span>
        <span>ينتهي في: <time dateTime={workspace.expiresAt}>{formatDate(workspace.expiresAt, true)}</time></span>
        <span>التدقيق: <bdi>{workspace.auditIndicator}</bdi></span>
      </aside>
      <div className="detail-grid workspace-sections">
        {workspace.sections.map((section) => (
          <section className="card" key={section.scope} aria-labelledby={`scope-${section.scope}`}>
            <h2 id={`scope-${section.scope}`}>{section.title}</h2>
            <dl>
              {section.fields.map((field) => (
                <div className="detail-item" data-classification={field.classification} key={field.label}>
                  <dt>{field.label}</dt><dd>{field.value}</dd>
                  <small>{field.classification}</small>
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
  return (
    <section className="state-box error" role="alert" aria-live="assertive">
      <strong>انتهت صلاحية الوصول المؤقت</strong>
      <p>تمت إزالة المحتوى المحمي والمدخلات المحلية. يلزم اعتماد جديد للعودة.</p>
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
  if (query.isError || !query.data) return <ErrorState />;
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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="page">
      <PageHeader
        title="مساحة الدعم المؤقتة"
        description="تعرض هذه الصفحة الأقسام المعتمدة فقط، وتزيلها فور انتهاء الصلاحية."
        actions={<button className="button primary" onClick={() => setConfirmEnd(true)}>إنهاء الوصول</button>}
      />
      <WorkspaceProjection workspace={workspace} />
      <section className="card">
        <label htmlFor="workspace-note">ملاحظة محلية غير محفوظة</label>
        <textarea id="workspace-note" className="input" value={note} onChange={(event) => setNote(event.target.value)} />
      </section>
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => endAccess.mutate({}, { onSuccess: () => {
          setNote("");
          setConfirmEnd(false);
          router.replace(`/admin/access-requests/${requestId}`);
        } })}
        title="إنهاء الوصول المؤقت"
        scope={workspace.approvedScope.join("، ")}
        consequence="سيُزال المحتوى فوراً ولن يمكن فتحه دون اعتماد جديد."
        permission="support.access.revoke"
        auditEvent="admin.access.ended"
        pending={endAccess.isPending}
        outcomes={{ success: "تم إنهاء الوصول", failure: "تعذر إنهاء الوصول", conflict: "انتهى الوصول مسبقاً" }}
      />
      {endAccess.error && (
        endAccess.error instanceof ApiError && endAccess.error.code === "forbidden"
          ? <AccessDeniedState permission="support.access.revoke" />
          : endAccess.error instanceof ApiError && endAccess.error.code === "conflict"
            ? <ConflictState />
            : <ErrorState />
      )}
    </div>
  );
}
