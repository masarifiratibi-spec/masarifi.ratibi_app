import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DeletionPage } from "./DeletionPage";
const fixture = vi.hoisted(() => ({
  listeners: [] as Array<() => void>,
  clerk: {
    user: { id: "owner" } as { id: string } | null,
    session: { id: "session", getToken: vi.fn(async () => "token") } as {
      id: string;
      getToken: () => Promise<string>;
    } | null,
    addListener: (listener: () => void) => {
      fixture.listeners.push(listener);
      return () => {
        fixture.listeners = fixture.listeners.filter(
          (value) => value !== listener,
        );
      };
    },
  },
}));
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => fixture.clerk,
  useReverification: (fn: unknown) => fn,
  SignIn: () => <div>Sign in form</div>,
}));
let root: Root;
let element: HTMLDivElement;
async function mount() {
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
  await act(async () => root.render(<DeletionPage enabled />));
  await click("English");
}
const button = (text: string) =>
  Array.from(element.querySelectorAll("button")).find(
    (button) => button.textContent === text,
  )!;
async function click(text: string) {
  await act(async () => button(text).click());
}
async function confirm() {
  await act(async () =>
    element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(),
  );
}
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  sessionStorage.clear();
  fixture.listeners = [];
  fixture.clerk.user = { id: "owner" };
  fixture.clerk.session = {
    id: "session",
    getToken: vi.fn(async () => "token"),
  };
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("keeps one attempt through a failed submission and prevents double submission", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          id,
          status: "verified",
          coolingOffEndsAt: "2099-10-25T00:00:00.000Z",
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await mount();
  await confirm();
  const submit = button("Request account deletion");
  await act(async () => {
    submit.click();
    submit.click();
  });
  expect(element.querySelector('[role="alert"]')).not.toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await click("Request account deletion");
  expect(element.textContent).toContain(
    "Request status: Waiting period in progress",
  );
  expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
    fetcher.mock.calls[1][1].headers["Idempotency-Key"],
  );
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  expect(button("Cancel deletion request").disabled).toBe(false);
});
it("can refresh the scoped completion receipt after deletion revokes sign-in", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id, status: "processing" })),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id,
          status: "completed",
          completedAt: "2026-10-24T12:00:00.000Z",
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await mount();
  await confirm();
  await click("Request account deletion");
  expect(element.textContent).toContain("Request status: Deletion in progress");
  await act(async () => {
    fixture.clerk.user = null;
    fixture.clerk.session = null;
    fixture.listeners.forEach((listener) => listener());
  });
  await click("Refresh status");
  expect(element.textContent).toContain(
    "Request status: Deletion processing completed",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toContain("/privacy/deletion-completions/");
  expect(fetcher.mock.calls[1][1].headers.Authorization).toMatch(
    /^Bearer [a-f0-9]{64}$/,
  );
  expect(element.querySelector('input[type="checkbox"]')).toBeNull();
});
