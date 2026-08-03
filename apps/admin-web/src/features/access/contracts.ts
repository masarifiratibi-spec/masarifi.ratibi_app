import { z } from "zod";
import {
  accountStatusSchema,
  paginationSchema,
  platformSchema,
  regionStateSchema,
  riskLevelSchema,
  userIdSchema,
} from "@/features/users/contracts";

const unique = <T>(entries: T[]) => new Set(entries).size === entries.length;
const strictRegionStateSchema = regionStateSchema.strict();
const strictPaginationSchema = paginationSchema.strict();

export const accessRequestIdSchema = z.string().regex(/^ACC-[A-Z0-9-]{1,44}$/).max(48);
export const ticketIdSchema = z.string().regex(/^TKT-[A-Z0-9-]{1,44}$/).max(48);
export const auditReferenceSchema = z.string().regex(/^AUD-[A-Z0-9-]{1,44}$/).max(48);
export const adminActorSchema = z.string().regex(/^ADM-[A-Z0-9-]{1,44}$/).max(48);
export const accessStatusSchema = z.enum(["pending", "approved", "active", "expired", "rejected", "revoked"]);
export const accessScopeSchema = z.enum([
  "profile-contact",
  "account-status",
  "device-diagnostics",
  "session-diagnostics",
  "subscription-summary",
  "import-summary",
]);
export type AccessStatus = z.infer<typeof accessStatusSchema>;
export type AccessScope = z.infer<typeof accessScopeSchema>;

const scopeListSchema = z.array(accessScopeSchema).min(1).max(6).refine(unique, "Scope values must be unique");

export const accessRequestsQuerySchema = z.object({
  query: z.string().trim().min(1).max(100).optional(),
  status: accessStatusSchema.optional(),
  assignee: adminActorSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)])).default(25),
  scenario: z.string().trim().max(40).optional(),
}).strict();
export type AccessRequestsQuery = z.output<typeof accessRequestsQuerySchema>;

export const accessRequestSummarySchema = z.object({
  id: accessRequestIdSchema,
  userId: userIdSchema,
  maskedCustomerLabel: z.string().min(1).max(160),
  supportTicketId: ticketIdSchema,
  requestedBy: adminActorSchema,
  assignee: adminActorSchema,
  requestedScope: scopeListSchema,
  approvedScope: scopeListSchema.nullable(),
  reasonSummary: z.string().min(1).max(160),
  status: accessStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  approvedBy: adminActorSchema.nullable(),
}).strict().superRefine((request, context) => {
  if (request.approvedScope?.some((scope) => !request.requestedScope.includes(scope))) {
    context.addIssue({ code: "custom", path: ["approvedScope"], message: "Approved scope must be requested" });
  }
  if (request.approvedBy === request.requestedBy) {
    context.addIssue({ code: "custom", path: ["approvedBy"], message: "Requester cannot approve" });
  }
  const timed = ["approved", "active", "expired"].includes(request.status);
  if (timed && (!request.startsAt || !request.expiresAt)) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Timed access requires start and expiry" });
  }
});
export type AccessRequestSummary = z.infer<typeof accessRequestSummarySchema>;

export const accessRequestsPageSchema = z.object({
  items: z.array(accessRequestSummarySchema).max(100),
  pagination: strictPaginationSchema,
  region: strictRegionStateSchema,
}).strict();
export type AccessRequestsPage = z.infer<typeof accessRequestsPageSchema>;

export const maskedCustomerSummarySchema = z.object({
  userId: userIdSchema,
  displayName: z.string().min(1).max(100),
  maskedEmail: z.string().regex(/^[^@]*\*{3}[^@]*@example\.test$/).max(160),
  status: accountStatusSchema,
  primaryPlatform: platformSchema,
  registeredPlatforms: z.array(platformSchema).min(1).max(2).refine(unique),
  risk: riskLevelSchema,
}).strict();

export const accessTimelineItemSchema = z.object({
  id: z.string().min(1).max(48),
  event: z.enum(["created", "approved", "rejected", "active", "revoked", "expired", "ended"]),
  actor: adminActorSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  summary: z.string().min(1).max(240),
  auditReference: auditReferenceSchema,
}).strict();

export const accessRequestDetailSchema = accessRequestSummarySchema.safeExtend({
  ticketSummary: z.string().min(1).max(300),
  customerSummary: maskedCustomerSummarySchema,
  reason: z.string().min(10).max(500),
  requestedDurationMinutes: z.number().int().min(5).max(60),
  approvedDurationMinutes: z.number().int().min(5).max(60).nullable(),
  maskingRules: z.array(z.string().min(1).max(160)).min(1).max(12).refine(unique),
  customerApprovalRequired: z.boolean(),
  customerApprovalState: z.enum(["not-required", "pending", "received"]),
  timeline: z.array(accessTimelineItemSchema).max(50),
  region: strictRegionStateSchema,
}).strict().superRefine((request, context) => {
  if (
    request.approvedDurationMinutes !== null
    && request.approvedDurationMinutes > request.requestedDurationMinutes
  ) {
    context.addIssue({ code: "custom", path: ["approvedDurationMinutes"], message: "Approved duration cannot increase" });
  }
  if (request.timeline.some((entry, index) => index > 0 && entry.occurredAt < request.timeline[index - 1].occurredAt)) {
    context.addIssue({ code: "custom", path: ["timeline"], message: "Timeline must be chronological" });
  }
}).strict();
export type AccessRequestDetail = z.infer<typeof accessRequestDetailSchema>;

