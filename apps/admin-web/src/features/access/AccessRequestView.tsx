"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@/core/api/errors";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import { useLocale } from "@/core/localization/provider";
import { SIMULATED_ACTORS } from "@/core/permissions/role-map";
import { useCurrentPermission } from "@/core/permissions/current-permissions";
import { apiActorCacheKey, mocksEnabled } from "@/core/api/client";
import { formatDate } from "@/lib/admin-utils";
import {
  AccessDeniedState,
  ConfirmDialog,
  ConflictState,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/admin/ui";
import {
  accessDecisionRequestSchema,
  accessStatusSchema,
  createAccessRequestSchema,
  revokeAccessRequestSchema,
  type AccessDecisionRequest,
  type AccessRequestSummary,
  type AccessScope,
  type AccessStatus,
  type CreateAccessRequest,
  type RevokeAccessRequest,
} from "./contracts";
import {
  useAccessRequest,
  useAccessRequests,
  useCreateAccessRequest,
  useDecideAccessRequest,
  useRevokeAccessRequest,
} from "./hooks";

const accessCopy = {
  ar: {
    title: "طلبات الوصول المؤقت",
    description: "مراجعة طلبات الدعم محدودة النطاق والمدة دون كشف بيانات مالية.",
    statusFilter: "الحالة",
    allStatuses: "كل الحالات",
    cols: {
      request: "الطلب",
      customer: "العميل",
      ticket: "التذكرة",
      requester: "الطالب",
      scope: "النطاق",
      reason: "السبب",
      status: "الحالة",
      created: "الإنشاء",
      starts: "البدء",
      expires: "الانتهاء",
      approver: "المعتمد"
    },
    status: {
      pending: "قيد المراجعة",
      approved: "معتمد",
      active: "نشط",
      expired: "منتهي",
      rejected: "مرفوض",
      revoked: "ملغى",
    },
    form: {
      title: "طلب وصول مؤقت",
      userId: "معرّف العميل",
      ticketId: "تذكرة الدعم",
      assignee: "المكلّف",
      reason: "السبب",
      requestedScope: "النطاق المطلوب",
      scopeContact: "بيانات التواصل المخفية",
      scopeDevice: "تشخيص الأجهزة",
      scopeSession: "تشخيص الجلسات",
      scopeAccount: "حالة الحساب",
      scopeSub: "ملخص الاشتراك",
      scopeImport: "ملخص الاستيراد",
      durationMinutes: "المدة بالدقائق",
      customerApproval: "يتطلب موافقة العميل",
      submit: "مراجعة الطلب",
      validationError: "تحقق من الحقول المطلوبة والحدود المسموحة.",
      createError: "تعذر إنشاء الطلب.",
      confirmTitle: "تأكيد طلب الوصول",
      confirmConsequence: "إنشاء طلب معلق منفصل الصلاحيات ومخفي البيانات.",
      confirmSuccess: "تم إنشاء الطلب",
      confirmFailure: "تعذر إنشاء الطلب",
      confirmConflict: "يوجد طلب متداخل",
    },
    pagination: {
      aria: "صفحات طلبات الوصول",
      previous: "السابق",
      next: "التالي",
      page: "صفحة",
      of: "من",
    }
  },
  en: {
    title: "Temporary Access Requests",
    description: "Review time-limited, scoped support access requests without exposing financial data.",
    statusFilter: "Status",
    allStatuses: "All statuses",
    cols: {
      request: "Request",
      customer: "Customer",
      ticket: "Ticket",
      requester: "Requester",
      scope: "Scope",
      reason: "Reason",
      status: "Status",
      created: "Created",
      starts: "Starts",
      expires: "Expires",
      approver: "Approver"
    },
    status: {
      pending: "Pending",
      approved: "Approved",
      active: "Active",
      expired: "Expired",
      rejected: "Rejected",
      revoked: "Revoked",
    },
    form: {
      title: "Temporary access request",
      userId: "Customer ID",
      ticketId: "Support ticket",
      assignee: "Assignee",
      reason: "Reason",
      requestedScope: "Requested scope",
      scopeContact: "Hidden contact data",
      scopeDevice: "Device diagnostics",
      scopeSession: "Session diagnostics",
      scopeAccount: "Account status",
      scopeSub: "Subscription summary",
      scopeImport: "Import summary",
      durationMinutes: "Duration (minutes)",
      customerApproval: "Requires customer approval",
      submit: "Review request",
      validationError: "Check required fields and allowed limits.",
      createError: "Failed to create request.",
      confirmTitle: "Confirm access request",
      confirmConsequence: "Create pending request with isolated privileges and masked data.",
      confirmSuccess: "Request created",
      confirmFailure: "Failed to create request",
      confirmConflict: "Overlapping request exists",
    },
    pagination: {
      aria: "Access requests pages",
      previous: "Previous",
      next: "Next",
      page: "Page",
      of: "of",
    }
  }
} as const;

function describeScopes(request: AccessRequestSummary, resources: AccessScope[], approved = false) {
  const scopes = approved ? request.approvedScopeActions : request.requestedScopeActions;
  return resources.map(resource => { const actions = scopes?.find(scope => scope.resource === resource)?.actions; return actions ? `${resource} (${actions.join(", ")})` : resource; }).join(" · ");
}

export function AccessRequestRows({ requests }: { requests: AccessRequestSummary[] }) {
  const { locale } = useLocale();
  const copy = accessCopy[locale];
  return requests.map((request) => (
    <tr key={request.id}>
      <td className="ltr access-id-cell"><Link href={`/admin/access-requests/${request.id}`} aria-label={`${locale === "ar" ? "فتح طلب" : "Open request"} ${request.id}`}><strong>{request.id}</strong></Link></td>
      <td className="ltr access-compact-cell"><strong>{request.maskedCustomerLabel}</strong></td>
      <td className="ltr access-compact-cell">{request.supportTicketId}</td>
      <td className="ltr access-actor-cell">{request.requestedBy}</td>
      <td className="access-scope-cell">{describeScopes(request, request.requestedScope)}</td>
      <td className="access-reason-cell">{request.reasonSummary ?? "—"}</td>
      <td><span className={`badge access-status access-status-${request.status}`}>{copy.status[request.status]}</span></td>
      <td className="access-date-cell">{request.createdAt ? <time dateTime={request.createdAt}>{formatDate(request.createdAt, true)}</time> : "—"}</td>
      <td className="access-date-cell">{request.startsAt ? <time dateTime={request.startsAt}>{formatDate(request.startsAt, true)}</time> : "—"}</td>
      <td className="access-date-cell">{request.expiresAt ? <time dateTime={request.expiresAt}>{formatDate(request.expiresAt, true)}</time> : "—"}</td>
      <td className="ltr access-actor-cell">{request.approvedBy ?? "—"}</td>
    </tr>
  ));
}

function CreateAccessForm() {
  const role = useSimulatedRole();
  const can = useCurrentPermission();
  const { locale } = useLocale();
  const copy = accessCopy[locale];
  const mutation = useCreateAccessRequest(role);
  const [pendingConfirmation, setPendingConfirmation] = useState<CreateAccessRequest | null>(null);
  const form = useForm<CreateAccessRequest>({
    defaultValues: {
      userId: mocksEnabled() ? "USR-10461" : "",
      supportTicketId: mocksEnabled() ? "TKT-12002" : "",
      assignee: mocksEnabled() ? SIMULATED_ACTORS["support-agent"] : (apiActorCacheKey() === "anonymous" ? "" : apiActorCacheKey()),
      reason: "",
      requestedScope: ["profile-contact"],
      maskingRequired: true,
      durationMinutes: 30,
      customerApprovalRequired: false,
    },
  });
  if (!can("support.request_access")) return null;
  const validateRequest = (values: CreateAccessRequest) => {
    const parsed = createAccessRequestSchema.safeParse({ ...values, maskingRequired: true });
    if (parsed.success) setPendingConfirmation(parsed.data);
    else form.setError("root", { message: copy.form.validationError });
  };
  return (
    <section className="card access-create-card" aria-labelledby="create-access-title">
      <h2 id="create-access-title">{copy.form.title}</h2>
      <form className="access-create-form" onSubmit={form.handleSubmit(validateRequest)}>
        <div className="access-form-grid">
          <label className="access-field">{copy.form.userId}<input className="input ltr" {...form.register("userId")} /></label>
          <label className="access-field">{copy.form.ticketId}<input className="input ltr" {...form.register("supportTicketId")} /></label>
          <label className="access-field">{copy.form.assignee}<input className="input ltr" {...form.register("assignee")} /></label>
          <label className="access-field access-reason-field">{copy.form.reason}<textarea className="input" {...form.register("reason")} /></label>
        </div>
        <fieldset className="access-scope-fieldset">
          <legend>{copy.form.requestedScope}</legend>
          <label><input type="checkbox" value="profile-contact" {...form.register("requestedScope")} /> {copy.form.scopeContact}</label>
          <label><input type="checkbox" value="device-diagnostics" {...form.register("requestedScope")} /> {copy.form.scopeDevice}</label>
          <label><input type="checkbox" value="session-diagnostics" {...form.register("requestedScope")} /> {copy.form.scopeSession}</label>
          <label><input type="checkbox" value="account-status" {...form.register("requestedScope")} /> {copy.form.scopeAccount}</label>
          <label><input type="checkbox" value="subscription-summary" {...form.register("requestedScope")} /> {copy.form.scopeSub}</label>
          <label><input type="checkbox" value="import-summary" {...form.register("requestedScope")} /> {copy.form.scopeImport}</label>
        </fieldset>
        <div className="access-form-footer">
          <label className="access-field access-duration-field">{copy.form.durationMinutes}<input className="input" type="number" min={5} max={60} {...form.register("durationMinutes", { valueAsNumber: true })} /></label>
          <label className="access-checkbox-field"><input type="checkbox" {...form.register("customerApprovalRequired")} /> {copy.form.customerApproval}</label>
          <button className="button primary" disabled={mutation.isPending} type="submit">{copy.form.submit}</button>
        </div>
        {Object.keys(form.formState.errors).length > 0 && <p role="alert">{copy.form.validationError}</p>}
        {mutation.error && <p role="alert">{mutation.error instanceof ApiError ? mutation.error.message : copy.form.createError}</p>}
      </form>
      <ConfirmDialog
        open={pendingConfirmation !== null}
        onClose={() => setPendingConfirmation(null)}
        onConfirm={() => {
          if (!pendingConfirmation) return;
          mutation.mutate(pendingConfirmation, { onSuccess: () => {
            form.reset();
            setPendingConfirmation(null);
          } });
        }}
        title={copy.form.confirmTitle}
        scope={pendingConfirmation?.requestedScope.join(locale === "ar" ? "، " : ", ") ?? ""}
        consequence={copy.form.confirmConsequence}
        permission="support.request_access"
        auditEvent={mocksEnabled() ? "admin.access.requested" : "security.create-support-access-request"}
        pending={mutation.isPending}
        outcomes={{ success: copy.form.confirmSuccess, failure: copy.form.confirmFailure, conflict: copy.form.confirmConflict }}
      />
    </section>
  );
}

function AccessList() {
  const role = useSimulatedRole();
  const [status, setStatus] = useState<AccessStatus | "">("");
  const [page, setPage] = useState(1);
  const query = useAccessRequests({ ...(status ? { status } : {}), page }, role);
  const { locale } = useLocale();
  const copy = accessCopy[locale];
  return (
    <div className="page access-requests-page">
      <div className="access-page-toolbar">
        <PageHeader title={copy.title} description={copy.description} />
        <label className="access-status-filter">{copy.statusFilter}
          <select className="select" value={status} onChange={(event) => {
            setStatus(event.target.value ? accessStatusSchema.parse(event.target.value) : "");
            setPage(1);
          }}>
            <option value="">{copy.allStatuses}</option>
            {accessStatusSchema.options.filter(option => mocksEnabled() || option !== "active").map((option) => <option key={option} value={option}>{copy.status[option]}</option>)}
          </select>
        </label>
      </div>
      {query.isPending ? <LoadingState /> : query.isError ? <><ErrorState error={query.error} /><button className="button" onClick={() => void query.refetch()}>{locale === "ar" ? "إعادة المحاولة" : "Retry"}</button></> : !query.data?.items.length ? <EmptyState /> : (
        <div className="table-card access-table-card">
          <div className="desktop-table">
            <table className="data-table access-requests-table">
              <thead><tr><th>{copy.cols.request}</th><th>{copy.cols.customer}</th><th>{copy.cols.ticket}</th><th>{copy.cols.requester}</th><th>{copy.cols.scope}</th><th>{copy.cols.reason}</th><th>{copy.cols.status}</th><th>{copy.cols.created}</th><th>{copy.cols.starts}</th><th>{copy.cols.expires}</th><th>{copy.cols.approver}</th></tr></thead>
              <tbody><AccessRequestRows requests={query.data.items} /></tbody>
            </table>
          </div>
          <AccessRequestCards requests={query.data.items} />
          <nav aria-label={copy.pagination.aria} className="dialog-actions access-pagination">
            <button className="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{copy.pagination.previous}</button>
            <span>{copy.pagination.page} {page}{query.data.pagination.totalPages !== null && <> {copy.pagination.of} {query.data.pagination.totalPages || 1}</>}</span>
            <button className="button" disabled={query.data.pagination.hasNext === false || (query.data.pagination.totalPages !== null && page >= query.data.pagination.totalPages)} onClick={() => setPage((current) => current + 1)}>{copy.pagination.next}</button>
          </nav>
        </div>
      )}
      <CreateAccessForm />
    </div>
  );
}

export function AccessRequestCards({ requests }: { requests: AccessRequestSummary[] }) {
  const { locale } = useLocale();
  const copy = accessCopy[locale];
  return (
    <div className="mobile-cards access-request-cards" aria-label={copy.title}>
      {requests.map((request) => (
        <article className="card access-request-card" key={request.id}>
          <div className="access-request-card-head">
            <div>
              <Link className="ltr" href={`/admin/access-requests/${request.id}`}>{request.id}</Link>
              <strong className="ltr">{request.maskedCustomerLabel}</strong>
            </div>
            <span className={`badge access-status access-status-${request.status}`}>{copy.status[request.status]}</span>
          </div>
          <div className="access-request-card-meta">
            <span className="ltr">{request.supportTicketId}</span>
            <span>{copy.cols.requester}: <bdi>{request.requestedBy}</bdi></span>
          </div>
          <span className="access-request-card-scope">{copy.cols.scope}: {describeScopes(request, request.requestedScope)}</span>
          <p>{request.reasonSummary ?? "—"}</p>
          <div className="access-request-card-dates">
            <span>{copy.cols.created}: {request.createdAt ? <time dateTime={request.createdAt}>{formatDate(request.createdAt, true)}</time> : "—"}</span>
            <span>{copy.cols.starts}: {request.startsAt ? <time dateTime={request.startsAt}>{formatDate(request.startsAt, true)}</time> : "—"}</span>
            <span>{copy.cols.expires}: {request.expiresAt ? <time dateTime={request.expiresAt}>{formatDate(request.expiresAt, true)}</time> : "—"}</span>
            <span>{copy.cols.approver}: <bdi>{request.approvedBy ?? "—"}</bdi></span>
          </div>
        </article>
      ))}
    </div>
  );
}

function AccessDetail({ requestId }: { requestId: string }) {
  const role = useSimulatedRole();
  const can = useCurrentPermission();
  const actor = mocksEnabled() ? SIMULATED_ACTORS[role] : apiActorCacheKey();
  const { locale } = useLocale();
  const copy = accessCopy[locale];
  const text = locale === "ar" ? {
    title: "طلب الوصول", description: "تفاصيل مخفية ومسار قرار منفصل الصلاحيات.", assignee: "المكلّف",
    scope: "النطاق والتمويه", timeline: "الخط الزمني", noTimeline: "لا توجد أحداث معروضة من الخادم.",
    separation: "لا يمكن لمقدم الطلب اعتماد طلبه حفاظاً على فصل المهام.", approve: "اعتماد مخفض", reject: "رفض", revoke: "إلغاء الوصول", workspace: "فتح مساحة العمل",
    decision: "بيانات قرار الوصول", reason: "سبب القرار", approvedScope: "النطاق المعتمد", duration: "المدة المعتمدة", starts: "وقت البدء", cancel: "إلغاء", review: "مراجعة القرار",
    reasonError: "يجب إدخال سبب صالح من 5 إلى 500 حرف.", validation: "تحقق من السبب والنطاق والمدة ووقت البدء.",
    approveTitle: "اعتماد الطلب", rejectTitle: "رفض الطلب", success: "تم تحديث الطلب", failure: "تعذر تحديث الطلب", conflict: "الحالة لم تعد تقبل الإجراء",
  } : {
    title: "Access request", description: "Masked details with separate review authority.", assignee: "Assignee",
    scope: "Scope and masking", timeline: "Timeline", noTimeline: "No timeline events were provided by the server.",
    separation: "The requester cannot approve their own request to preserve separation of duties.", approve: "Approve limited access", reject: "Reject", revoke: "Revoke access", workspace: "Open workspace",
    decision: "Access decision details", reason: "Decision reason", approvedScope: "Approved scope", duration: "Approved duration", starts: "Start time", cancel: "Cancel", review: "Review decision",
    reasonError: "Enter a valid reason of 5 to 500 characters.", validation: "Check the reason, scope, duration and start time.",
    approveTitle: "Approve request", rejectTitle: "Reject request", success: "Request updated", failure: "Failed to update request", conflict: "The current state no longer permits this action",
  };
  const query = useAccessRequest(requestId, role);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const decision = useDecideAccessRequest(requestId, role);
  const revoke = useRevokeAccessRequest(requestId, role);
  const [action, setAction] = useState<"approve" | "reject" | "revoke" | null>(null);
  const [reason, setReason] = useState("");
  const [approvedScope, setApprovedScope] = useState<AccessScope[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [startsAt, setStartsAt] = useState("");
  const [validationError, setValidationError] = useState("");
  const [pendingAction, setPendingAction] = useState<
    { kind: "decision"; payload: AccessDecisionRequest } | { kind: "revoke"; payload: RevokeAccessRequest } | null
  >(null);
  if (query.isPending) return <LoadingState />;
  if (query.isError || !query.data) return <><ErrorState error={query.error} /><button className="button" onClick={() => void query.refetch()}>{locale === "ar" ? "إعادة المحاولة" : "Retry"}</button></>;
  const request = query.data;
  const actionError = decision.error ?? revoke.error;
  const canDecide = request.status === "pending"
    && request.requestedBy !== actor
    && request.reason !== null && request.requestedDurationMinutes !== null
    && (!request.expiresAt || Date.parse(request.expiresAt) > now)
    && can("support.access.approve");
  const canApprove = canDecide && request.customerApprovalState !== "pending";
  const openAction = (nextAction: "approve" | "reject" | "revoke") => {
    setAction(nextAction);
    setReason("");
    setApprovedScope(nextAction === "approve" ? request.requestedScope.slice(0, 1) : []);
    setDurationMinutes(Math.min(15, request.requestedDurationMinutes ?? 5));
    setStartsAt("");
    setValidationError("");
  };
  const validateAction = () => {
    if (action === "revoke") {
      const parsed = revokeAccessRequestSchema.safeParse({ reason });
      if (parsed.success) setPendingAction({ kind: "revoke", payload: { ...parsed.data, expectedVersion: request.version } });
      else setValidationError(text.reasonError);
      return;
    }
    if (!action) return;
    if (request.requestedDurationMinutes === null || request.reason === null) {
      setValidationError(locale === "ar" ? "الخادم لا يعرض تفاصيل المراجعة المطلوبة لهذا الطلب." : "The server has not provided this request's review details.");
      return;
    }
    const parsed = accessDecisionRequestSchema({
      requestedScope: request.requestedScope,
      requestedDurationMinutes: request.requestedDurationMinutes,
      requestedBy: request.requestedBy,
      actor,
    }).safeParse({
      decision: action,
      reason,
      ...(action === "approve" ? {
        approvedScope,
        durationMinutes,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      } : {}),
    });
    if (parsed.success) setPendingAction({ kind: "decision", payload: { ...parsed.data, expectedVersion: request.version } });
    else setValidationError(text.validation);
  };
  return (
    <div className="page">
      <PageHeader title={`${text.title} ${request.id}`} description={text.description} />
      <section className="card access-detail-card">
        <dl className="detail-grid access-detail-grid">
          <div><dt>{copy.cols.ticket}</dt><dd className="ltr">{request.supportTicketId}</dd></div>
          <div><dt>{copy.cols.customer}</dt><dd>{request.maskedCustomerLabel}</dd></div>
          <div><dt>{copy.cols.requester}</dt><dd className="ltr">{request.requestedBy}</dd></div>
          <div><dt>{text.assignee}</dt><dd className="ltr">{request.assignee}</dd></div>
          <div><dt>{copy.cols.status}</dt><dd>{copy.status[request.status]}</dd></div>
          <div><dt>{copy.form.durationMinutes}</dt><dd>{request.approvedDurationMinutes ?? request.requestedDurationMinutes ?? "—"}</dd></div>
        </dl>
        <p>{copy.form.customerApproval}: {locale === "ar" ? ({ "not-required": "غير مطلوبة", pending: "بانتظار موافقة العميل", received: "تم استلام الموافقة" } as const)[request.customerApprovalState] : ({ "not-required": "Not required", pending: "Awaiting customer consent", received: "Consent received" } as const)[request.customerApprovalState]}</p>
        <section className="access-detail-section"><h2>{copy.form.reason}</h2><p>{request.reason ?? (locale === "ar" ? "غير متاح من الخادم" : "Unavailable from the server")}</p></section>
        {(request.reason === null || request.requestedDurationMinutes === null) && <p role="note">{locale === "ar" ? "يلزم تحديث الخادم المتوافق قبل اعتماد هذا الطلب؛ تفاصيل المراجعة غير متاحة." : "A compatible server update is required before deciding this request; review details are unavailable."}</p>}
        <section className="access-detail-section">
          <h2>{text.scope}</h2>
          <p className="access-scope-summary ltr">{describeScopes(request, request.approvedScope ?? request.requestedScope, request.approvedScope !== null)}</p>
          <ul className="access-mask-list">{request.maskingRules.map((rule) => <li key={rule}>{rule === "Server-authorized masked, status and aggregate fields only" ? (locale === "ar" ? "حقول مخفية وحالات ومجاميع معتمدة من الخادم فقط" : rule) : mocksEnabled() && locale === "en" ? ({ "البريد الإلكتروني مخفي جزئياً": "Email is partially masked", "القيم المالية والتفاصيل الخام غير متاحة": "Financial values and raw details are unavailable", "المعرّفات التقنية الحساسة غير متاحة": "Sensitive technical identifiers are unavailable" } as Record<string, string>)[rule] ?? rule : rule}</li>)}</ul>
        </section>
        <section className="access-detail-section">
          <h2>{text.timeline}</h2>
          {request.timeline.length === 0 && <p>{text.noTimeline}</p>}<ol className="timeline access-detail-timeline">{request.timeline.map((entry) => <li className="timeline-item" key={entry.id}>{mocksEnabled() && locale === "en" ? ({ created: "Request created", approved: "Request approved", rejected: "Request rejected", active: "Workspace opened", revoked: "Access revoked", expired: "Access expired", ended: "Access ended" } as const)[entry.event] : entry.summary} — <span className="ltr">{entry.actor}</span></li>)}</ol>
        </section>
        {request.requestedBy === actor && request.status === "pending" && <p className="access-detail-note" role="note">{text.separation}</p>}
        <div className="dialog-actions access-detail-actions">
          {canDecide && <><button className="button primary" disabled={!canApprove} onClick={() => openAction("approve")}>{text.approve}</button><button className="button" onClick={() => openAction("reject")}>{text.reject}</button></>}
          {["approved", "active"].includes(request.status) && can("support.access.revoke") && <button className="button" onClick={() => openAction("revoke")}>{text.revoke}</button>}
          {request.status === "active" && request.assignee === actor && <Link className="button primary" href={`/admin/access-requests/${request.id}/workspace`}>{text.workspace}</Link>}
        </div>
        {action && (
          <form className="access-decision-form" onSubmit={(event) => { event.preventDefault(); validateAction(); }} aria-label={text.decision}>
            <label>{text.reason}<textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            {action === "approve" && (
              <>
                <fieldset className="access-scope-fieldset access-decision-scope">
                  <legend>{text.approvedScope}</legend>
                  {request.requestedScope.map((scope) => (
                    <label key={scope}>
                      <input
                        type="checkbox"
                        checked={approvedScope.includes(scope)}
                        onChange={(event) => setApprovedScope((current) =>
                          event.target.checked ? [...current, scope] : current.filter((entry) => entry !== scope))}
                      />
                      {describeScopes(request, [scope])}
                    </label>
                  ))}
                </fieldset>
                <label>{text.duration}
                <input className="input" type="number" min={5} max={Math.min(request.requestedDurationMinutes ?? 60, 60)} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} />
                </label>
                <label>{text.starts}
                  <input className="input" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                </label>
              </>
            )}
            {validationError && <p role="alert">{validationError}</p>}
            <div className="dialog-actions access-decision-actions">
              <button className="button" type="button" onClick={() => setAction(null)}>{text.cancel}</button>
              <button className="button primary" type="submit">{text.review}</button>
            </div>
          </form>
        )}
      </section>
      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction?.kind === "revoke") {
            revoke.mutate(pendingAction.payload, { onSuccess: () => {
              setAction(null);
              setPendingAction(null);
            } });
          } else if (pendingAction?.kind === "decision") {
            decision.mutate(pendingAction.payload, { onSuccess: () => {
              setAction(null);
              setPendingAction(null);
            } });
          }
        }}
        title={pendingAction?.kind === "decision" && pendingAction.payload.decision === "approve" ? text.approveTitle : pendingAction?.kind === "decision" ? text.rejectTitle : text.revoke}
        scope={pendingAction?.kind === "decision" && pendingAction.payload.approvedScope
          ? describeScopes(request, pendingAction.payload.approvedScope)
          : describeScopes(request, request.approvedScope ?? request.requestedScope, request.approvedScope !== null)}
        consequence={mocksEnabled() ? "سيتم تحديث الحالة وتسجيل حدث تدقيق تجريبي." : (locale === "ar" ? "سيتم تحديث الحالة وتسجيل حدث تدقيق على الخادم." : "The server will update the state and record an audit event.")}
        permission={pendingAction?.kind === "revoke" ? "support.access.revoke" : "support.access.approve"}
        auditEvent={mocksEnabled() ? `admin.access.${pendingAction?.kind ?? "decision"}` : pendingAction?.kind === "revoke" ? "security.revoke-support-access" : "security.decide-support-access-request"}
        pending={decision.isPending || revoke.isPending}
        outcomes={{ success: text.success, failure: text.failure, conflict: text.conflict }}
      />
      {actionError && (
        actionError instanceof ApiError && actionError.code === "forbidden"
          ? <AccessDeniedState permission={revoke.error ? "support.access.revoke" : "support.access.approve"} />
          : actionError instanceof ApiError && actionError.code === "conflict"
            ? <ConflictState />
            : <ErrorState error={actionError} />
      )}
    </div>
  );
}

export function AccessRequestView({ requestId }: { requestId?: string }) {
  return requestId ? <AccessDetail requestId={requestId} /> : <AccessList />;
}
