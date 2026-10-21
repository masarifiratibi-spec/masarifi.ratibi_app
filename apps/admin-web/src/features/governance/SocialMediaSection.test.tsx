import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { adminSessionFixture } from "@/mocks/fixtures/foundation";
import { LocaleProvider } from "@/core/localization/provider";
import { SocialMediaSection } from "./SocialMediaSection";
import { configureApiActorProvider } from "@/core/api/client";

const verification = vi.hoisted(() => ({
  live: false,
  prompt: vi.fn(),
  complete: undefined as undefined | (() => void),
  cancel: undefined as undefined | (() => void),
}));
vi.mock("@/app/providers", async (original) => {
  const actual = await original<typeof import("@/app/providers")>();
  return {
    ...actual,
    useAdminIdentity: () => ({ ...actual.useAdminIdentity(), enabled: verification.live }),
  };
});
vi.mock("@clerk/nextjs", () => ({
  useReverification: (fetcher: (...args: unknown[]) => Promise<unknown>) => async (...args: unknown[]) => {
    const result = await fetcher(...args);
    if (result && typeof result === "object" && "clerk_error" in result) {
      verification.prompt(result);
      await new Promise<void>((resolve, reject) => {
        verification.complete = resolve;
        verification.cancel = () => reject({ code: "reverification_cancelled" });
      });
      return fetcher(...args);
    }
    return result;
  },
}));

beforeEach(() => {
  verification.live = false;
  verification.prompt.mockClear();
  verification.complete = undefined;
  verification.cancel = undefined;
});

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

test.each(["complete", "cancel", "denied", "account-switch"] as const)(
  "preserves the draft and handles recent authentication: %s",
  async (outcome) => {
    verification.live = true;
    const data = initial();
    let writes = 0;
    mockServer.use(http.patch(endpoint, async ({ request }) => {
      writes++;
      if (writes === 1 || outcome === "denied")
        return HttpResponse.json({ code: "RECENT_AUTH_REQUIRED" }, { status: 403 });
      const body = await request.json() as { value: typeof data.value };
      data.value = body.value;
      data.version++;
      return HttpResponse.json({ resourceId: data.key, status: "updated", version: data.version });
    }));
    await render(undefined, data);
    const link = "https://www.tiktok.com/@masarifi.ratibi?lang=en";
    await fill('input[aria-label="TikTok"]', link);
    await fill("textarea", "Add the official TikTok profile");
    await submit();
    await vi.waitFor(() => expect(verification.prompt).toHaveBeenCalledOnce());
    expect(verification.prompt.mock.calls[0][0]).toMatchObject({
      clerk_error: { metadata: { reverification: { level: "first_factor" } } },
    });
    expect(writes).toBe(1);
    expect((host.querySelector('input[aria-label="TikTok"]') as HTMLInputElement).value).toBe(link);
    expect((host.querySelector("button[type=submit]") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      if (outcome === "cancel") verification.cancel!();
      else {
        if (outcome === "account-switch") configureApiActorProvider(() => "another-admin");
        verification.complete!();
      }
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect((host.querySelector("button[type=submit]") as HTMLButtonElement).disabled).toBe(false);
    });
    expect(host.textContent?.includes("Links saved.")).toBe(outcome === "complete");
    expect(writes).toBe(outcome === "complete" || outcome === "denied" ? 2 : 1);
    expect((host.querySelector('input[aria-label="TikTok"]') as HTMLInputElement).value).toBe(link);
    if (outcome === "denied" || outcome === "account-switch")
      expect(host.textContent).toContain("Sign in again");
    if (outcome === "cancel") expect(host.textContent).toContain("Verification cancelled");
  },
);
