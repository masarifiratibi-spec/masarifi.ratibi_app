"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/admin/ui";
import { ApiError } from "@/core/api/errors";
import { mocksEnabled } from "@/core/api/client";
import type { AdminRole } from "@/core/permissions/permissions";
import { useCurrentPermission } from "@/core/permissions/current-permissions";
import { useLocale } from "@/core/localization/provider";
import {
  reactivateUserRequestSchema,
  revokeDeviceRequestSchema,
  revokeSessionsRequestSchema,
  suspendUserRequestSchema,
  updateVerificationRequestSchema,
  userBulkActionRequestSchema,
  type AccountStatus,
  type UserBulkActionRequest,
  type UserDevice,
  type UserSession,
  type VerificationState,
  type UserActionResult,
} from "./contracts";
import {
  useReactivateUser,
  useRevokeDevice,
  useRevokeSessions,
  useSuspendUser,
  useUpdateVerification,
  useUserBulkAction,
} from "./hooks";

type UserAction = "suspend" | "reactivate" | "verification" | "sessions";
interface ActionFields {
  reason: string;
  internalNote: string;
  durationDays: number;
  notifyUser: boolean;
  nextState: VerificationState;
}

const actionCopy = {
  suspend: ["تعليق الحساب", "الحساب المحدد", "سيُمنع المستخدم من الوصول حتى إعادة التفعيل.", "users.status.manage", "customer.suspend"],
  reactivate: ["إعادة تفعيل الحساب", "الحساب المحدد", "سيستعيد المستخدم إمكانية الوصول.", "users.status.manage", "customer.reactivate"],
  verification: ["تحديث التحقق", "حالة التحقق", "ستتغير حالة التحقق المعروضة للمشغلين.", "users.verification.manage", "user.verification.updated"],
  sessions: ["إنهاء كل الجلسات", "كل الجلسات النشطة", "سيُطلب من المستخدم تسجيل الدخول مجدداً.", "sessions.revoke", "customer.revoke_sessions"],
} satisfies Record<UserAction, readonly [string, string, string, string, string]>;

const englishActionCopy = {
  suspend: ["Suspend account", "Selected account", "The customer cannot access the account until reactivation.", "users.status.manage", "customer.suspend"],
  reactivate: ["Reactivate account", "Selected account", "The customer can access the account again.", "users.status.manage", "customer.reactivate"],
  verification: ["Update verification", "Selected account", "Change the verification state in the development fixture.", "users.verification.manage", "user.verification.updated"],
  sessions: ["End all sessions", "All active sessions", "The customer must sign in again.", "sessions.revoke", "customer.revoke_sessions"],
} satisfies Record<UserAction, readonly [string, string, string, string, string]>;
const actionLabels = {
  ar: { reason: "سبب الإجراء", note: "ملاحظة داخلية", days: "المدة بالأيام", notify: "تسليم تفضيل إشعار للمزود المستقبلي", proposed: "الحالة المقترحة", verified: "موثّق", pending: "معلّق", section: "إجراءات المستخدم", suspend: "تعليق الحساب", reactivate: "إعادة التفعيل", verification: "تحديث التحقق", providerVerification: "التحقق مصدره Clerk ولا يمكن تعديله يدويًا", sessions: "إنهاء كل الجلسات", session: "إنهاء جلسة", sessionScope: "الجلسة", success: "نجاح", failure: "فشل آمن", conflict: "تعارض الحالة", current: "تحذير: يشمل النطاق الجلسة الحالية المرئية للمسؤول.", revokeDevice: "إلغاء الجهاز", revokeDeviceAction: "إلغاء جهاز", deviceEffect: "ستُلغى جلسات الجهاز وقد يلزم تسجيل الدخول مجدداً.", revoked: "الجهاز ملغى مسبقاً" },
  en: { reason: "Reason for action", note: "Internal note", days: "Duration in days", notify: "Store notification preference for a future provider", proposed: "Proposed state", verified: "Verified", pending: "Pending", section: "Customer actions", suspend: "Suspend account", reactivate: "Reactivate account", verification: "Update verification", providerVerification: "Verification comes from Clerk and cannot be edited manually", sessions: "End all sessions", session: "End session", sessionScope: "Session", success: "Success", failure: "Safe failure", conflict: "State conflict", current: "Warning: the scope includes the current session visible to the administrator.", revokeDevice: "Revoke device", revokeDeviceAction: "Revoke device", deviceEffect: "Device sessions will be revoked; signing in again may be required.", revoked: "Device already revoked" },
};

