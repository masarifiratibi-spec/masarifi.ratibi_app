import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { adminSessionFixture } from "@/mocks/fixtures/foundation";
import { aiUsageKeys } from "./ai-usage";
import { AiUsageLimitsSection } from "./AiUsageLimitsSection";

let root: Root;
const response = () => ({
  userId: "sample-user", directReadsConsumeQuota: false, projectEstimatedCostUsd: 0.1,
  monthlyProjectResetsAt: "2026-11-01T00:00:00Z", history: [],
  settings: aiUsageKeys.map(key => ({ key, version: 2, value: key.endsWith("enabled") ? true : key.endsWith("override") ? {} : key.endsWith("monthly_limit") ? null : key.endsWith("budget") ? 2 : 15 })),
  features: ["chat", "voice"].map(feature => ({ feature, limit: 15, monthlyLimit: null, enabled: true, routeEnabled: true,
    override: { rollingLimit: null, monthlyLimit: null }, used: 2, remaining: 13, resetsAt: "2026-10-09T12:00:00Z", windowHours: 24,
    monthlyUsed: 3, monthlyRemaining: null, monthlyResetsAt: "2026-11-01T00:00:00Z", estimatedCostUsd: 0.05 })),
});
async function render(permissions = ["operations.settings.read", "operations.settings.manage", "ai.routes.manage"]) {
  mockServer.use(
    http.get("/api/v1/admin/access/me", () => HttpResponse.json({ ...adminSessionFixture, effectivePermissionKeys: permissions })),
    http.get("/api/v1/admin/ai/usage-limits", () => HttpResponse.json(response())),
  );
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AiUsageLimitsSection /></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
  return host;
}
afterEach(async () => { if (root) await act(async () => root.unmount()); });
test("shows separate effective quotas and submits a changed Chat limit only once", async () => {
  let writes = 0; let body: unknown;
  mockServer.use(http.patch("/api/v1/admin/settings/ai.chat.rolling_limit", async ({ request }) => {
    writes++; body = await request.json();
    await new Promise(resolve => setTimeout(resolve, 30));
    return HttpResponse.json({ resourceId: "ai.chat.rolling_limit", status: "updated", version: 3 });
  }));
  const host = await render();
  expect(host.textContent).toContain("Assistant Chat AI"); expect(host.textContent).toContain("Voice AI");
  const form = host.querySelector('form[data-setting="ai.chat.rolling_limit"]')!;
  const input = form.querySelector('input[type="number"]') as HTMLInputElement;
  const reason = form.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "16"); input.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(reason, "Independent Chat quota acceptance"); reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 150));
  });
  expect(writes).toBe(1); expect(body).toEqual({ value: 16, expectedVersion: 2, reason: "Independent Chat quota acceptance" });
  expect(host.querySelector('form[data-setting="ai.voice.rolling_limit"] input')?.getAttribute("value")).toBe("15");
  expect(host.querySelector('[role="status"]')?.textContent).toBeTruthy();
});
test("read-only permissions cannot submit a quota change", async () => {
  const host = await render(["operations.settings.read"]);
  const buttons=Array.from(host.querySelectorAll('form[data-setting] button[type="submit"]'));
  expect(buttons).toHaveLength(10);
  expect(buttons.every(button => (button as HTMLButtonElement).disabled)).toBe(true);
});
