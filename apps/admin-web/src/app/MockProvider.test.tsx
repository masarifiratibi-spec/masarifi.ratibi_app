import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, expect, test, vi } from "vitest";
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterAll(() => vi.unstubAllGlobals());
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

test("offers a page reload after import failure and boots on a fresh load", async () => {
  vi.resetModules();
  vi.doMock("@/mocks/browser", () => {
    throw new Error("private import details");
  });
  const { MockProvider: Provider } = await import("./MockProvider");
  const element = document.createElement("div");
  const root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <Provider>
          <main>Application ready</main>
        </Provider>,
      ),
    );
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).not.toContain("private import details");
    expect(element.querySelector("a")?.getAttribute("href")).toBe("");
    vi.doMock("@/mocks/browser", () => ({ mockWorker: worker }));
    vi.resetModules();
    const { MockProvider: Reloaded } = await import("./MockProvider");
    worker.start.mockResolvedValueOnce(undefined);
    await act(async () =>
      root.render(
        <Reloaded>
          <main>Application ready</main>
        </Reloaded>,
      ),
    );
    expect(element.querySelector("main")?.textContent).toBe(
      "Application ready",
    );
  } finally {
    await act(async () => root.unmount());
  }
});

test("renders production content without importing or initializing mocks", async () => {
  vi.resetModules();
  vi.doMock("@/core/config/runtime", () => ({ mocksEnabled: () => false }));
  const load = vi.fn(() => {
    throw new Error("production must not import MSW");
  });
  vi.doMock("@/mocks/browser", load);
  const { MockProvider: Provider } = await import("./MockProvider");
  const element = document.createElement("div");
  const root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <Provider>
          <main>Production content</main>
        </Provider>,
      ),
    );
    expect(element.querySelector("main")?.textContent).toBe(
      "Production content",
    );
    expect(load).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
  }
});
