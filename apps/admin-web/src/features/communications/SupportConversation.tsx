"use client";

import { useState } from "react";
import { useLocale } from "@/core/localization/provider";
import { getStatusLabel } from "@/core/localization/display-labels";
import { ApiError } from "@/core/api/errors";
import type { PermissionKey } from "@/core/permissions/permissions";
import type { CommunicationDetail } from "./contracts";
import type { TicketActionRequest } from "./repository";
import { SafeText } from "./shared/SafeText";

const permissions = {
  reply: "support.tickets.reply",
  note: "support.tickets.notes",
  assign: "support.tickets.assign",
  priority: "support.tickets.priority",
  resolve: "support.tickets.resolve",
  close: "support.tickets.resolve",
  reopen: "support.tickets.resolve",
} satisfies Record<string, PermissionKey>;
type Action = keyof typeof permissions;
const labels = {
  en: {
    conversation: "Conversation",
    notes: "Internal notes",
    customer: "Customer",
    admin: "Support",
    system: "System",
    assigned: "Assigned Admin",
    unassigned: "Unassigned",
    reply: "Reply",
    note: "Internal note",
    assign: "Assign",
    priority: "Priority",
    resolve: "Resolve",
    close: "Close",
    reopen: "Reopen",
    action: "Action",
    message: "Message",
    reason: "Reason for the audit log",
    apply: "Apply action",
    assignee: "Admin ID (leave empty to unassign)",
    more: "Load more messages",
    download: "Download",
    error:
      "Action failed. Your draft is retained. Refresh the ticket before retrying a conflict.",
    recentAuth:
      "A recent login is required. Copy your draft, then sign in again with the same account.",
    refresh: "Refresh ticket",
    saved: "Action saved",
    empty: "No messages",
    private: "Visible to authorized staff only",
    scan: "Scan status",
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  },
  ar: {
    conversation: "المحادثة",
    notes: "ملاحظات داخلية",
    customer: "العميل",
    admin: "الدعم",
    system: "النظام",
    assigned: "المشرف المكلّف",
    unassigned: "غير مكلّف",
    reply: "رد",
    note: "ملاحظة داخلية",
    assign: "تكليف",
    priority: "الأولوية",
    resolve: "حل",
    close: "إغلاق",
    reopen: "إعادة فتح",
    action: "الإجراء",
    message: "الرسالة",
    reason: "سبب الإجراء لسجل التدقيق",
    apply: "تنفيذ الإجراء",
    assignee: "معرّف المشرف (اتركه فارغًا لإلغاء التكليف)",
    more: "تحميل المزيد من الرسائل",
    download: "تنزيل",
    error:
      "تعذر تنفيذ الإجراء. تم الاحتفاظ بالمسودة. حدّث التذكرة قبل إعادة المحاولة عند تعارض النسخة.",
    recentAuth:
      "يلزم تسجيل دخول حديث. انسخ المسودة ثم سجّل الدخول مجددًا بالحساب نفسه.",
    refresh: "تحديث التذكرة",
    saved: "تم حفظ الإجراء",
    empty: "لا توجد رسائل",
    private: "تظهر للموظفين المصرّح لهم فقط",
    scan: "حالة الفحص",
    low: "منخفضة",
    normal: "عادية",
    high: "عالية",
    urgent: "عاجلة",
  },
};

