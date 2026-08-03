import { describe, expect, test } from "vitest";
import {
  accessDecisionRequestSchema,
  accessRequestDetailSchema,
  accessRequestsQuerySchema,
  canTransitionAccess,
  createAccessRequestSchema,
  temporaryWorkspaceSchema,
} from "./contracts";

const scopes = ["profile-contact", "device-diagnostics"] as const;

describe("access contracts", () => {
  test("normalizes bounded list queries", () => {
    expect(accessRequestsQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(() => accessRequestsQuerySchema.parse({ pageSize: 500 })).toThrow();
    expect(() => accessRequestsQuerySchema.parse({ unexpected: true })).toThrow();
  });

  test("requires masked, unique, time-bounded requests", () => {
    const parsed = createAccessRequestSchema.parse({
      userId: "USR-10482",
      supportTicketId: "TKT-12001",
      assignee: "ADM-DEMO-SUPPORT",
      reason: "مراجعة مشكلة موثقة في التذكرة",
      requestedScope: scopes,
      maskingRequired: true,
      customerApprovalRequired: false,
    });
    expect(parsed.durationMinutes).toBe(30);
    expect(() => createAccessRequestSchema.parse({ ...parsed, requestedScope: [scopes[0], scopes[0]] })).toThrow();
    expect(() => createAccessRequestSchema.parse({ ...parsed, maskingRequired: false })).toThrow();
    expect(() => createAccessRequestSchema.parse({ ...parsed, unexpected: true })).toThrow();
  });

  test("approval cannot widen scope or duration", () => {
    const decision = accessDecisionRequestSchema({
      requestedScope: [...scopes],
      requestedDurationMinutes: 30,
      requestedBy: "ADM-DEMO-SUPPORT",
      actor: "ADM-DEMO-SECURITY",
      now: new Date("2026-07-28T09:59:30+03:00"),
    });
    expect(decision.parse({
      decision: "approve",
      reason: "تمت المراجعة",
      approvedScope: ["profile-contact"],
      durationMinutes: 15,
      startsAt: "2026-07-28T10:00:00+03:00",
    }).approvedScope).toEqual(["profile-contact"]);
    expect(() => decision.parse({
      decision: "approve",
      reason: "تمت المراجعة",
      approvedScope: ["subscription-summary"],
      durationMinutes: 30,
      startsAt: "2026-07-28T10:00:00+03:00",
    })).toThrow();
    expect(() => decision.parse({
      decision: "approve",
      reason: "تمت المراجعة",
      approvedScope: ["profile-contact"],
      durationMinutes: 15,
      startsAt: "2026-07-28T09:00:00+03:00",
    })).toThrow();
  });

  test("enforces requester and terminal transition rules", () => {
    expect(() => accessDecisionRequestSchema({
      requestedScope: [...scopes],
      requestedDurationMinutes: 30,
      requestedBy: "ADM-DEMO-SUPPORT",
      actor: "ADM-DEMO-SUPPORT",
    }).parse({
      decision: "reject",
      reason: "لا يمكن قبول الطلب",
    })).toThrow();
    expect(canTransitionAccess("pending", "approved")).toBe(true);
    expect(canTransitionAccess("rejected", "approved")).toBe(false);
  });

  test("rejects unordered timelines and workspace scope leakage", () => {
    const detail = {
      id: "ACC-1001",
      userId: "USR-10482",
      maskedCustomerLabel: "ن***@example.test",
      supportTicketId: "TKT-12001",
      requestedBy: "ADM-DEMO-SUPPORT",
      assignee: "ADM-DEMO-SUPPORT",
      requestedScope: [...scopes],
      approvedScope: null,
      reasonSummary: "مراجعة مشكلة موثقة",
      status: "pending",
      createdAt: "2026-07-28T09:00:00+03:00",
      startsAt: null,
      expiresAt: null,
      approvedBy: null,
      ticketSummary: "مشكلة مزامنة تجريبية",
      customerSummary: {
        userId: "USR-10482",
        displayName: "عميلة تجريبية",
        maskedEmail: "n***@example.test",
        status: "active",
        primaryPlatform: "ios",
        registeredPlatforms: ["ios"],
        risk: "low",
      },
      reason: "مراجعة مشكلة موثقة في التذكرة",
      requestedDurationMinutes: 30,
      approvedDurationMinutes: null,
      maskingRules: ["البيانات الحساسة مخفية"],
      customerApprovalRequired: false,
      customerApprovalState: "not-required",
      timeline: [
        { id: "ATL-2", event: "created", actor: "ADM-DEMO-SUPPORT", occurredAt: "2026-07-28T10:00:00+03:00", summary: "أحدث", auditReference: "AUD-2" },
        { id: "ATL-1", event: "created", actor: "ADM-DEMO-SUPPORT", occurredAt: "2026-07-28T09:00:00+03:00", summary: "أقدم", auditReference: "AUD-1" },
      ],
      region: { availability: "available" },
    };
    expect(() => accessRequestDetailSchema.parse(detail)).toThrow();

    const workspace = {
      requestId: "ACC-1001",
      supportTicketId: "TKT-12001",
      assignee: "ADM-DEMO-SUPPORT",
      status: "active",
      approvedScope: ["profile-contact"],
      startsAt: "2026-07-28T09:00:00+03:00",
      expiresAt: "2099-07-28T10:00:00+03:00",
      accessNotice: "وصول مؤقت ومراقب",
      auditIndicator: "AUD-ENTRY-1",
      sections: [
        { scope: "device-diagnostics", title: "الأجهزة", fields: [{ label: "الحالة", value: "نشط", classification: "status" }] },
      ],
      region: { availability: "available" },
    };
    expect(() => temporaryWorkspaceSchema.parse(workspace)).toThrow();
    expect(() => accessRequestDetailSchema.parse({ ...detail, unexpected: true, timeline: detail.timeline.slice(0, 1) })).toThrow();
  });
});
