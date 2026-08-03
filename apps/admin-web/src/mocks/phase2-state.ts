import { ApiError, safeApiMessage } from "@/core/api/errors";
import {
  accessDecisionRequestSchema,
  accessRequestDetailSchema,
  canTransitionAccess,
  createAccessRequestSchema,
  endTemporaryAccessRequestSchema,
  revokeAccessRequestSchema,
  temporaryWorkspaceSchema,
  type AccessDecisionRequest,
  type AccessRequestDetail,
  type AccessScope,
  type CreateAccessRequest,
  type EndTemporaryAccessRequest,
  type TemporaryWorkspace,
} from "@/features/access/contracts";
import { createAccessFixtures, supportTickets } from "./fixtures/access";
import { users } from "./fixtures/users";
import { userDevices, userProfiles, userSessions, type UserFixture } from "./fixtures/users";
import {
  reactivateUserRequestSchema,
  revokeDeviceRequestSchema,
  revokeSessionsRequestSchema,
  suspendUserRequestSchema,
  updateVerificationRequestSchema,
  userBulkActionRequestSchema,
  userBulkActionResultSchema,
  type ReactivateUserRequest,
  type RevokeDeviceRequest,
  type RevokeSessionsRequest,
  type SuspendUserRequest,
  type UpdateVerificationRequest,
  type UserActionResult,
  type UserBulkActionRequest,
  type UserBulkActionResult,
  type UserDevice,
  type UserProfileSummary,
  type UserSession,
} from "@/features/users/contracts";

let accessRequests = structuredClone(createAccessFixtures());
let customerUsers = structuredClone(users);
let customerProfiles = structuredClone(userProfiles);
let customerDevices = structuredClone(userDevices);
let customerSessions = structuredClone(userSessions);
let customerAuditSequence = 1;

function stateError(code: "conflict" | "forbidden" | "not_found" | "gone", status: number): never {
  throw new ApiError(code, safeApiMessage(code), status);
}

function accessRequest(requestId: string): AccessRequestDetail {
  const request = accessRequests.find((candidate) => candidate.id === requestId);
  if (!request) stateError("not_found", 404);
  return request;
}

function auditEntry(request: AccessRequestDetail, event: "approved" | "rejected" | "active" | "revoked" | "expired" | "ended", actor: string, summary: string) {
  const sequence = request.timeline.length + 1;
  request.timeline.push({
    id: `ATL-${request.id}-${sequence}`,
    event,
    actor,
    occurredAt: new Date().toISOString(),
    summary,
    auditReference: `AUD-${request.id}-${sequence}`,
  });
}

export function resetPhase2MockState(): void {
  accessRequests = structuredClone(createAccessFixtures());
  customerUsers = structuredClone(users);
  customerProfiles = structuredClone(userProfiles);
  customerDevices = structuredClone(userDevices);
  customerSessions = structuredClone(userSessions);
  customerAuditSequence = 1;
}

export interface Phase2MockState {
  users: UserFixture[];
  profiles: UserProfileSummary[];
  devices: UserDevice[];
  sessions: UserSession[];
}

export function getPhase2MockState(): Phase2MockState {
  return structuredClone({
    users: customerUsers,
    profiles: customerProfiles,
    devices: customerDevices,
    sessions: customerSessions,
  });
}

function customerUser(userId: string): UserFixture {
  const user = customerUsers.find(({ id }) => id === userId);
  if (!user) stateError("not_found", 404);
  return user;
}

function syncProfile(user: UserFixture): void {
  const profile = customerProfiles.find(({ id }) => id === user.id);
  if (!profile) stateError("not_found", 404);
  profile.status = user.status;
  profile.verification = user.verification;
}

function customerActionResult(
  userId: string,
  action: UserActionResult["action"],
  previousState: string,
  currentState: string,
  affectedCount = 1,
  outcome: UserActionResult["outcome"] = "success",
): UserActionResult {
  return {
    userId,
    action,
    previousState,
    currentState,
    outcome,
    affectedCount,
    occurredAt: new Date().toISOString(),
    message: outcome === "success" ? "تم تنفيذ الإجراء بنجاح." : "تم تنفيذ الإجراء جزئياً.",
    auditReference: `AUD-USER-${customerAuditSequence++}`,
  };
}

