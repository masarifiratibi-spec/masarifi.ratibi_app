import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { delay, http, HttpResponse } from "msw";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { mockServer } from "@/mocks/server";
import { UserDetailView } from "./UserDetailView";

const roots: Root[] = [];

async function renderDetail(wrapperDirection?: "ltr") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div");
  if (wrapperDirection) host.dir = wrapperDirection;
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <UserDetailView userId="USR-10482" />
      </QueryClientProvider>,
    );
  });
  return host;
}

async function waitForText(host: HTMLElement, text: string) {
  const startedAt = Date.now();
  while (!host.textContent?.includes(text)) {
    if (Date.now() - startedAt > 1_500) throw new Error(`Timed out waiting for ${text}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => act(async () => root.unmount())));
});

describe("UserDetailView", () => {
  test("renders a masked aggregate-only overview", async () => {
    const host = await renderDetail();
    await waitForText(host, "n***@example.test");
    expect(host.textContent).toContain("24");
    expect(host.textContent).toContain("مخاطر منخفضة");
    expect(host.textContent).not.toContain("noura@example.test");
    expect(host.textContent).not.toMatch(/balance|merchant|salary|transaction row|raw ip|token|fingerprint/i);
  });

  test("renders applicable and not-applicable device capabilities with additive counts", async () => {
    const host = await renderDetail();
    await waitForText(host, "iPhone رئيسي");
    expect(host.textContent).toContain("iOS 2 + Android 0");
    expect(host.textContent).toContain("غير منطبق");
  });

  test("renders sanitized session semantics and the current-session warning", async () => {
    const host = await renderDetail();
    await waitForText(host, "الرياض، السعودية");
    expect(host.textContent).toContain("الجلسة الحالية المرئية للمسؤول");
    expect(host.textContent).toContain("نشطة");
  });

  test("keeps forbidden and empty regions independent from the profile", async () => {
    mockServer.use(
      http.get("/api/v1/admin/users/USR-10482/devices", () => (
        HttpResponse.json({ code: "forbidden" }, { status: 403 })
      )),
      http.get("/api/v1/admin/users/USR-10482/sessions", () => HttpResponse.json({
        items: [],
        activeCount: 0,
        expiredCount: 0,
        revokedCount: 0,
        region: { availability: "empty", message: "لا توجد جلسات." },
      })),
    );
    const host = await renderDetail();
    await waitForText(host, "devices.read");
    expect(host.textContent).toContain("n***@example.test");
    expect(host.textContent).toContain("لا توجد جلسات");
  });

  test("renders loading and unavailable states without replacing a successful sibling", async () => {
    mockServer.use(
      http.get("/api/v1/admin/users/USR-10482/sessions", async () => {
        await delay(50);
        return (
        HttpResponse.json({ code: "provider_unavailable" }, { status: 503 })
        );
      }),
    );
    const host = await renderDetail();
    expect(host.textContent).toContain("جارٍ تحميل البيانات");
    await waitForText(host, "تعذر تحميل البيانات");
    expect(host.textContent).toContain("iPhone رئيسي");
  });

  test("keeps masked directional content safe in an LTR container", async () => {
    const host = await renderDetail("ltr");
    await waitForText(host, "n***@example.test");
    expect(host.dir).toBe("ltr");
    expect(host.querySelector("bdi")?.textContent).toBe("n***@example.test");
  });
});
