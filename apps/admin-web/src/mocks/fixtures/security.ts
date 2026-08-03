import type {
  AdminSecurity,
  AuditEventDetail,
  AuthenticationEvent,
  DeletionRequestDetail,
  ExportRequestDetail,
  IncidentDetail,
  PermissionChange,
  RetentionPolicyDetail,
  SecurityOverview,
  SupportAccessGrant,
  SuspiciousActivity,
} from "@/features/security/contracts";

export const PHASE7_NOW = "2026-07-30T12:00:00+03:00";

const securityAdmin = { id: "ADM-1001", kind: "admin" as const, label: "Security Administrator" };
const superAdmin = { id: "ADM-1002", kind: "admin" as const, label: "Super Admin" };
const customer = { id: "CUS-1001", kind: "customer" as const, label: "n***@example.test" };
const secondCustomer = { id: "CUS-1002", kind: "customer" as const, label: "s***@example.test" };
const ticket = { id: "TKT-1001", kind: "ticket" as const, label: "Ticket TKT-1001" };
const incidentRef = { id: "INC-1001", kind: "incident" as const, label: "Incident INC-1001" };

export const securityOverviewFixture: SecurityOverview = {
  query: { platform: "all", period: "30d" },
  freshness: PHASE7_NOW,
  partial: false,
  metrics: [
    { key: "failed-logins", label: "Failed logins", value: 18, unit: "events", entitySemantic: "events", freshness: PHASE7_NOW, ios: 8, android: 7, unknown: 3 },
    { key: "suspicious-sessions", label: "Suspicious sessions", value: 5, unit: "sessions", entitySemantic: "sessions", freshness: PHASE7_NOW, ios: 2, android: 2, unknown: 1, uniqueCustomers: 4 },
    { key: "locked-accounts", label: "Locked accounts", value: 2, unit: "accounts", entitySemantic: "accounts", freshness: PHASE7_NOW },
    { key: "support-access", label: "Active support access", value: 1, unit: "grants", entitySemantic: "grants", freshness: PHASE7_NOW },
    { key: "critical-events", label: "Critical events", value: 1, unit: "events", entitySemantic: "events", freshness: PHASE7_NOW, uniqueCustomers: 1 },
  ],
};

export const authenticationEventsFixture: AuthenticationEvent[] = [
  {
    id: "AUTH-1001",
    actor: customer,
    actorType: "customer",
    eventType: "Failed password attempt",
    deviceLabel: "iPhone masked device",
    broadRegion: "GCC",
    platform: "ios",
    risk: "critical",
    result: "blocked",
    occurredAt: "2026-07-30T10:45:00+03:00",
    correlationId: "COR-1001",
  },
  {
    id: "AUTH-1002",
    actor: secondCustomer,
    actorType: "customer",
    eventType: "Trusted device login",
    deviceLabel: "Android masked device",
    broadRegion: "UAE",
    platform: "android",
    risk: "low",
    result: "success",
    occurredAt: "2026-07-30T09:10:00+03:00",
    correlationId: "COR-1002",
  },
];

export const suspiciousActivityFixture: SuspiciousActivity[] = [
  {
    id: "SUS-1001",
    actor: customer,
    label: "Repeated failed login attempts",
    riskScore: 92,
    risk: "critical",
    signals: ["Velocity spike", "New broad region", "Device mismatch"],
    platform: "ios",
    state: "New",
    incident: incidentRef,
    revision: 1,
    allowedActions: ["assign_reviewer"],
    timeline: [{ at: "2026-07-30T10:45:00+03:00", label: "Future backend flagged suspicious activity" }],
  },
  {
    id: "SUS-1002",
    actor: secondCustomer,
    label: "Impossible travel pattern",
    riskScore: 67,
    risk: "high",
    signals: ["Broad region mismatch"],
    platform: "android",
    state: "Investigating",
    reviewer: securityAdmin,
    revision: 1,
    allowedActions: ["resolve", "dismiss"],
    timeline: [{ at: "2026-07-30T08:30:00+03:00", label: "Reviewer assigned" }],
  },
];

