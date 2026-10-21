import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { adminSessionFixture } from "@/mocks/fixtures/foundation";
import { LocaleProvider } from "@/core/localization/provider";
import { SocialMediaSection } from "./SocialMediaSection";

let root: Root;
let host: HTMLDivElement;
const endpoint = "/api/v1/admin/settings/mobile.social_links";
const initial = () => ({
  key: "mobile.social_links",
  value: { instagram: "", tiktok: "", snapchat: "" },
  sensitivity: "public",
  redacted: false,
  version: 1,
  updatedAt: "2026-10-21T00:00:00Z",
});
async function render(
  permissions = ["operations.settings.read", "operations.settings.manage"],
  setting = initial(),
) {
  mockServer.use(
    http.get("/api/v1/admin/access/me", () =>
      HttpResponse.json({
        ...adminSessionFixture,
        effectivePermissionKeys: permissions,
      }),
    ),
    http.get(endpoint, () => HttpResponse.json(setting)),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <LocaleProvider locale="en" setLocale={() => undefined}>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <SocialMediaSection />
        </QueryClientProvider>
      </LocaleProvider>,
    );
  });
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(host.querySelector('input[aria-label="Instagram"]')).toBeTruthy();
  });
  return setting;
}
async function fill(selector: string, value: string) {
  const element = host.querySelector(selector) as
    HTMLInputElement | HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});

test("saves links, reloads the saved values and clears an account with the latest version", async () => {
  const data = initial();
  const writes: unknown[] = [];
  mockServer.use(
    http.patch(endpoint, async ({ request }) => {
      const body = (await request.json()) as {
        value: typeof data.value;
        expectedVersion: number;
        reason: string;
      };
      writes.push(body);
      expect(body.expectedVersion).toBe(data.version);
      data.value = body.value;
      data.version++;
      return HttpResponse.json({
        resourceId: data.key,
        status: "updated",
        version: data.version,
      });
    }),
  );
  await render(undefined, data);
  for (const link of ["https://instagram.com/masarifi", ""]) {
    await fill('input[aria-label="Instagram"]', link);
    await fill("textarea", "Update public social media accounts");
    await submit();
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.textContent).toContain("Links saved.");
      expect(
        (host.querySelector("button[type=submit]") as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
    expect(
      (host.querySelector('input[aria-label="Instagram"]') as HTMLInputElement)
        .value,
    ).toBe(link);
  }
  expect(writes).toEqual([
    {
      value: {
        instagram: "https://instagram.com/masarifi",
        tiktok: "",
        snapchat: "",
      },
      expectedVersion: 1,
      reason: "Update public social media accounts",
    },
    {
      value: { instagram: "", tiktok: "", snapchat: "" },
      expectedVersion: 2,
      reason: "Update public social media accounts",
    },
  ]);
});
test("keeps draft links and reports a version conflict without retrying the write", async () => {
  let writes = 0;
  mockServer.use(
    http.patch(endpoint, () => {
      writes++;
      return HttpResponse.json({ code: "VERSION_CONFLICT" }, { status: 409 });
    }),
  );
  await render();
  await fill('input[aria-label="TikTok"]', "https://tiktok.com/@masarifi");
  await fill("textarea", "Update public social media accounts");
  await submit();
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(host.textContent).toContain("Another session changed these links");
  });
  expect(writes).toBe(1);
  expect(
    (host.querySelector('input[aria-label="TikTok"]') as HTMLInputElement)
      .value,
  ).toBe("https://tiktok.com/@masarifi");
  expect(
    (host.querySelector("button[type=submit]") as HTMLButtonElement).disabled,
  ).toBe(true);
});
test("read-only administrators cannot edit or submit links", async () => {
  await render(["operations.settings.read"]);
  expect((host.querySelector("fieldset") as HTMLFieldSetElement).disabled).toBe(
    true,
  );
  expect(
    (host.querySelector("button[type=submit]") as HTMLButtonElement).disabled,
  ).toBe(true);
});
