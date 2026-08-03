import { beforeEach, describe, expect, test } from "vitest";
import {
  createPhase2AccessRequest,
  decidePhase2AccessRequest,
  getPhase2TemporaryWorkspace,
  getPhase2AccessRequests,
  resetPhase2MockState,
  setPhase2NearExpiry,
  getPhase2MockState,
  suspendPhase2User,
  revokePhase2Sessions,
  runPhase2BulkAction,
} from "./phase2-state";
import { supportTickets } from "./fixtures/access";

describe("phase 2 access state", () => {
  beforeEach(resetPhase2MockState);

  test("reset restores a deep clone", () => {
    const requests = getPhase2AccessRequests();
    requests[0].reason = "changed";
    expect(getPhase2AccessRequests()[0].reason).not.toBe("changed");
    const active = requests.find((request) => request.status === "active");
    expect(active?.startsAt && active.expiresAt
      ? new Date(active.expiresAt).getTime() - new Date(active.startsAt).getTime()
      : 0).toBe(active?.approvedDurationMinutes ? active.approvedDurationMinutes * 60_000 : 0);
  });

  test("blocks overlapping duplicate access", () => {
    expect(() => createPhase2AccessRequest({
      userId: "USR-10482",
      supportTicketId: "TKT-12001",
      assignee: "ADM-DEMO-SUPPORT",
      reason: "طلب دعم موثق محدود النطاق",
      requestedScope: ["profile-contact"],
      maskingRequired: true,
      durationMinutes: 30,
      customerApprovalRequired: false,
    }, "ADM-DEMO-SUPPORT")).toThrowError(expect.objectContaining({ code: "conflict" }));
  });

  test("separates requester from approver and appends timeline", () => {
    const startsAt = new Date(Date.now() + 60_000).toISOString();
    expect(() => decidePhase2AccessRequest("ACC-1001", {
      decision: "approve",
      reason: "تمت مراجعة الطلب",
      approvedScope: ["profile-contact"],
      durationMinutes: 15,
      startsAt,
    }, "ADM-DEMO-SUPPORT")).toThrowError(expect.objectContaining({ code: "forbidden" }));

    const approved = decidePhase2AccessRequest("ACC-1001", {
      decision: "approve",
      reason: "تمت مراجعة الطلب",
      approvedScope: ["profile-contact"],
      durationMinutes: 15,
      startsAt,
    }, "ADM-DEMO-SECURITY");
    expect(approved.status).toBe("approved");
    expect(approved.timeline.at(-1)?.event).toBe("approved");
  });

  test("rechecks ticket linkage and expires the near-expiry workspace", () => {
    const ticketIndex = supportTickets.findIndex((ticket) => ticket.id === "TKT-12003");
    const [ticket] = supportTickets.splice(ticketIndex, 1);
    try {
      expect(() => getPhase2TemporaryWorkspace("ACC-1003", "ADM-DEMO-SUPPORT"))
        .toThrowError(expect.objectContaining({ code: "not_found" }));
    } finally {
      supportTickets.splice(ticketIndex, 0, ticket);
    }

    const expiresAt = new Date(Date.now() + 50).toISOString();
    setPhase2NearExpiry("ACC-1003", expiresAt);
    expect(() => getPhase2TemporaryWorkspace(
      "ACC-1003",
      "ADM-DEMO-SUPPORT",
      new Date(new Date(expiresAt).getTime() + 1),
    )).toThrowError(expect.objectContaining({ code: "gone" }));
    expect(getPhase2AccessRequests().find((request) => request.id === "ACC-1003")?.status).toBe("expired");
  });
});

describe("phase 2 customer state", () => {
  beforeEach(resetPhase2MockState);

  test("returns clone-isolated users, devices, and sessions and resets mutations", () => {
    const state = getPhase2MockState();
    state.users[0].status = "suspended";
    expect(getPhase2MockState().users[0].status).toBe("active");
    suspendPhase2User("USR-10482", {
      reason: "مراجعة أمنية", durationDays: 2, internalNote: "", notifyUser: false,
    });
    expect(getPhase2MockState().users[0].status).toBe("suspended");
    resetPhase2MockState();
    expect(getPhase2MockState().users[0].status).toBe("active");
  });

  test("rejects stale transitions and reports partial session revocation", () => {
    expect(() => suspendPhase2User("USR-10443", {
      reason: "مراجعة أمنية", durationDays: 2, internalNote: "", notifyUser: false,
    })).toThrowError(expect.objectContaining({ code: "conflict" }));
    expect(revokePhase2Sessions("USR-10482", {
      scope: "selected", sessionIds: ["SES-10482-A", "SES-10482-B"], reason: "إنهاء جلسات",
    })).toMatchObject({ outcome: "partial", affectedCount: 1 });
  });

  test("bulk actions affect only explicit IDs and return safe partial failures", () => {
    const result = runPhase2BulkAction({
      action: "suspend",
      userIds: ["USR-10482", "USR-10443"],
      reason: "مراجعة جماعية",
      durationDays: 2,
    });
    expect(result).toMatchObject({ requestedCount: 2, eligibleCount: 1, succeededCount: 1, failedCount: 1 });
    expect(result.failures).toEqual([
      { userId: "USR-10443", code: "ineligible_state", message: "الحالة الحالية غير مؤهلة لهذا الإجراء." },
    ]);
    expect(getPhase2MockState().users.find(({ id }) => id === "USR-10479")?.status).toBe("active");
  });
});
