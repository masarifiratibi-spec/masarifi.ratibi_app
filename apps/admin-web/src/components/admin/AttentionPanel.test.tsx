import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { AttentionPanel } from "./AttentionPanel";

async function waitForText(text: string) {
  const started = Date.now();
  while (!document.body.textContent?.includes(text)) {
    if (Date.now() - started > 1_000) throw new Error(`Timed out waiting for ${text}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

afterEach(() => {
  document.body.replaceChildren();
  window.sessionStorage.clear();
});

describe("attention panel shell", () => {
  test("keeps the approved notification trigger accessible", () => {
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <AttentionPanel role="super-admin" />
      </QueryClientProvider>,
    );

    expect(html).toContain("aria-label=\"الإشعارات\"");
    expect(html).toContain("aria-expanded=\"false\"");
  });

  test("shows loading, success severity, and permission-filtered links through the real query", async () => {
    const queryClient = new QueryClient();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AttentionPanel defaultOpen role="billing-operator" />
        </QueryClientProvider>,
      );
    });

    expect(document.body.textContent).toContain("جاري التحميل");
    await waitForText("انقطاع تجريبي");
    expect(document.body.textContent).toContain("حرج");
    expect(host.querySelector("aside a")).toBeNull();

    await act(async () => root.unmount());
  });

  test("renders governance and settings events as safe authorized links", async () => {
    const queryClient = new QueryClient();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AttentionPanel defaultOpen role="super-admin" />
        </QueryClientProvider>,
      );
    });

    await waitForText("Admin role governance review requires attention.");
    expect(host.innerHTML).toContain("/admin/admin-team");
    expect(host.innerHTML).toContain("/admin/settings/maintenance");
    expect(host.textContent).not.toMatch(/token|secret|customer id|payload/i);

    await act(async () => root.unmount());
  });

});
