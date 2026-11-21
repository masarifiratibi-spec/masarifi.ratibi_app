import { z } from "zod";
import { accessRequestIdSchema, accessScopeSchema, adminActorSchema, ticketIdSchema } from "./contracts";
import { userIdSchema } from "@/features/users/contracts";

export const supportActionSchema = z.enum(["read-masked", "read-status", "read-aggregate"]);
export const supportScopeSchema = z.array(z.object({ resource: accessScopeSchema, actions: z.array(supportActionSchema).min(1).max(3) }).strict())
  .min(1).max(6).refine(items => new Set(items.map(item => item.resource)).size === items.length, "Duplicate resource");
const reference = (kind: "customer" | "admin") => z.object({ id: kind === "customer" ? userIdSchema : adminActorSchema, kind: z.literal(kind), label: z.string().min(1).max(160) }).strict();
export const liveAccessRequestSchema = z.object({
  id: accessRequestIdSchema, user: reference("customer"), requester: reference("admin"), assignee: reference("admin"),
  supportTicketId: ticketIdSchema, scopes: supportScopeSchema,
  status: z.enum(["pending", "approved", "denied", "expired", "revoked"]),
  customerApprovalRequired: z.boolean(), customerApprovedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  expiresAt: z.iso.datetime({ offset: true }), version: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }).optional(), purpose: z.string().min(10).max(500).optional(),
  requestedDurationMinutes: z.number().int().min(1).max(1440).optional(),
  approvedBy: reference("admin").nullable().optional(), decidedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  grant: z.object({ id: z.uuid(), scopes: supportScopeSchema, startsAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }), revokedAt: z.iso.datetime({ offset: true }).nullable() }).strict().nullable().optional(),
}).strict().superRefine((row, context) => {
  if (!row.grant) return;
  const requested = new Map(row.scopes.map(scope => [scope.resource, scope.actions]));
  if (row.grant.scopes.some(scope => !requested.has(scope.resource) || scope.actions.some(action => !requested.get(scope.resource)?.includes(action)))) {
    context.addIssue({ code: "custom", path: ["grant"], message: "Grant widens requested scope" });
  }
  if (Date.parse(row.grant.expiresAt) > Date.parse(row.expiresAt) || Date.parse(row.grant.expiresAt) <= Date.parse(row.grant.startsAt)) {
    context.addIssue({ code: "custom", path: ["grant"], message: "Grant window exceeds request" });
  }
});
export type LiveAccessRequest = z.infer<typeof liveAccessRequestSchema>;
export const liveAccessPageSchema = z.object({ items: z.array(liveAccessRequestSchema).max(100), nextCursor: z.string().min(1).max(1024).nullable() }).strict();

const sectionSchemas = [
  z.object({ resource: z.literal("profile-contact"), projection: z.literal("masked"),
    emailMasked: z.string().max(320).refine(value => value.includes("***")).optional(),
    phoneMasked: z.string().max(64).refine(value => value.includes("***")).optional() }).strict(),
  z.object({ resource: z.literal("account-status"), projection: z.literal("status"), status: z.string().min(1).max(40).optional() }).strict(),
  z.object({ resource: z.literal("device-diagnostics"), projection: z.literal("aggregate"), total: z.number().int().nonnegative().optional(),
    active: z.number().int().nonnegative().optional(), lastSeenAt: z.iso.datetime({ offset: true }).optional() }).strict(),
  z.object({ resource: z.literal("session-diagnostics"), projection: z.literal("aggregate"), active: z.number().int().nonnegative().optional() }).strict(),
  z.object({ resource: z.enum(["subscription-summary", "import-summary"]), projection: z.literal("status"), available: z.literal(false) }).strict(),
] as const;
export const liveWorkspaceSchema = z.object({ requestId: accessRequestIdSchema, grantId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }),
  access: z.object({ supportTicketId: ticketIdSchema, assignee: adminActorSchema, startsAt: z.iso.datetime({ offset: true }), scopes: supportScopeSchema, version: z.number().int().positive() }).strict().optional(),
  sections: z.array(z.union(sectionSchemas)).min(1).max(6) }).strict().refine(value => new Set(value.sections.map(section => section.resource)).size === value.sections.length, "Duplicate workspace resource");
