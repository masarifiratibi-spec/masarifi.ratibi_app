import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { DateRangeControl } from "./DateRangeControl";

let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  document.body.replaceChildren();
});
test("opens controlled custom dates before the parent changes the reporting period", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onChange = vi.fn();
  await act(async () =>
    root.render(
      <DateRangeControl
        value={{ start: "2026-10-01", end: "2026-10-23", preset: "30d" }}
        onChange={onChange}
      />,
    ),
  );
  const custom = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("مخصص"),
  );
  expect(custom).toBeTruthy();
  await act(async () => custom?.click());
  expect(host.querySelectorAll('input[type="date"]')).toHaveLength(2);
  expect(custom?.getAttribute("aria-pressed")).toBe("true");
  expect(onChange).not.toHaveBeenCalled();
});