export function suspendPhase2User(userId: string, input: SuspendUserRequest): UserActionResult {
  suspendUserRequestSchema.parse(input);
  const user = customerUser(userId);
  if (user.status === "suspended") stateError("conflict", 409);
  const previousState = user.status;
  user.status = "suspended";
  syncProfile(user);
  return customerActionResult(userId, "suspend", previousState, user.status);
}

export function reactivatePhase2User(userId: string, input: ReactivateUserRequest): UserActionResult {
  reactivateUserRequestSchema.parse(input);
  const user = customerUser(userId);
  if (user.status !== "suspended") stateError("conflict", 409);
  user.status = "active";
  syncProfile(user);
  return customerActionResult(userId, "reactivate", "suspended", user.status);
}

export function updatePhase2Verification(
  userId: string,
  input: UpdateVerificationRequest,
): UserActionResult {
  const request = updateVerificationRequestSchema.parse(input);
  const user = customerUser(userId);
  if (user.verification === request.nextState) stateError("conflict", 409);
  const previousState = user.verification;
  user.verification = request.nextState;
  syncProfile(user);
  return customerActionResult(userId, "verification", previousState, user.verification);
}

export function revokePhase2Device(
  userId: string,
  deviceId: string,
  input: RevokeDeviceRequest,
): UserActionResult {
  revokeDeviceRequestSchema.parse(input);
  const device = customerDevices.find((candidate) => candidate.id === deviceId && candidate.userId === userId);
  if (!device) stateError("not_found", 404);
  if (device.state !== "active") stateError("conflict", 409);
  device.state = "revoked";
  device.sessionState = "revoked";
  device.revokedAt = new Date().toISOString();
  return customerActionResult(userId, "revoke-device", "active", "revoked");
}

export function revokePhase2Sessions(
  userId: string,
  input: RevokeSessionsRequest,
): UserActionResult {
  const request = revokeSessionsRequestSchema.parse(input);
  const candidates = customerSessions.filter((session) =>
    session.userId === userId
    && (request.scope === "all" || request.sessionIds.includes(session.id)));
  if (request.scope === "selected" && candidates.length !== request.sessionIds.length) stateError("not_found", 404);
  const active = candidates.filter(({ state }) => state === "active");
  const revokedAt = new Date().toISOString();
  for (const session of active) {
    session.state = "revoked";
    session.revokedAt = revokedAt;
  }
  const outcome = active.length === candidates.length ? "success" : "partial";
  return customerActionResult(userId, "revoke-sessions", "active", "revoked", active.length, outcome);
}

function bulkEligible(user: UserFixture, action: UserBulkActionRequest["action"]): boolean {
  if (action === "suspend") return user.status !== "suspended";
  if (action === "reactivate") return user.status === "suspended";
  if (action === "force-logout") {
    return customerSessions.some((session) => session.userId === user.id && session.state === "active");
  }
  return true;
}

export function runPhase2BulkAction(input: UserBulkActionRequest): UserBulkActionResult {
  const request = userBulkActionRequestSchema.parse(input);
  const failures: UserBulkActionResult["failures"] = [];
  let succeededCount = 0;
  for (const userId of request.userIds) {
    const user = customerUsers.find((candidate) => candidate.id === userId);
    if (!user || !bulkEligible(user, request.action)) {
      failures.push({ userId, code: user ? "ineligible_state" : "not_found", message: user
        ? "الحالة الحالية غير مؤهلة لهذا الإجراء."
        : "تعذر العثور على المستخدم المحدد." });
      continue;
    }
    if (request.action === "suspend") {
      suspendPhase2User(userId, {
        reason: request.reason as string,
        durationDays: request.durationDays as number,
        internalNote: "",
        notifyUser: request.notifyUser ?? false,
      });
    } else if (request.action === "reactivate") {
      reactivatePhase2User(userId, { reason: request.reason as string, internalNote: "" });
    } else if (request.action === "force-logout") {
      revokePhase2Sessions(userId, { scope: "all", sessionIds: [], reason: request.reason as string });
    }
    succeededCount += 1;
  }
  return userBulkActionResultSchema.parse({
    requestedCount: request.userIds.length,
    eligibleCount: succeededCount,
    succeededCount,
    failedCount: failures.length,
    failures,
    auditReference: `AUD-BULK-${customerAuditSequence++}`,
  });
}

export function getPhase2AccessRequests(): AccessRequestDetail[] {
  return structuredClone(accessRequests);
}