function safeActionError(error: unknown): string {
  return error instanceof ApiError ? error.message : "تعذر تنفيذ الإجراء بأمان.";
}

function FormFields({
  action,
  register,
  error,
}: {
  action: UserAction;
  register: ReturnType<typeof useForm<ActionFields>>["register"];
  error?: string;
}) {
  const { locale } = useLocale(); const c = actionLabels[locale];
  return (
    <span className="form-grid">
      <label>{c.reason}<input className="input" {...register("reason")} /></label>
      {error && <span className="field-error" role="alert">{error}</span>}
      {(action === "suspend" || action === "reactivate") && (
        <label>{c.note}<textarea className="input" {...register("internalNote")} /></label>
      )}
      {action === "suspend" && mocksEnabled() && (
        <>
          <label>{c.days}<input className="input" type="number" {...register("durationDays", { valueAsNumber: true })} /></label>
          <label><input type="checkbox" {...register("notifyUser")} /> {c.notify}</label>
        </>
      )}
      {action === "verification" && (
        <label>{c.proposed}<select className="select" {...register("nextState")}>
          <option value="verified">{c.verified}</option><option value="pending">{c.pending}</option>
        </select></label>
      )}
    </span>
  );
}

export function UserActions({
  user,
  devices,
  sessions,
  role,
}: {
  user: { id: string; status: AccountStatus; verification: VerificationState };
  devices: UserDevice[];
  sessions: UserSession[];
  role: AdminRole;
}) {
  const can = useCurrentPermission(role);
  const { locale } = useLocale(); const c = actionLabels[locale];
  const [action, setAction] = useState<UserAction | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const suspend = useSuspendUser(user.id, role);
  const reactivate = useReactivateUser(user.id, role);
  const verification = useUpdateVerification(user.id, role);
  const revokeSessions = useRevokeSessions(user.id, role);
  const form = useForm<ActionFields>({
    defaultValues: { reason: "", internalNote: "", durationDays: 30, notifyUser: false, nextState: user.verification === "verified" ? "pending" : "verified" },
  });
  const pending = suspend.isPending || reactivate.isPending || verification.isPending || revokeSessions.isPending;

  function open(nextAction: UserAction) {
    form.reset({ reason: "", internalNote: "", durationDays: 30, notifyUser: false, nextState: user.verification === "verified" ? "pending" : "verified" });
    setAnnouncement("");
    setAction(nextAction);
  }

  function openSessions(sessionId: string | null) {
    setSelectedSessionId(sessionId);
    open("sessions");
  }

  async function submit(fields: ActionFields) {
    if (!action) return;
    try {
      let result: UserActionResult;
      if (action === "suspend") {
        result = await suspend.mutateAsync(suspendUserRequestSchema.parse({
          reason: fields.reason,
          durationDays: fields.durationDays,
          internalNote: fields.internalNote,
          notifyUser: fields.notifyUser,
        }));
      } else if (action === "reactivate") {
        result = await reactivate.mutateAsync(reactivateUserRequestSchema.parse({
          reason: fields.reason,
          internalNote: fields.internalNote,
        }));
      } else if (action === "verification") {
        result = await verification.mutateAsync(updateVerificationRequestSchema.parse({
          reason: fields.reason,
          nextState: fields.nextState,
        }));
      } else {
        result = await revokeSessions.mutateAsync(revokeSessionsRequestSchema.parse(selectedSessionId
          ? { reason: fields.reason, scope: "selected", sessionIds: [selectedSessionId] }
          : { reason: fields.reason, scope: "all", sessionIds: [] }));
      }
      setAnnouncement(result.message);
      setAction(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setAnnouncement(error.message);
      } else {
        form.setError("reason", { message: "تحقق من البيانات المدخلة." });
      }
    }
  }

  const copy = action ? (locale === "ar" ? actionCopy : englishActionCopy)[action] : null;
  return (
    <section aria-label={c.section}>
      <div className="page-actions user-page-actions">
        {can("users.status.manage") && user.status === "active" && <button className="button warning" onClick={() => open("suspend")}>{c.suspend}</button>}
        {can("users.status.manage") && user.status === "suspended" && <button className="button" onClick={() => open("reactivate")}>{c.reactivate}</button>}
        {can("users.verification.manage") && <button disabled={!mocksEnabled()} title={!mocksEnabled() ? c.providerVerification : undefined} className="button secondary" onClick={() => open("verification")}>{c.verification}</button>}
        {can("sessions.revoke") && sessions.some(({ state }) => state === "active") && <button className="button danger" onClick={() => openSessions(null)}>{c.sessions}</button>}
        {can("sessions.revoke") && sessions.filter(({ state }) => state === "active").map((session) => (
          <button className="button danger" onClick={() => openSessions(session.id)} key={session.id}>
            {c.session} {session.safeDeviceLabel}
          </button>
        ))}
      </div>
      <div className="device-grid">
        {devices.map((device) => <DeviceRevokeAction userId={user.id} device={device} role={role} key={device.id} />)}
      </div>
      {announcement && <p role="status">{announcement}</p>}
      {copy && <ConfirmDialog
        open
        onClose={() => setAction(null)}
        onConfirm={form.handleSubmit(submit)}
        title={copy[0]}
        scope={action === "sessions" && selectedSessionId ? `${c.sessionScope} ${selectedSessionId}` : copy[1]}
        consequence={copy[2]}
        permission={copy[3]}
        auditEvent={copy[4]}
        pending={pending}
        outcomes={{ success: c.success, failure: c.failure, conflict: c.conflict }}
      >
        <FormFields action={action as UserAction} register={form.register} error={form.formState.errors.reason?.message} />
        {action === "sessions" && sessions.some((session) =>
          session.isCurrentAdminVisibleSession
          && session.state === "active"
          && (!selectedSessionId || session.id === selectedSessionId)) && (
          <span className="state-warning">{c.current}</span>
        )}
      </ConfirmDialog>}
    </section>
  );
}

