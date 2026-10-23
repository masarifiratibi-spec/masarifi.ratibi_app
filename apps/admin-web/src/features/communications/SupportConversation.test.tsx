import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { SupportConversation } from "./SupportConversation";
import type { CommunicationDetail } from "./contracts";

vi.mock("@/core/localization/provider", () => ({
  useLocale: () => ({ locale: "en" }),
}));
const item: CommunicationDetail = {
  id: "ticket-1",
  title: "Need help",
  state: "waiting_support",
  revision: 3,
  platform: "unknown",
  locale: "unknown",
  updatedAt: null,
  tags: [],
  body: "Customer question",
  notes: [],
  auditTrail: [],
  attachments: [],
  customerReference: "CUS-0123456789abcdef",
  assignedAdminId: "admin-1",
  hasMoreMessages: true,
  nextMessageCursor: "next",
  messages: [
    {
      id: "message-1",
      senderType: "customer",
      body: "Customer question",
      createdAt: "2026-10-23T00:00:00Z",
      attachments: [
        {
          id: "clean",
          filename: "evidence.pdf",
          mediaType: "application/pdf",
          declaredSizeBytes: 10,
          status: "clean",
        },
        {
          id: "unsafe",
          filename: "unsafe.pdf",
          mediaType: "application/pdf",
          declaredSizeBytes: 10,
          status: "rejected",
        },
      ],
    },
  ],
  internalNotes: [
    {
      id: "note",
      body: "Private staff note",
      createdAt: "2026-10-23T00:00:00Z",
    },
  ],
};
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  document.body.replaceChildren();
});

test("shows the conversation, staff notes, safe identity, paging and clean-only download", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const loadMore = vi.fn();
  const download = vi.fn();
  await act(async () =>
    root.render(
      <SupportConversation
        item={item}
        onAction={async () => undefined}
        pending={false}
        canAct={() => true}
        onLoadMore={loadMore}
        onDownload={download}
      />,
    ),
  );
  expect(host.textContent).toContain("Customer question");
  expect(host.textContent).toContain("Private staff note");
  expect(host.textContent).toContain("CUS-0123456789abcdef");
  const buttons = [...host.querySelectorAll("button")];
  await act(async () =>
    buttons
      .find((button) => button.textContent === "Load more messages")
      ?.click(),
  );
  expect(loadMore).toHaveBeenCalledOnce();
  expect(
    buttons.filter((button) => button.textContent?.includes("Download")),
  ).toHaveLength(1);
  expect(host.querySelector('option[value="assign"]')).toBeTruthy();
  expect(host.querySelector('option[value="note"]')).toBeTruthy();
});

test("keeps the draft after a conflict and exposes a refresh action", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const action = vi.fn().mockRejectedValue(new Error("conflict"));
  const refresh = vi.fn();
  await act(async () =>
    root.render(
      <SupportConversation
        item={item}
        onAction={action}
        pending={false}
        canAct={() => true}
        onLoadMore={vi.fn()}
        onDownload={vi.fn()}
        onRefresh={refresh}
      />,
    ),
  );
  const setValue = (
    input: HTMLTextAreaElement | HTMLInputElement,
    value: string,
  ) => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input),
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  await act(async () => {
    setValue(
      host.querySelector('textarea[name="message"]')!,
      "Keep this draft",
    );
    setValue(
      host.querySelector('textarea[name="reason"]')!,
      "Customer needs follow up",
    );
  });
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(action).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "reply",
      expectedVersion: 3,
      message: "Keep this draft",
    }),
  );
  expect(
    (host.querySelector('textarea[name="message"]') as HTMLTextAreaElement)
      .value,
  ).toBe("Keep this draft");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("draft");
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Refresh ticket")
      ?.click(),
  );
  expect(refresh).toHaveBeenCalledOnce();
});