export function setPhase2NearExpiry(requestId: string, expiresAt: string): void {
  const request = accessRequest(requestId);
  if (request.status !== "active") stateError("conflict", 409);
  request.expiresAt = expiresAt;
}

export function getPhase2AccessRequest(requestId: string): AccessRequestDetail {
  return accessRequestDetailSchema.parse(structuredClone(accessRequest(requestId)));
}

export function createPhase2AccessRequest(input: CreateAccessRequest, requestedBy: string): AccessRequestDetail {
  const request = createAccessRequestSchema.parse(input);
  const ticket = supportTickets.find((candidate) => candidate.id === request.supportTicketId);
  const user = users.find((candidate) => candidate.id === request.userId);
  if (!ticket || ticket.userId !== request.userId || !user) stateError("not_found", 404);
  const overlaps = accessRequests.some((candidate) =>
    ["pending", "approved", "active"].includes(candidate.status)
    && candidate.assignee === request.assignee
    && candidate.userId === request.userId
    && candidate.supportTicketId === request.supportTicketId
    && candidate.requestedScope.some((scope) => request.requestedScope.includes(scope)));
  if (overlaps) stateError("conflict", 409);

  const sequence = accessRequests.length + 1001;
  const now = new Date().toISOString();
  const created: AccessRequestDetail = {
    id: `ACC-${sequence}`,
    userId: user.id,
    maskedCustomerLabel: user.maskedEmail,
    supportTicketId: ticket.id,
    requestedBy,
    assignee: request.assignee,
    requestedScope: request.requestedScope,
    approvedScope: null,
    reasonSummary: request.reason.slice(0, 160),
    status: "pending",
    createdAt: now,
    startsAt: null,
    expiresAt: null,
    approvedBy: null,
    ticketSummary: ticket.summary,
    customerSummary: {
      userId: user.id,
      displayName: user.displayName,
      maskedEmail: user.maskedEmail,
      status: user.status,
      primaryPlatform: user.primaryPlatform,
      registeredPlatforms: user.registeredPlatforms,
      risk: user.risk,
    },
    reason: request.reason,
    requestedDurationMinutes: request.durationMinutes,
    approvedDurationMinutes: null,
    maskingRules: [
      "البريد الإلكتروني مخفي جزئياً",
      "القيم المالية والتفاصيل الخام غير متاحة",
      "المعرّفات التقنية الحساسة غير متاحة",
    ],
    customerApprovalRequired: request.customerApprovalRequired,
    customerApprovalState: request.customerApprovalRequired ? "pending" : "not-required",
    timeline: [{
      id: `ATL-ACC-${sequence}-1`,
      event: "created",
      actor: requestedBy,
      occurredAt: now,
      summary: "تم إنشاء طلب وصول محدود",
      auditReference: `AUD-ACC-${sequence}-1`,
    }],
    region: { availability: "available" },
  };
  accessRequests.push(accessRequestDetailSchema.parse(created));
  return structuredClone(created);
}

export function decidePhase2AccessRequest(
  requestId: string,
  input: AccessDecisionRequest,
  actor: string,
): AccessRequestDetail {
  const request = accessRequest(requestId);
  if (request.status !== "pending") stateError("conflict", 409);
  if (request.requestedBy === actor) stateError("forbidden", 403);
  const decision = accessDecisionRequestSchema({
    requestedScope: request.requestedScope,
    requestedDurationMinutes: request.requestedDurationMinutes,
    requestedBy: request.requestedBy,
    actor,
  }).parse(input);

  if (decision.decision === "reject") {
    request.status = "rejected";
    auditEntry(request, "rejected", actor, "تم رفض طلب الوصول");
  } else {
    const startsAt = decision.startsAt as string;
    request.status = "approved";
    request.approvedScope = decision.approvedScope as AccessScope[];
    request.approvedDurationMinutes = decision.durationMinutes as number;
    request.approvedBy = actor;
    request.startsAt = startsAt;
    request.expiresAt = new Date(new Date(startsAt).getTime() + request.approvedDurationMinutes * 60_000).toISOString();
    auditEntry(request, "approved", actor, "تم اعتماد نطاق ومدة مخفضين أو مساويين");
  }
  return getPhase2AccessRequest(requestId);
}