export const incidentFixture: IncidentDetail[] = [
  {
    id: "INC-1001",
    severity: "critical",
    state: "Open",
    owner: securityAdmin,
    affectedServices: [{ id: "SVC-1001", kind: "service", label: "Authentication service" }],
    affectedCustomerCount: 1,
    platform: "ios",
    revision: 1,
    timeline: [{ at: "2026-07-30T10:50:00+03:00", label: "Incident opened from suspicious activity" }],
    allowedActions: ["contain"],
    auditReferences: [],
  },
  {
    id: "INC-1002",
    severity: "high",
    state: "Resolved",
    owner: securityAdmin,
    affectedServices: [{ id: "SVC-1002", kind: "service", label: "Support access review" }],
    affectedCustomerCount: 0,
    platform: "global",
    revision: 1,
    timeline: [{ at: "2026-07-30T07:00:00+03:00", label: "Resolution confirmed" }],
    allowedActions: ["reopen_monitoring", "close"],
    auditReferences: [],
  },
];

export const adminSecurityFixture: AdminSecurity[] = [
  { id: "ASA-1001", admin: securityAdmin, roleSummary: "Security Administrator", twoFactorState: "enabled", lastLoginAt: "2026-07-30T08:00:00+03:00", activeSessionCount: 2, risk: "low" },
  { id: "ASA-1002", admin: superAdmin, roleSummary: "Super Admin", twoFactorState: "recovery_required", lastLoginAt: "2026-07-29T17:20:00+03:00", activeSessionCount: 1, risk: "medium" },
];

export const permissionChangeFixture: PermissionChange[] = [
  {
    id: "PCH-1001",
    subject: securityAdmin,
    previousValue: "Support review only",
    newValue: "Security incident management",
    actor: superAdmin,
    reason: "Temporary incident coverage",
    result: "success",
    occurredAt: "2026-07-29T12:00:00+03:00",
    correlationId: "COR-2001",
  },
];

export const supportAccessFixture: SupportAccessGrant[] = [
  {
    id: "SAC-1001",
    agent: { id: "ADM-1003", kind: "admin", label: "Support Agent" },
    customer,
    ticket,
    scopes: ["Profile summary", "Recent sessions"],
    startedAt: "2026-07-30T09:00:00+03:00",
    expiresAt: "2026-07-30T14:00:00+03:00",
    state: "active",
    revision: 1,
    timeline: [{ at: "2026-07-30T09:00:00+03:00", label: "Access approved in Spec 003" }],
  },
  {
    id: "SAC-1002",
    agent: { id: "ADM-1004", kind: "admin", label: "Support Agent 2" },
    customer: secondCustomer,
    ticket,
    scopes: ["Ticket context"],
    startedAt: "2026-07-29T09:00:00+03:00",
    expiresAt: "2026-07-29T14:00:00+03:00",
    state: "expired",
    revision: 1,
    timeline: [{ at: "2026-07-29T14:00:00+03:00", label: "Access expired" }],
  },
];

export const auditEventFixture: AuditEventDetail[] = [
  {
    id: "AUD-1001",
    occurredAt: "2026-07-30T10:55:00+03:00",
    actor: securityAdmin,
    action: "security.incident.updated",
    resource: "incident",
    target: incidentRef,
    result: "success",
    severity: "high",
    correlationId: "COR-3001",
    region: "GCC",
    metadata: [{ key: "state", label: "State", value: "Contained" }, { key: "revision", label: "Revision", value: 2 }],
    before: [{ key: "state", label: "Before", value: "Open" }],
    after: [{ key: "state", label: "After", value: "Contained" }],
    related: [incidentRef],
  },
];

