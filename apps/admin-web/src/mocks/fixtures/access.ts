import type { AccessRequestDetail, AccessScope } from "@/features/access/contracts";
import { users } from "./users";

export interface SupportTicketFixture {
  id: string;
  userId: string;
  summary: string;
}

export const supportTickets: SupportTicketFixture[] = [
  { id: "TKT-12001", userId: "USR-10482", summary: "تعذر مزامنة حالة التطبيق بعد تحديث موثق." },
  { id: "TKT-12002", userId: "USR-10461", summary: "مراجعة إعدادات جهاز ضمن طلب دعم تجريبي." },
  { id: "TKT-12003", userId: "USR-10479", summary: "التحقق من حالة جلسة دون كشف عنوان الشبكة." },
];

const MASKING_RULES = [
  "البريد الإلكتروني مخفي جزئياً",
  "القيم المالية والتفاصيل الخام غير متاحة",
  "المعرّفات التقنية الحساسة غير متاحة",
];

function customerSummary(userId: string) {
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error(`Missing access fixture user: ${userId}`);
  return {
    userId: user.id,
    displayName: user.displayName,
    maskedEmail: user.maskedEmail,
    status: user.status,
    primaryPlatform: user.primaryPlatform,
    registeredPlatforms: user.registeredPlatforms,
    risk: user.risk,
  };
}

function seededRequest(
  id: string,
  status: AccessRequestDetail["status"],
  options: {
    userId?: string;
    ticketId?: string;
    requestedBy?: string;
    assignee?: string;
    approvedBy?: string | null;
    requestedScope?: AccessScope[];
    approvedScope?: AccessScope[] | null;
    startsAt?: string | null;
    expiresAt?: string | null;
  } = {},
): AccessRequestDetail {
  const now = Date.now();
  const userId = options.userId ?? "USR-10482";
  const ticketId = options.ticketId ?? "TKT-12001";
  const requestedBy = options.requestedBy ?? "ADM-DEMO-SUPPORT";
  const requestedScope = options.requestedScope ?? ["profile-contact", "account-status", "device-diagnostics"];
  const approvedScope = options.approvedScope === undefined
    ? (["approved", "active", "expired", "revoked"].includes(status) ? requestedScope.slice(0, 2) : null)
    : options.approvedScope;
  const createdAt = new Date(now - 60 * 60_000).toISOString();
  const hasAccessWindow = ["approved", "active", "expired", "revoked"].includes(status);
  const startsAt = options.startsAt === undefined
    ? (hasAccessWindow
      ? new Date(now - (status === "expired" ? 30 : 1) * 60_000).toISOString()
      : null)
    : options.startsAt;
  const expiresAt = options.expiresAt === undefined
    ? (startsAt ? new Date(new Date(startsAt).getTime() + 20 * 60_000).toISOString() : null)
    : options.expiresAt;
  const terminalEvent = status === "pending" ? null : status;
  return {
    id,
    userId,
    maskedCustomerLabel: customerSummary(userId).maskedEmail,
    supportTicketId: ticketId,
    requestedBy,
    assignee: options.assignee ?? "ADM-DEMO-SUPPORT",
    requestedScope,
    approvedScope,
    reasonSummary: "Scoped support request",
    status,
    createdAt,
    startsAt,
    expiresAt,
    approvedBy: options.approvedBy === undefined
      ? (["approved", "active", "expired", "revoked"].includes(status) ? "ADM-DEMO-SECURITY" : null)
      : options.approvedBy,
    ticketSummary: supportTickets.find((ticket) => ticket.id === ticketId)?.summary ?? "تذكرة دعم تجريبية",
    customerSummary: customerSummary(userId),
    reason: "Review specific case related to demo support ticket",
    requestedDurationMinutes: 30,
    approvedDurationMinutes: approvedScope ? 20 : null,
    maskingRules: MASKING_RULES,
    customerApprovalRequired: false,
    customerApprovalState: "not-required",
    timeline: [
      {
        id: `ATL-${id}-1`,
        event: "created",
        actor: requestedBy,
        occurredAt: createdAt,
        summary: "تم إنشاء طلب وصول محدود",
        auditReference: `AUD-${id}-1`,
      },
      ...(terminalEvent ? [{
        id: `ATL-${id}-2`,
        event: terminalEvent as "approved" | "active" | "expired" | "rejected" | "revoked",
        actor: options.approvedBy ?? "ADM-DEMO-SECURITY",
        occurredAt: status === "expired" && expiresAt ? expiresAt : new Date(now - 30_000).toISOString(),
        summary: "تم تحديث حالة الطلب",
        auditReference: `AUD-${id}-2`,
      }] : []),
    ],
    region: { availability: "available" },
  };
}

export function createAccessFixtures(): AccessRequestDetail[] {
  return [
    seededRequest("ACC-1001", "pending"),
    seededRequest("ACC-1002", "approved", { userId: "USR-10461", ticketId: "TKT-12002" }),
    seededRequest("ACC-1003", "active", { userId: "USR-10479", ticketId: "TKT-12003", requestedScope: ["session-diagnostics", "account-status"] }),
    seededRequest("ACC-1004", "expired"),
    seededRequest("ACC-1005", "rejected", { approvedScope: null, approvedBy: null }),
    seededRequest("ACC-1006", "revoked"),
  ];
}