export function revokePhase2AccessRequest(requestId: string, input: { reason: string }, actor: string): AccessRequestDetail {
  const request = accessRequest(requestId);
  revokeAccessRequestSchema.parse(input);
  if (!canTransitionAccess(request.status, "revoked")) stateError("conflict", 409);
  request.status = "revoked";
  auditEntry(request, "revoked", actor, "تم إلغاء الوصول المؤقت");
  return getPhase2AccessRequest(requestId);
}

const sectionFactories: Record<AccessScope, () => TemporaryWorkspace["sections"][number]> = {
  "profile-contact": () => ({
    scope: "profile-contact",
    title: "بيانات التواصل المخفية",
    fields: [
      { label: "البريد الإلكتروني", value: "n***@example.test", classification: "masked" },
      { label: "اللغة", value: "العربية", classification: "status" },
    ],
  }),
  "account-status": () => ({
    scope: "account-status",
    title: "حالة الحساب",
    fields: [{ label: "الحالة", value: "نشط", classification: "status" }],
  }),
  "device-diagnostics": () => ({
    scope: "device-diagnostics",
    title: "تشخيص الأجهزة",
    fields: [{ label: "الأجهزة المسجلة", value: 2, classification: "aggregate" }],
  }),
  "session-diagnostics": () => ({
    scope: "session-diagnostics",
    title: "تشخيص الجلسات",
    fields: [{ label: "الجلسات النشطة", value: 1, classification: "aggregate" }],
  }),
  "subscription-summary": () => ({
    scope: "subscription-summary",
    title: "ملخص الاشتراك",
    fields: [{ label: "الخطة", value: "Premium", classification: "status" }],
  }),
  "import-summary": () => ({
    scope: "import-summary",
    title: "ملخص الاستيراد",
    fields: [{ label: "آخر مزامنة", value: "متاحة", classification: "status" }],
  }),
};

export function getPhase2TemporaryWorkspace(requestId: string, actor: string, now = new Date()): TemporaryWorkspace {
  const request = accessRequest(requestId);
  const ticket = supportTickets.find((candidate) =>
    candidate.id === request.supportTicketId && candidate.userId === request.userId);
  if (!ticket) stateError("not_found", 404);
  if (request.assignee !== actor) stateError("forbidden", 403);
  if (!request.startsAt || !request.expiresAt || !request.approvedScope) stateError("conflict", 409);
  if (new Date(request.expiresAt).getTime() <= now.getTime()) {
    if (canTransitionAccess(request.status, "expired")) {
      request.status = "expired";
      auditEntry(request, "expired", actor, "انتهت مدة الوصول");
    }
    stateError("gone", 410);
  }
  if (new Date(request.startsAt).getTime() > now.getTime()) stateError("conflict", 409);
  if (request.status === "approved") {
    request.status = "active";
    auditEntry(request, "active", actor, "تم فتح مساحة العمل المؤقتة");
  }
  if (request.status !== "active") stateError("conflict", 409);

  return temporaryWorkspaceSchema.parse({
    requestId: request.id,
    supportTicketId: request.supportTicketId,
    assignee: request.assignee,
    status: "active",
    approvedScope: request.approvedScope,
    startsAt: request.startsAt,
    expiresAt: request.expiresAt,
    accessNotice: "هذه مساحة دعم مؤقتة ومراقبة، وتعرض البيانات المعتمدة فقط.",
    auditIndicator: request.timeline.at(-1)?.auditReference ?? `AUD-${request.id}-ENTRY`,
    sections: request.approvedScope.map((scope) => sectionFactories[scope]()),
    region: { availability: "available" },
  });
}

export function endPhase2TemporaryAccess(
  requestId: string,
  input: EndTemporaryAccessRequest,
  actor: string,
) {
  endTemporaryAccessRequestSchema.parse(input);
  const request = accessRequest(requestId);
  if (request.assignee !== actor) stateError("forbidden", 403);
  if (request.status !== "active") stateError("conflict", 409);
  request.status = "revoked";
  auditEntry(request, "ended", actor, "أنهى المكلّف الوصول المؤقت");
  return {
    requestId,
    status: "revoked" as const,
    endedAt: request.timeline.at(-1)?.occurredAt ?? new Date().toISOString(),
    auditReference: request.timeline.at(-1)?.auditReference ?? `AUD-${request.id}-END`,
    message: "تم إنهاء الوصول وإزالة بيانات مساحة العمل.",
  };
}