function DeviceRevokeAction({ userId, device, role }: { userId: string; device: UserDevice; role: AdminRole }) {
  const { locale } = useLocale(); const c = actionLabels[locale];
  const can = useCurrentPermission(role);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const form = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const mutation = useRevokeDevice(userId, device.id, role);
  if (!can("devices.revoke")) return null;
  if (device.state !== "active") return outcome ? <p role="status">{outcome}</p> : null;
  const submit = form.handleSubmit(async (fields) => {
    const parsed = revokeDeviceRequestSchema.safeParse(fields);
    if (!parsed.success) return form.setError("reason", { message: parsed.error.issues[0]?.message });
    try {
      const result = await mutation.mutateAsync(parsed.data);
      setOutcome(result.message);
      setOpen(false);
    } catch (error) {
      setOutcome(safeActionError(error));
    }
  });
  return (
    <>
      <button className="button" onClick={() => setOpen(true)}>{c.revokeDeviceAction} {device.safeLabel}</button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={submit}
        title={c.revokeDevice} scope={device.safeLabel} consequence={c.deviceEffect}
        permission="devices.revoke" auditEvent="customer.revoke_device" pending={mutation.isPending}
        outcomes={{ success: c.success, failure: c.failure, conflict: c.revoked }}>
        <label>{c.reason}<input className="input" {...form.register("reason")} /></label>
      </ConfirmDialog>
      {outcome && <p role="status">{outcome}</p>}
    </>
  );
}

