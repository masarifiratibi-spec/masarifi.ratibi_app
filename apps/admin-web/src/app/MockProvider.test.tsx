import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { MockProvider } from "./MockProvider";

const worker = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@/core/config/runtime", () => ({ mocksEnabled: () => true }));
vi.mock("@/mocks/browser", () => ({ mockWorker: worker }));

test("recovers from failed mock startup without exposing the error or trapping the page", async () => {
  worker.start.mockRejectedValueOnce(new Error("private bootstrap details"));
  worker.start.mockResolvedValueOnce(undefined);
  const element = document.createElement("div");
  const root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <MockProvider>
          <main>Application ready</main>
        </MockProvider>,
      ),
    );
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).not.toContain("private bootstrap details");
    expect(element.querySelector("main")).toBeNull();
    await act(async () => element.querySelector("button")?.click());
    expect(element.querySelector("main")?.textContent).toBe(
      "Application ready",
    );
  } finally {
    await act(async () => root.unmount());
  }
});
