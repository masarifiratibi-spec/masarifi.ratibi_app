import type { CommunicationDetail, CommunicationOverview, CommunicationPage, CommunicationRecord } from "@/features/communications/contracts";

const now = "2026-07-29T12:00:00+03:00";

export const supportTickets: CommunicationDetail[] = [
  {
    id: "TKT-1001",
    title: "Urgent import question",
    subtitle: "SLA at risk · masked customer only",
    state: "open",
    priority: "urgent",
    platform: "ios",
    locale: "both",
    maskedReference: { id: "MASKED-1001", type: "user", safeContext: "Premium iOS customer" },
    updatedAt: now,
    revision: 2,
    tags: ["sla-risk", "import"],
    body: "Customer reports an import mismatch. Financial values and account data are intentionally omitted.",
    notes: ["Assigned to tier 2 support."],
    attachments: [{ id: "ATT-1001-META", filename: "screenshot.png", mediaType: "image/png", declaredSizeBytes: 143200 }],
    auditTrail: [{ reference: "AUDIT-1001-OPEN", action: "assigned", at: now }],
  },
  {
    id: "TKT-1002",
    title: "Android notification issue",
    state: "awaiting_customer",
    priority: "medium",
    platform: "android",
    locale: "ar",
    maskedReference: { id: "MASKED-1002", type: "device", safeContext: "Android 15" },
    updatedAt: now,
    revision: 1,
    tags: ["partial"],
    body: "Waiting for the customer to confirm app version.",
    notes: [],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1002-ASK", action: "reply", at: now }],
  },
];

export const supportCategories: CommunicationRecord[] = [
  { id: "CAT-1001", title: "Imports", subtitle: "Default support category", state: "active", platform: "all", locale: "both", updatedAt: now, revision: 1, tags: ["default"] },
  { id: "CAT-1002", title: "Notifications", subtitle: "Routing category", state: "active", platform: "all", locale: "both", updatedAt: now, revision: 1, tags: ["routing"] },
];

export const feedbackItems: CommunicationDetail[] = [
  {
    id: "FDB-1001",
    title: "Receipt AI feedback",
    subtitle: "Linked once to TKT-1001",
    state: "linked",
    priority: "high",
    platform: "ios",
    locale: "en",
    maskedReference: { id: "MASKED-1201", type: "ai", safeContext: "receipt_analysis" },
    updatedAt: now,
    revision: 3,
    tags: ["ai", "linked"],
    body: "User feedback is shown as plain text with unsafe markup ignored.",
    notes: ["Linked to TKT-1001."],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1201-LNK", action: "linked", at: now }],
  },
];

export const abuseReports: CommunicationDetail[] = [
  {
    id: "ABU-1001",
    title: "Restricted abuse report",
    subtitle: "Evidence hidden outside security roles",
    state: "investigating",
    priority: "critical",
    platform: "all",
    locale: "both",
    maskedReference: { id: "MASKED-1401", type: "user", safeContext: "Reporter and target masked" },
    updatedAt: now,
    revision: 2,
    tags: ["restricted"],
    body: "Safe summary only. Reporter, target, and evidence payload are not projected here.",
    notes: ["Security review in progress."],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1401-INV", action: "investigate", at: now }],
  },
];

export const contentItems: CommunicationDetail[] = [
  {
    id: "CNT-1001",
    title: "Bilingual savings tip",
    subtitle: "Arabic and English variants ready",
    state: "published",
    priority: "normal",
    platform: "all",
    locale: "both",
    updatedAt: now,
    revision: 4,
    tags: ["tips", "bilingual"],
    body: "Preview: ادخر جزءاً من دخلك · Save a portion of your income.",
    notes: ["No unsupported placeholders."],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1601-PUB", action: "publish", at: now }],
  },
  {
    id: "CAT-1001",
    title: "Default category",
    subtitle: "Acyclic parent hierarchy",
    state: "published",
    priority: "normal",
    platform: "all",
    locale: "both",
    updatedAt: now,
    revision: 1,
    tags: ["categories"],
    body: "Category has no cyclic parent and can only retire with replacement when in use.",
    notes: [],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1602-PUB", action: "publish", at: now }],
  },
];