export const createAccessRequestSchema = z.object({
  userId: userIdSchema,
  supportTicketId: ticketIdSchema,
  assignee: adminActorSchema,
  reason: z.string().trim().min(10).max(500),
  requestedScope: scopeListSchema,
  maskingRequired: z.literal(true),
  durationMinutes: z.number().int().min(5).max(60).default(30),
  customerApprovalRequired: z.boolean(),
}).strict();
export type CreateAccessRequest = z.infer<typeof createAccessRequestSchema>;

export function accessDecisionRequestSchema(context: {
  requestedScope: AccessScope[];
  requestedDurationMinutes: number;
  requestedBy: string;
  actor: string;
  now?: Date;
}) {
  return z.object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().min(5).max(500),
    approvedScope: scopeListSchema.optional(),
    durationMinutes: z.number().int().min(5).max(60).optional(),
    startsAt: z.iso.datetime({ offset: true }).optional(),
  }).strict().superRefine((decision, issues) => {
    if (context.actor === context.requestedBy) {
      issues.addIssue({ code: "custom", message: "Requester cannot decide own request" });
    }
    if (decision.decision === "approve") {
      if (!decision.approvedScope || !decision.durationMinutes || !decision.startsAt) {
        issues.addIssue({ code: "custom", message: "Approval requires scope, duration, and start" });
      }
      if (decision.approvedScope?.some((scope) => !context.requestedScope.includes(scope))) {
        issues.addIssue({ code: "custom", path: ["approvedScope"], message: "Approval cannot widen scope" });
      }
      if (decision.durationMinutes && decision.durationMinutes > context.requestedDurationMinutes) {
        issues.addIssue({ code: "custom", path: ["durationMinutes"], message: "Approval cannot increase duration" });
      }
      if (decision.startsAt && new Date(decision.startsAt).getTime() < (context.now ?? new Date()).getTime() - 60_000) {
        issues.addIssue({ code: "custom", path: ["startsAt"], message: "Approval cannot start in the past" });
      }
    } else if (decision.approvedScope || decision.durationMinutes || decision.startsAt) {
      issues.addIssue({ code: "custom", message: "Rejection cannot approve access" });
    }
  });
}

export const accessDecisionInputSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().min(5).max(500),
  approvedScope: scopeListSchema.optional(),
  durationMinutes: z.number().int().min(5).max(60).optional(),
  startsAt: z.iso.datetime({ offset: true }).optional(),
}).strict();
export type AccessDecisionRequest = z.infer<typeof accessDecisionInputSchema>;

export const revokeAccessRequestSchema = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
export type RevokeAccessRequest = z.infer<typeof revokeAccessRequestSchema>;

const TRANSITIONS: Record<AccessStatus, readonly AccessStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["active", "expired", "revoked"],
  active: ["expired", "revoked"],
  expired: [],
  rejected: [],
  revoked: [],
};

export function canTransitionAccess(current: AccessStatus, next: AccessStatus): boolean {
  return TRANSITIONS[current].includes(next);
}

export const workspaceFieldSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.union([z.string().max(300), z.number().int()]),
  classification: z.enum(["masked", "aggregate", "status"]),
}).strict();

export const workspaceSectionSchema = z.object({
  scope: accessScopeSchema,
  title: z.string().min(1).max(100),
  fields: z.array(workspaceFieldSchema).min(1).max(20),
}).strict();

export const temporaryWorkspaceRequestSchema = z.object({
  requestId: accessRequestIdSchema,
  simulatedActor: adminActorSchema,
}).strict();

export const temporaryWorkspaceSchema = z.object({
  requestId: accessRequestIdSchema,
  supportTicketId: ticketIdSchema,
  assignee: adminActorSchema,
  status: z.literal("active"),
  approvedScope: scopeListSchema,
  startsAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  accessNotice: z.string().min(1).max(240),
  auditIndicator: z.string().min(1).max(80),
  sections: z.array(workspaceSectionSchema).min(1).max(6),
  region: strictRegionStateSchema,
}).strict().superRefine((workspace, context) => {
  if (new Date(workspace.expiresAt).getTime() <= Date.now()) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Workspace must not be expired" });
  }
  const sectionScopes = workspace.sections.map((section) => section.scope);
  if (!unique(sectionScopes)
    || sectionScopes.length !== workspace.approvedScope.length
    || sectionScopes.some((scope) => !workspace.approvedScope.includes(scope))) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Sections must equal approved scope" });
  }
}).strict();
export type TemporaryWorkspace = z.infer<typeof temporaryWorkspaceSchema>;

export const endTemporaryAccessRequestSchema = z.object({
  reason: z.string().trim().max(300).optional(),
}).strict();
export type EndTemporaryAccessRequest = z.infer<typeof endTemporaryAccessRequestSchema>;

export const endTemporaryAccessResultSchema = z.object({
  requestId: accessRequestIdSchema,
  status: z.literal("revoked"),
  endedAt: z.iso.datetime({ offset: true }),
  auditReference: auditReferenceSchema,
  message: z.string().min(1).max(200),
}).strict();
export type EndTemporaryAccessResult = z.infer<typeof endTemporaryAccessResultSchema>;
