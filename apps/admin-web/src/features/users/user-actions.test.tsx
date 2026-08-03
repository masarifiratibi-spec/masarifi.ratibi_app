import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { UserActions, UserBulkActions } from "./UserActions";

const roots: Root[] = [];

HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
  this.open = false;
};

async function renderAction(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      {node}
    </QueryClientProvider>,
  ));
  return host;
}

function click(element: Element | null) {
  if (!(element instanceof HTMLElement)) throw new Error("Missing action element");
  act(() => element.click());
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => act(async () => root.unmount())));
});

describe("UserActions", () => {
  test("shows permission-aware launchers and a scoped confirmation form", async () => {
    const host = await renderAction(<UserActions
      user={{ id: "USR-10482", status: "active", verification: "verified" }}
      devices={[]}
      sessions={[]}
      role="support-agent"
    />);
    expect(host.textContent).toContain("تعليق الحساب");
    expect(host.textContent).not.toContain("إلغاء جهاز");
    click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("تعليق")) ?? null);
    expect(host.textContent).toContain("سبب الإجراء");
    expect(host.textContent).toContain("users.status.manage");
    expect(host.textContent).toContain("حدث التدقيق");
  });

  test("keeps bulk scope to selected IDs and exposes clear selection", async () => {
    let cleared = false;
    const host = await renderAction(<UserBulkActions
      selectedUsers={[
        { id: "USR-10482", status: "active" },
        { id: "USR-10443", status: "suspended" },
      ]}
      role="super-admin"
      onClear={() => { cleared = true; }}
      onComplete={() => undefined}
    />);
    expect(host.textContent).toContain("2");
    expect(host.textContent).toContain("1 مؤهل");
    click([...host.querySelectorAll("button")].find((button) => button.textContent?.includes("مسح")) ?? null);
    expect(cleared).toBe(true);
  });
});
