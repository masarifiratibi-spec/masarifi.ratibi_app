import { describe, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { aiUsageRepository, quotaValue } from "./ai-usage";

describe("governed AI quota editor", () => {
  test.each(["chat", "voice"] as const)("updates only %s through the governed settings endpoint", async feature => {
    let request: unknown;
    mockServer.use(http.patch(`/api/v1/admin/settings/ai.${feature}.rolling_limit`, async ({ request: incoming }) => {
      request = await incoming.json();
      expect(incoming.headers.get("Idempotency-Key")).toBeTruthy();
      return HttpResponse.json({ resourceId: `ai.${feature}.rolling_limit`, status: "updated", version: 3 });
    }));
    await aiUsageRepository.update(`ai.${feature}.rolling_limit`, 15, 2, "Quota acceptance change");
    expect(request).toEqual({ value: 15, expectedVersion: 2, reason: "Quota acceptance change" });
  });
  test.each(["0", "1001", "1.5", "-1", "NaN", "1e2", ""])("rejects invalid daily value %s", value => {
    expect(() => quotaValue(value, false)).toThrow();
  });
  test("monthly blank inherits no cap and valid limits remain numeric", () => {
    expect(quotaValue("", true)).toBeNull();
    expect(quotaValue("1000000", true)).toBe(1000000);
    expect(quotaValue("15", false)).toBe(15);
  });
  test.each([409, 403])("surfaces governed rejection %s without a second write", async status => {
    let calls = 0;
    mockServer.use(http.patch("/api/v1/admin/settings/ai.chat.rolling_limit", () => {
      calls++;
      return HttpResponse.json({ code: status === 409 ? "VERSION_CONFLICT" : "RECENT_AUTH_REQUIRED" }, { status });
    }));
    await expect(aiUsageRepository.update("ai.chat.rolling_limit", 15, 1, "Quota acceptance change")).rejects.toMatchObject({ status, code: status === 409 ? "conflict" : "recent_auth_required" });
    expect(calls).toBe(1);
  });
});
