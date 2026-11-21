import { describe, expect, test } from "vitest";
import { communicationsRepository } from "@/features/communications/repository";

const base = "/api/v1/admin";

describe("communications MSW handlers", () => {
  test("serves the current support overview and ticket contracts through the live client", async () => {
    const overview = await communicationsRepository.getSupportOverview({});
    expect(overview.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "total", value: 1 }),
      expect.objectContaining({ key: "waiting_support", value: 1 }),
    ]));
    const list = await communicationsRepository.getSupportTickets({ page: 1, pageSize: "25" });
    expect(list.pagination.totalItems).toBe(1);
    const item = list.tickets[0];
    if (!item) throw new Error("Expected the synthetic support ticket");
    expect(item).toMatchObject({ assignedAdminId: null, customerReference: "CUS-0000000000000001" });
    const detail = await communicationsRepository.getSupportTicket(item.id);
    expect(detail.messages).toHaveLength(1);
    expect(detail.internalNotes).toHaveLength(1);
    const result = await communicationsRepository.actOnSupportTicket(item.id, {
      action: "resolve", expectedVersion: detail.revision, reason: "Resolved after reviewing the conversation",
    });
    expect(result.currentState).toBe("resolved");
    expect((await communicationsRepository.getSupportTicket(item.id)).state).toBe("resolved");
    expect((await communicationsRepository.getSupportOverview({})).metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "resolved", value: 1 }),
      expect.objectContaining({ key: "waiting_support", value: 0 }),
    ]));
  });

  test("returns exact resources, persists supported actions, and rejects unknown actions", async () => {
    const listResponse = await fetch(`${base}/notifications/campaigns`);
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    expect(list).toEqual({
      items: [
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          state: "draft",
          version: 1,
        }),
      ],
      nextCursor: null,
      hasMore: false,
    });

    const campaignId = list.items[0].id;
    const actionResponse = await fetch(
      `${base}/notifications/campaigns/${campaignId}/actions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          expectedVersion: 1,
          reason: "Approved for bounded cohort",
        }),
      },
    );
    expect(actionResponse.status).toBe(200);
    expect(await actionResponse.json()).toEqual({
      resourceId: campaignId,
      outcome: "success",
      currentState: "approved",
      version: 2,
      requestId: expect.stringMatching(/^mock-/),
    });

    const detailResponse = await fetch(
      `${base}/notifications/campaigns/${campaignId}`,
    );
    expect(await detailResponse.json()).toEqual(
      expect.objectContaining({
        id: campaignId,
        state: "approved",
        version: 2,
      }),
    );

    const unknownResponse = await fetch(
      `${base}/notifications/campaigns/${campaignId}/actions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "launch_everything",
          expectedVersion: 2,
          reason: "Unsupported operation must fail",
        }),
      },
    );
    expect(unknownResponse.status).toBe(400);
    expect(await unknownResponse.json()).toEqual({
      code: "VALIDATION_FAILED",
      message: "Request validation failed",
      requestId: expect.stringMatching(/^mock-/),
    });

    const contentResponse = await fetch(`${base}/content/CAT-1001`);
    expect(contentResponse.status).toBe(200);
    expect(await contentResponse.json()).toEqual(
      expect.objectContaining({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
    );

    const templateResponse = await fetch(`${base}/communications/templates`);
    const templates = await templateResponse.json();
    expect(templates.items[0].safe).not.toHaveProperty("variables");
  });
});