export function UserBulkActions({
  selectedUsers,
  role,
  onClear,
  onComplete,
}: {
  selectedUsers: { id: string; status: AccountStatus }[];
  role: AdminRole;
  onClear: () => void;
  onComplete: (message: string) => void;
}) {
  const { locale } = useLocale();
  const [action, setAction] = useState<UserBulkActionRequest["action"]>("suspend");
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const form = useForm<{ reason: string; durationDays: number; notifyUser: boolean }>({
    defaultValues: { reason: "", durationDays: 30, notifyUser: false },
  });
  const mutation = useUserBulkAction(role);
  const eligible = selectedUsers.filter(({ status }) =>
    action === "suspend" ? status !== "suspended" : action === "reactivate" ? status === "suspended" : true).length;

  const submit = form.handleSubmit(async (fields) => {
    const parsed = userBulkActionRequestSchema.safeParse({
      action, userIds: selectedUsers.map(({ id }) => id),
      ...(["suspend", "reactivate", "force-logout"].includes(action) ? { reason: fields.reason } : {}),
      ...(action === "suspend" ? { durationDays: fields.durationDays, notifyUser: fields.notifyUser } : {}),
      ...(action === "notification-handoff" ? { notifyUser: true } : {}),
    });
    if (!parsed.success) return form.setError("reason", { message: parsed.error.issues[0]?.message });
    try {
      const result = await mutation.mutateAsync(parsed.data);
      onComplete(`${result.succeededCount} نجح، ${result.failedCount} تعذر. ${result.failures.map(({ userId, code, message }) => `${userId}: ${code} — ${message}`).join(" ")}`);
      setOpen(false);
      onClear();
    } catch (error) {
      setOutcome(safeActionError(error));
    }
  });

  if (!mocksEnabled()) return <p role="note">{locale === "ar" ? "الإجراءات الجماعية غير متاحة. استخدم صفحة العميل لتنفيذ إجراء مدقق." : "Bulk actions are unavailable. Use the customer page for an audited individual change."}</p>;
  return (
    <section className="bulk-bar" aria-label="إجراءات جماعية">
      <span>{selectedUsers.length} محدد · {eligible} مؤهل</span>
      <select className="select" aria-label="الإجراء الجماعي" value={action} onChange={(event) => setAction(event.target.value as UserBulkActionRequest["action"])}>
        <option value="export-summary">تصدير ملخص مخفي تجريبي</option>
        <option value="suspend">تعليق</option><option value="reactivate">إعادة تفعيل</option>
        <option value="force-logout">إنهاء الجلسات</option><option value="notification-handoff">تسليم إشعار تجريبي</option>
      </select>
      <button className="button primary" onClick={() => setOpen(true)}>مراجعة الإجراء</button>
      <button className="button" onClick={onClear}>مسح التحديد</button>
      {outcome && <p role="status">{outcome}</p>}
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={submit}
        title="تأكيد الإجراء الجماعي" scope={`${selectedUsers.length} معرفاً محدداً من الصفحة الحالية`}
        consequence="لن يتوسع النطاق إلى جميع نتائج التصفية. التصدير والإشعار نتيجتان تجريبيتان فقط."
        permission={action === "export-summary" ? "users.export_summary" : action === "force-logout" ? "sessions.revoke" : "users.status.manage"}
        auditEvent="users.bulk-action.requested" pending={mutation.isPending}
        outcomes={{ success: "نجاح", failure: "نتيجة جزئية آمنة", conflict: "تعارض الحالة" }}>
        {["suspend", "reactivate", "force-logout"].includes(action) && <label>سبب الإجراء<input className="input" {...form.register("reason")} /></label>}
        {action === "suspend" && <label>المدة بالأيام<input className="input" type="number" {...form.register("durationDays", { valueAsNumber: true })} /></label>}
      </ConfirmDialog>
    </section>
  );
}
