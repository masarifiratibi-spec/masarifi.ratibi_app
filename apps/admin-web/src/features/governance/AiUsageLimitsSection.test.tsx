import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { adminSessionFixture } from "@/mocks/fixtures/foundation";
import { aiUsageKeys, type AiUsage } from "./ai-usage";
import { AiUsageLimitsSection } from "./AiUsageLimitsSection";
import { LocaleProvider } from "@/core/localization/provider";

let root: Root;
const response = (): AiUsage => ({
  userId: "sample-user", directReadsConsumeQuota: false, projectEstimatedCostUsd: 0.1,
  monthlyProjectResetsAt: "2026-11-01T00:00:00Z", history: [],
  settings: aiUsageKeys.map(key => ({ key, version: 2, value: key.endsWith("enabled") ? true : key.endsWith("override") ? {} : key.endsWith("monthly_limit") ? null : key.endsWith("budget") ? 2 : 15 })),
  features: (["chat", "voice"] as const).map(feature => ({ feature, limit: 15, monthlyLimit: null, enabled: true, routeEnabled: true,
    override: { rollingLimit: null, monthlyLimit: null }, used: 2, remaining: 13, resetsAt: "2026-10-09T12:00:00Z", windowHours: 24,
    monthlyUsed: 3, monthlyRemaining: null, monthlyResetsAt: "2026-11-01T00:00:00Z", estimatedCostUsd: 0.05 })),
});
async function render(permissions = ["operations.settings.read", "operations.settings.manage", "ai.routes.manage"], locale: "ar" | "en" = "ar", data = response()) {
  mockServer.use(
    http.get("/api/v1/admin/access/me", () => HttpResponse.json({ ...adminSessionFixture, effectivePermissionKeys: permissions })),
    http.get("/api/v1/admin/ai/usage-limits", () => HttpResponse.json(data)),
  );
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<LocaleProvider locale={locale} setLocale={() => undefined}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AiUsageLimitsSection /></QueryClientProvider></LocaleProvider>); });
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

test("distinguishes a disabled Voice policy from an available provider route in English", async () => {
  const data = response();
  data.features[1].enabled = false;
  data.settings.find(setting => setting.key === "ai.voice.enabled")!.value = false;
  data.features[1].limit = 30;
  data.features[1].remaining = 28;
  const host = await render(undefined, "en", data);
  const voice = host.querySelector('section[aria-label="Voice AI"]')!;
  expect(voice).not.toBeNull();
  expect(voice.textContent).toContain("Disabled");
  expect(voice.textContent).toContain("Available");
  expect(voice.querySelector('[data-quota="limit"]')?.textContent).toBe("30");
  expect(voice.querySelector('[data-quota="remaining"]')?.textContent).toBe("28");
  expect(host.querySelector('section[aria-label="Assistant Chat AI"]')?.textContent).toContain("Enabled");
  expect(host.querySelector('time')?.getAttribute("dateTime")).toBe("2026-10-09T12:00:00Z");
  expect(host.querySelector('time')?.textContent).toContain("UTC");
});

test("keeps exact audit values and timestamps accessible behind Arabic disclosure", async () => {
  const data = response();
  data.history.push({ id: "audit-sample", key: "ai.chat.rolling_limit", actorId: "sample-admin-with-a-long-identity", at: "2026-10-08T12:00:00Z", reason: "Independent Chat update", before: "15", after: "16" });
  const host = await render(undefined, "ar", data);
  expect(host.querySelector("h1")?.textContent).toBe("حدود استخدام الذكاء الاصطناعي");
  const history = host.querySelector('section[aria-label="سجل تغييرات الحدود"]')!;
  const disclosure = history.querySelector("details")!;
  expect(disclosure.open).toBe(false);
  expect(disclosure.querySelector("summary")?.textContent).toBe("عرض تفاصيل التغيير");
  expect(history.querySelector("time")?.getAttribute("title")).toBe("2026-10-08T12:00:00Z");
  await act(async () => { disclosure.open = true; });
  expect(disclosure.textContent).toContain("sample-admin-with-a-long-identity");
  expect(Array.from(disclosure.querySelectorAll("pre")).map(item => item.textContent)).toEqual(["15", "16"]);
});

test("explains inherited monthly overrides and sends only the Voice override contract", async () => {
  const bodies: unknown[] = [];
  mockServer.use(http.patch("/api/v1/admin/settings/ai.voice.user_override", async ({ request }) => {
    bodies.push(await request.json());
    return HttpResponse.json({ resourceId: "ai.voice.user_override", status: "updated", version: 3 });
  }));
  const host = await render(undefined, "en");
  const form = host.querySelector('form[data-setting="ai.voice.user_override"]')!;
  expect(form.textContent).toContain("Monthly override (blank = inherit)");
  const input = form.querySelector('input[type="number"]') as HTMLInputElement;
  const reason = form.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "30"); input.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(reason, "Independent Voice override acceptance"); reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 150));
  });
  expect(bodies).toEqual([{ value: { userId: "sample-user", rollingLimit: 30, monthlyLimit: null }, expectedVersion: 2, reason: "Independent Voice override acceptance" }]);
  expect(host.querySelector('form[data-setting="ai.chat.user_override"] input')?.getAttribute("value")).toBe("");
});