export const templates: CommunicationDetail[] = [
  {
    id: "TPL-1001",
    title: "Payment reminder email",
    subtitle: "Allowed placeholders: {{displayName}}, {{dueDate}}",
    state: "active",
    priority: "normal",
    platform: "all",
    locale: "both",
    updatedAt: now,
    revision: 5,
    tags: ["email", "trigger:payment_due"],
    body: "Plain-text preview with approved placeholders only.",
    notes: ["Compatible with email channel."],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1801-ACT", action: "activate", at: now }],
  },
  {
    id: "TPL-1002",
    title: "Push onboarding nudge",
    subtitle: "Push-safe short copy",
    state: "draft",
    priority: "normal",
    platform: "ios",
    locale: "both",
    updatedAt: now,
    revision: 1,
    tags: ["push", "onboarding"],
    body: "Short push copy without URLs.",
    notes: [],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-1802-NEW", action: "draft", at: now }],
  },
];

export const campaigns: CommunicationDetail[] = [
  {
    id: "CMP-1001",
    title: "July onboarding campaign",
    subtitle: "Aggregate audience only",
    state: "scheduled",
    priority: "normal",
    platform: "all",
    locale: "both",
    updatedAt: now,
    revision: 2,
    tags: ["push", "scheduled"],
    body: "Audience: 1280 eligible, 84 opted out. No recipient rows or tokens are stored.",
    notes: ["Template revision 5."],
    attachments: [],
    auditTrail: [{ reference: "AUDIT-2001-SCH", action: "schedule", at: now }],
  },
];

export const deliveryLogs: CommunicationRecord[] = [
  { id: "DLV-1001", title: "Masked delivery failure", subtitle: "safe failure class: token_failed", state: "failed", priority: "medium", platform: "android", locale: "both", updatedAt: now, revision: 1, tags: ["masked", "no-token"] },
  { id: "DLV-1002", title: "Aggregate delivered batch", subtitle: "delivery body omitted", state: "delivered", priority: "low", platform: "ios", locale: "both", updatedAt: now, revision: 1, tags: ["aggregate"] },
];

function page(items: CommunicationPage["items"]): CommunicationPage {
  return {
    items,
    pagination: { page: 1, pageSize: 25, totalItems: items.length, totalPages: items.length ? 1 : 0 },
    region: { availability: items.length ? "available" : "empty" },
  };
}

export function communicationsPage(kind: string): CommunicationPage {
  if (kind === "support-categories") return page(supportCategories);
  if (kind === "feedback") return page(feedbackItems);
  if (kind === "abuse") return page(abuseReports);
  if (kind === "templates" || kind === "transactional") return page(templates);
  if (kind === "campaigns") return page(campaigns);
  if (kind === "delivery") return page(deliveryLogs);
  if (kind === "content") return page(contentItems);
  return page(supportTickets);
}

export function communicationsOverview(kind: "support" | "notifications"): CommunicationOverview {
  if (kind === "notifications") {
    return {
      title: "Notifications",
      description: "Mock-only campaign health with aggregate denominators.",
      metrics: [
        { key: "eligible", label: "Eligible audience", value: 1280, unit: "messages", denominator: "eligible-audience", platform: "all" },
        { key: "delivery", label: "Delivery rate", value: 94, unit: "percent", denominator: "deliveries", platform: "all" },
      ],
      items: campaigns,
      region: { availability: "available" },
    };
  }
  return {
    title: "Support",
    description: "Ticket SLA and category health with privacy-safe projections.",
    metrics: [
      { key: "open", label: "Open tickets", value: 2, unit: "tickets", denominator: "tickets", platform: "all" },
      { key: "sla", label: "SLA at risk", value: 1, unit: "tickets", denominator: "tickets", platform: "ios" },
    ],
    items: supportTickets,
    region: { availability: "available" },
  };
}

export function findCommunicationDetail(id: string): CommunicationDetail | undefined {
  return [...supportTickets, ...feedbackItems, ...abuseReports, ...contentItems, ...templates, ...campaigns]
    .find((item) => item.id === id);
}
