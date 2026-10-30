import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { LocaleProvider } from "@/core/localization/provider";
import { CurrentPermissionsProvider } from "@/core/permissions/current-permissions";
import { mockServer } from "@/mocks/server";
import { FeedbackDetailRoute } from "./CommunicationRoutes";

const id = "11000000-0000-4000-8000-000000000001";
let root: Root;
let client: QueryClient;
let host: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  client?.clear();
  host?.remove();
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
});

async function renderDetail(
  locale: "ar" | "en",
  manage = true,
  reject = false,
) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const item = {
    id,
    type: "other",
    subject: "Synthetic feedback",
    body: "No private data",
    status: "new",
    version: 1,
    createdAt: "2026-10-30T00:00:00Z",
  };
  const calls: Record<string, unknown>[] = [];
  mockServer.use(
    http.get(`/api/v1/admin/feedback/${id}`, () => {
      const { status, ...fields } = item;
      return HttpResponse.json({
        ...fields,
        state: status,
        updatedAt: item.createdAt,
      });
    }),
    http.post(`/api/v1/admin/feedback/${id}/actions`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push(body);
      if (reject)
        return HttpResponse.json({ code: "FORBIDDEN" }, { status: 403 });
      expect(body.expectedVersion).toBe(item.version);
      item.status = (
        {
          review: "reviewing",
          plan: "planned",
          resolve: "resolved",
          close: "closed",
        } as Record<string, string>
      )[String(body.action)];
      item.version += 1;
      return HttpResponse.json({
        resourceId: id,
        outcome: "success",
        currentState: item.status,
        version: item.version,
        requestId: "feedback-test",
      });
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () =>
    root.render(
      <LocaleProvider locale={locale} setLocale={() => undefined}>
        <CurrentPermissionsProvider
          permissions={
            new Set(["feedback.read", ...(manage ? ["feedback.manage"] : [])])
          }
        >
          <QueryClientProvider client={client}>
            <FeedbackDetailRoute feedbackId={id} />
          </QueryClientProvider>
        </CurrentPermissionsProvider>
      </LocaleProvider>,
    ),
  );
  const settled = async (check: () => void) =>
    vi.waitFor(async () => {
      await act(async () => undefined);
      expect(client.isFetching() + client.isMutating()).toBe(0);
      check();
    });
  await settled(() => expect(host.textContent).toContain("Synthetic feedback"));
  return { item, calls, settled };
}

async function setReason() {
  const reason = host.querySelector("textarea")!;
  expect(reason).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(reason, "QA T19a synthetic moderation verification");
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test.each(["ar", "en"] as const)(
  "moderates through all existing feedback states with fresh versions in %s",
  async (locale) => {
    const { item, calls, settled } = await renderDetail(locale);
    const select = host.querySelector("select")!;
    expect(select).not.toBeNull();
    expect([...select.options].map((option) => option.value)).toEqual([
      "review",
      "plan",
      "resolve",
      "close",
    ]);
    const submit = host.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await setReason();
    for (const action of ["review", "plan", "resolve", "close"]) {
      await act(async () => {
        select.value = action;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        host
          .querySelector("form")!
          .dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          );
      });
      await settled(() => expect(calls.at(-1)?.action).toBe(action));
    }
    expect(item.status).toBe("closed");
    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.expectedVersion)).toEqual([1, 2, 3, 4]);
    expect(
      calls.every(
        (call) => call.reason === "QA T19a synthetic moderation verification",
      ),
    ).toBe(true);
  },
);

test("a read-only Admin can inspect feedback without moderation controls", async () => {
  await renderDetail("en", false);
  expect(host.textContent).toContain("No private data");
  expect(host.querySelector("button")).toBeNull();
  expect(host.querySelector("form")).toBeNull();
});

test("a rejected moderation keeps the reason and item available without a success claim", async () => {
  const { item, calls, settled } = await renderDetail("en", true, true);
  await setReason();
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settled(() =>
    expect(host.querySelector('[role="alert"]')).not.toBeNull(),
  );
  expect(item.version).toBe(1);
  expect(item.status).toBe("new");
  expect(calls).toHaveLength(1);
  expect(host.querySelector("textarea")?.value).toBe(
    "QA T19a synthetic moderation verification",
  );
  expect(host.querySelector('[role="status"]')).toBeNull();
});
