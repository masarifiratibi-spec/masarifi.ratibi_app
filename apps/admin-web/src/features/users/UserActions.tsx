"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/admin/ui";
import { ApiError } from "@/core/api/errors";
import type { AdminRole } from "@/core/permissions/permissions";
import { hasPermission } from "@/core/permissions/role-map";
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
  suspend: ["تعليق الحساب", "الحساب المحدد", "سيُمنع المستخدم من الوصول حتى إعادة التفعيل.", "users.status.manage", "user.suspended"],
  reactivate: ["إعادة تفعيل الحساب", "الحساب المحدد", "سيستعيد المستخدم إمكانية الوصول.", "users.status.manage", "user.reactivated"],
  verification: ["تحديث التحقق", "حالة التحقق", "ستتغير حالة التحقق المعروضة للمشغلين.", "users.verification.manage", "user.verification.updated"],
  sessions: ["إنهاء كل الجلسات", "كل الجلسات النشطة", "سيُطلب من المستخدم تسجيل الدخول مجدداً.", "sessions.revoke", "user.sessions.revoked"],
} satisfies Record<UserAction, readonly [string, string, string, string, string]>;

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
  return (
    <span className="form-grid">
      <label>سبب الإجراء<input className="input" {...register("reason")} /></label>
      {error && <span className="field-error" role="alert">{error}</span>}
      {(action === "suspend" || action === "reactivate") && (
        <label>ملاحظة داخلية<textarea className="input" {...register("internalNote")} /></label>
      )}
      {action === "suspend" && (
        <>
          <label>المدة بالأيام<input className="input" type="number" {...register("durationDays", { valueAsNumber: true })} /></label>
          <label><input type="checkbox" {...register("notifyUser")} /> تسليم تفضيل إشعار للمزود المستقبلي</label>
        </>
      )}
      {action === "verification" && (
        <label>الحالة المقترحة<select className="select" {...register("nextState")}>
          <option value="verified">موثّق</option><option value="pending">معلّق</option>
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
      if (action === "suspend") {
        await suspend.mutateAsync(suspendUserRequestSchema.parse({
          reason: fields.reason,
          durationDays: fields.durationDays,
          internalNote: fields.internalNote,
          notifyUser: fields.notifyUser,
        }));
      } else if (action === "reactivate") {
        await reactivate.mutateAsync(reactivateUserRequestSchema.parse({
          reason: fields.reason,
          internalNote: fields.internalNote,
        }));
      } else if (action === "verification") {
        await verification.mutateAsync(updateVerificationRequestSchema.parse({
          reason: fields.reason,
          nextState: fields.nextState,
        }));
      } else {
        await revokeSessions.mutateAsync(revokeSessionsRequestSchema.parse(selectedSessionId
          ? { reason: fields.reason, scope: "selected", sessionIds: [selectedSessionId] }
          : { reason: fields.reason, scope: "all", sessionIds: [] }));
      }
      setAnnouncement("تم تنفيذ الإجراء. يتوفر مرجع تدقيق آمن في النتيجة.");
      setAction(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setAnnouncement(error.message);
      } else {
        form.setError("reason", { message: "تحقق من البيانات المدخلة." });
      }
    }
  }

  const copy = action ? actionCopy[action] : null;
  return (
    <section aria-label="إجراءات المستخدم">
      <div className="page-actions user-page-actions">
        {hasPermission(role, "users.status.manage") && user.status !== "suspended" && <button className="button warning" onClick={() => open("suspend")}>تعليق الحساب</button>}
        {hasPermission(role, "users.status.manage") && user.status === "suspended" && <button className="button" onClick={() => open("reactivate")}>إعادة التفعيل</button>}
        {hasPermission(role, "users.verification.manage") && <button className="button secondary" onClick={() => open("verification")}>تحديث التحقق</button>}
        {hasPermission(role, "sessions.revoke") && sessions.some(({ state }) => state === "active") && <button className="button danger" onClick={() => openSessions(null)}>إنهاء كل الجلسات</button>}
        {hasPermission(role, "sessions.revoke") && sessions.filter(({ state }) => state === "active").map((session) => (
          <button className="button danger" onClick={() => openSessions(session.id)} key={session.id}>
            إنهاء جلسة {session.safeDeviceLabel}
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
        scope={action === "sessions" && selectedSessionId ? `الجلسة ${selectedSessionId}` : copy[1]}
        consequence={copy[2]}
        permission={copy[3]}
        auditEvent={copy[4]}
        pending={pending}
        outcomes={{ success: "نجاح", failure: "فشل آمن", conflict: "تعارض الحالة" }}
      >
        <FormFields action={action as UserAction} register={form.register} error={form.formState.errors.reason?.message} />
        {action === "sessions" && sessions.some((session) =>
          session.isCurrentAdminVisibleSession
          && session.state === "active"
          && (!selectedSessionId || session.id === selectedSessionId)) && (
          <span className="state-warning">تحذير: يشمل النطاق الجلسة الحالية المرئية للمسؤول.</span>
        )}
      </ConfirmDialog>}
    </section>
  );
}

function DeviceRevokeAction({ userId, device, role }: { userId: string; device: UserDevice; role: AdminRole }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const form = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const mutation = useRevokeDevice(userId, device.id, role);
  if (!hasPermission(role, "devices.revoke")) return null;
  if (device.state !== "active") return outcome ? <p role="status">{outcome}</p> : null;
  const submit = form.handleSubmit(async (fields) => {
    const parsed = revokeDeviceRequestSchema.safeParse(fields);
    if (!parsed.success) return form.setError("reason", { message: parsed.error.issues[0]?.message });
    try {
      await mutation.mutateAsync(parsed.data);
      setOutcome("تم إلغاء الجهاز.");
      setOpen(false);
    } catch (error) {
      setOutcome(safeActionError(error));
    }
  });
  return (
    <>
      <button className="button" onClick={() => setOpen(true)}>إلغاء جهاز {device.safeLabel}</button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={submit}
        title="إلغاء الجهاز" scope={device.safeLabel} consequence="ستُلغى جلسات الجهاز وقد يلزم تسجيل الدخول مجدداً."
        permission="devices.revoke" auditEvent="device.revoked" pending={mutation.isPending}
        outcomes={{ success: "نجاح", failure: "فشل آمن", conflict: "الجهاز ملغى مسبقاً" }}>
        <label>سبب الإجراء<input className="input" {...form.register("reason")} /></label>
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