export const exportRequestFixture: ExportRequestDetail[] = [
  {
    id: "EXP-1001",
    customer,
    scopes: ["profile", "devices_sessions", "files"],
    state: "Ready",
    requestedAt: "2026-07-30T08:00:00+03:00",
    expiresAt: "2026-07-30T15:00:00+03:00",
    file: { basename: "masarifi-export-EXP-1001.zip", mediaType: "application/zip", sizeBytes: 2048, checksumLabel: "mock-checksum", state: "ready" },
    timeline: [{ at: "2026-07-30T11:00:00+03:00", label: "Mock request marked Ready" }],
    revision: 1,
    allowedActions: ["simulate_download", "expire"],
    auditReferences: [],
  },
  {
    id: "EXP-1002",
    customer: secondCustomer,
    scopes: ["profile"],
    state: "Requested",
    requestedAt: "2026-07-30T11:00:00+03:00",
    timeline: [{ at: "2026-07-30T11:00:00+03:00", label: "Request received" }],
    revision: 1,
    allowedActions: ["validate", "fail", "cancel"],
    auditReferences: [],
  },
];

const checklistBase = [
  "customer_notified",
  "subscription_cancelled",
  "sessions_revoked",
  "exports_handled",
  "files_removed",
  "financial_data_deleted_or_anonymized",
  "ai_data_deleted",
  "audit_records_preserved",
  "completion_confirmed",
] as const;

export const deletionRequestFixture: DeletionRequestDetail[] = [
  {
    id: "DEL-1001",
    customer,
    state: "Scheduled",
    requestedAt: "2026-07-29T10:00:00+03:00",
    scheduledAt: "2026-07-31T10:00:00+03:00",
    legalHold: false,
    subscriptionStatus: "Cancelled in billing workflow",
    checklist: checklistBase.map((category) => ({
      category,
      state: category === "audit_records_preserved" ? "preserved" : "completed",
      responsible: "Future backend capability",
      required: true,
      preserved: category === "audit_records_preserved",
      updatedAt: PHASE7_NOW,
    })),
    revision: 1,
    allowedActions: ["start", "cancel"],
    auditReferences: [],
  },
  {
    id: "DEL-1002",
    customer: secondCustomer,
    state: "In Progress",
    requestedAt: "2026-07-28T10:00:00+03:00",
    legalHold: true,
    subscriptionStatus: "Pending cancellation",
    checklist: checklistBase.map((category) => ({
      category,
      state: category === "audit_records_preserved" ? "preserved" : category === "completion_confirmed" ? "pending" : "completed",
      responsible: "Future backend capability",
      required: true,
      preserved: category === "audit_records_preserved",
      updatedAt: PHASE7_NOW,
    })),
    revision: 1,
    allowedActions: ["block"],
    auditReferences: [],
  },
];

export const retentionPolicyFixture: RetentionPolicyDetail[] = [
  {
    id: "RET-1001",
    dataCategory: "Audit evidence",
    storageCategory: "Immutable audit storage",
    retentionDays: 365,
    minimumDays: 365,
    maximumDays: 2555,
    cleanupProcess: "Future backend retention worker",
    lastCleanupAt: "2026-07-01T03:00:00+03:00",
    state: "active",
    effectiveCleanupState: "active",
    legalHold: false,
    protectedAuditPolicy: true,
    revision: 1,
    changeHistory: [{ at: "2026-07-01T03:00:00+03:00", label: "Policy reviewed" }],
    allowedActions: ["update"],
  },
  {
    id: "RET-1002",
    dataCategory: "Support attachments metadata",
    storageCategory: "File metadata only",
    retentionDays: 180,
    minimumDays: 30,
    maximumDays: 730,
    cleanupProcess: "Future backend cleanup worker",
    state: "suspended",
    effectiveCleanupState: "suspended",
    legalHold: true,
    protectedAuditPolicy: false,
    revision: 1,
    changeHistory: [{ at: "2026-07-15T09:00:00+03:00", label: "Legal hold activated" }],
    allowedActions: ["update"],
  },
];