export function SupportConversation({
  item,
  onAction,
  pending,
  canAct,
  onLoadMore,
  onDownload,
  onRefresh,
}: {
  item: CommunicationDetail;
  onAction: (request: TicketActionRequest) => Promise<void>;
  pending: boolean;
  canAct: (permission: PermissionKey) => boolean;
  onLoadMore: () => void;
  onDownload: (id: string) => void;
  onRefresh?: () => void;
}) {
  const { locale } = useLocale();
  const c = labels[locale];
  const [action, setAction] = useState<Action>("reply");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [outcome, setOutcome] = useState<
    "saved" | "error" | "recentAuth" | null
  >(null);
  const allowed = (Object.keys(permissions) as Action[]).filter(
    (value) =>
      canAct(permissions[value]) &&
      (value === "reply"
        ? ["open", "waiting_customer", "waiting_support"].includes(item.state)
        : value === "reopen"
          ? ["resolved", "closed"].includes(item.state)
          : value === "resolve"
            ? ["open", "waiting_customer", "waiting_support"].includes(
                item.state,
              )
            : ["assign", "priority", "close"].includes(value)
              ? item.state !== "closed"
              : true),
  );
  const selected = allowed.includes(action) ? action : allowed[0];
  return (
    <>
      <section className="table-card">
        <dl className="detail-grid">
          <div>
            <dt>{c.customer}</dt>
            <dd>
              <bdi>{item.customerReference ?? "—"}</bdi>
            </dd>
          </div>
          <div>
            <dt>{c.assigned}</dt>
            <dd>
              <bdi>{item.assignedAdminId ?? c.unassigned}</bdi>
            </dd>
          </div>
        </dl>
        <h2>{c.conversation}</h2>
        <div className="support-messages">
          {!item.messages?.length && <p>{c.empty}</p>}
          {item.messages?.map((message) => (
            <article className="support-message" key={message.id}>
              <header>
                <strong>{c[message.senderType]}</strong>{" "}
                <time dateTime={message.createdAt}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(message.createdAt))}
                </time>
              </header>
              <SafeText text={message.body} />
              {message.attachments.map((attachment) => (
                <p key={attachment.id}>
                  <bdi>{attachment.filename}</bdi> · {c.scan}:{" "}
                  {getStatusLabel(locale, attachment.status ?? "pending")}{" "}
                  {attachment.status === "clean" && (
                    <button
                      className="button secondary"
                      onClick={() => onDownload(attachment.id)}
                    >
                      {c.download}
                    </button>
                  )}
                </p>
              ))}
            </article>
          ))}
        </div>
        {item.hasMoreMessages && (
          <button className="button" disabled={pending} onClick={onLoadMore}>
            {c.more}
          </button>
        )}
      </section>
      {canAct("support.tickets.notes") && (
        <section className="table-card">
          <h2>{c.notes}</h2>
          <p>{c.private}</p>
          {item.internalNotes?.map((note) => (
            <article className="support-message" key={note.id}>
              <SafeText text={note.body} />
            </article>
          ))}
        </section>
      )}
      {selected && (
        <form
          className="table-card support-action"
          onSubmit={async (event) => {
            event.preventDefault();
            setOutcome(null);
            try {
              await onAction({
                action: selected,
                expectedVersion: item.revision,
                reason: reason.trim(),
                ...(["reply", "note"].includes(selected)
                  ? { message: message.trim() }
                  : {}),
                ...(selected === "assign"
                  ? { assigneeId: assignee.trim() || null }
                  : {}),
                ...(selected === "priority" ? { priority } : {}),
              });
              setMessage("");
              setReason("");
              setOutcome("saved");
            } catch (error) {
              setOutcome(
                error instanceof ApiError &&
                  error.code === "recent_auth_required"
                  ? "recentAuth"
                  : "error",
              );
            }
          }}
        >
          <label>
            {c.action}
            <select
              value={selected}
              onChange={(event) => setAction(event.target.value as Action)}
              disabled={pending}
            >
              {allowed.map((value) => (
                <option value={value} key={value}>
                  {c[value]}
                </option>
              ))}
            </select>
          </label>
          {["reply", "note"].includes(selected) && (
            <label>
              {c.message}
              <textarea
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                maxLength={8192}
                disabled={pending}
              />
            </label>
          )}
          {selected === "assign" && (
            <label>
              {c.assignee}
              <input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                maxLength={128}
                disabled={pending}
              />
            </label>
          )}
          {selected === "priority" && (
            <label>
              {c.priority}
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as typeof priority)
                }
              >
                {(["low", "normal", "high", "urgent"] as const).map((value) => (
                  <option key={value} value={value}>
                    {c[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {c.reason}
            <textarea
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={500}
              required
              disabled={pending}
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={
              pending ||
              reason.trim().length < 10 ||
              (["reply", "note"].includes(selected) && !message.trim())
            }
          >
            {c.apply}
          </button>
          {outcome === "saved" && <p role="status">{c.saved}</p>}
          {(outcome === "error" || outcome === "recentAuth") && (
            <div role="alert">
              <p>{outcome === "recentAuth" ? c.recentAuth : c.error}</p>
              <button className="button" type="button" onClick={onRefresh}>
                {c.refresh}
              </button>
            </div>
          )}
        </form>
      )}
    </>
  );
}
