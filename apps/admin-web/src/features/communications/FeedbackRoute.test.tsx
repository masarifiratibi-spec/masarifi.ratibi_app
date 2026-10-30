import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/core/localization/provider";
import { FeedbackRoute } from "./CommunicationRoutes";
import { useFeedback } from "./hooks";

vi.mock("./hooks", () => ({
  useFeedback: vi.fn(() => ({
    data: { items: [], region: { availability: "empty" } },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));
vi.mock("@/components/admin/ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  RegionState: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

let root: Root;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  document.body.replaceChildren();
});

test.each(["ar", "en"] as const)("offers only feedback states in %s", async (locale) => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(
    <LocaleProvider locale={locale} setLocale={() => undefined}><FeedbackRoute /></LocaleProvider>,
  ));
  const status = host.querySelector("select")!;
  expect([...status.options].map((option) => option.value)).toEqual([
    "", "new", "reviewing", "planned", "resolved", "closed",
  ]);
  expect([...status.options].map((option) => option.text)).toContain(locale === "ar" ? "مخطط لها" : "Planned");
  expect(host.querySelectorAll("select")).toHaveLength(1);
  await act(async () => {
    status.value = "reviewing";
    status.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(vi.mocked(useFeedback).mock.lastCall?.[0]).toMatchObject({ status: "reviewing" });
  expect(status.value).toBe("reviewing");
  await act(async () => {
    status.value = "";
    status.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(vi.mocked(useFeedback).mock.lastCall?.[0].status).toBe("");
});
