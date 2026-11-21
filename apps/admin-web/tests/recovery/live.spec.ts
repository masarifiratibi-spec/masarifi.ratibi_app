import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

const api = "http://127.0.0.1:43169/api/v1";
const adminHeaders = { authorization: "Bearer recovery-test-principal" };
const ownerHeaders = {
  ...adminHeaders,
  "x-recovery-actor": "user_recovery_browser_owner",
};
interface Ticket {
  id: string;
  version: number;
  status: string;
  messages: Array<{ body: string }>;
  internalNotes?: unknown[];
}

async function english(page: Page) {
  await expect(page.locator(".environment")).toBeVisible();
  if ((await page.locator("html").getAttribute("lang")) === "ar")
    await page.getByRole("button", { name: "تغيير اللغة" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}
async function ownerTicket(request: APIRequestContext, id: string) {
  const response = await request.get(`${api}/support/tickets/${id}`, {
    headers: ownerHeaders,
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Ticket;
}

test("real HTTP support lifecycle keeps staff notes private and accepts customer replies", async ({
  page,
  request,
}, info) => {
  const categories = await request.get(`${api}/support/categories`, {
    headers: ownerHeaders,
  });
  expect(categories.status()).toBe(200);
  const category = (
    (await categories.json()) as { items: Array<{ id: string; key: string }> }
  ).items.find((item) => item.key === "recovery_browser");
  expect(category).toBeTruthy();
  const subject = `Recovery conversation ${info.project.name} ${randomUUID()}`;
  const created = await request.post(`${api}/support/tickets`, {
    headers: { ...ownerHeaders, "idempotency-key": randomUUID() },
    data: {
      categoryId: category?.id,
      subject,
      message: "Customer opening question",
    },
  });
  expect(created.status()).toBe(201);
  const ticket = (await created.json()) as Ticket;
  await page.goto(`/admin/support/tickets/${ticket.id}`);
  await english(page);
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        navigator.serviceWorker?.controller === null ||
        navigator.serviceWorker === undefined,
    ),
  ).toBe(true);
  const act = async (action: string, message?: string) => {
    await page
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption(action);
    if (message)
      await page.getByLabel("Message", { exact: true }).fill(message);
    if (action === "assign")
      await page
        .getByLabel("Admin ID (leave empty to unassign)")
        .fill("demo-admin");
    await page
      .getByLabel("Reason for the audit log")
      .fill("Local recovery browser verification");
    const posted = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/support/tickets/${ticket.id}/`),
    );
    await page.getByRole("button", { name: "Apply action" }).click();
    expect((await posted).status()).toBeLessThan(300);
    await expect(page.getByText("Action saved", { exact: true })).toBeVisible();
  };
  await act("assign");
  await act("reply", "Support response\nSecond line");
  await act("note", "Private staff investigation");
  let detail = await ownerTicket(request, ticket.id);
  expect(
    detail.messages.some(
      (message) => message.body === "Support response\nSecond line",
    ),
  ).toBe(true);
  expect(JSON.stringify(detail)).not.toContain("Private staff investigation");
  expect(detail).not.toHaveProperty("internalNotes");
  const reply = await request.post(
    `${api}/support/tickets/${ticket.id}/messages`,
    {
      headers: { ...ownerHeaders, "idempotency-key": randomUUID() },
      data: { body: "Customer follow up", expectedVersion: detail.version },
    },
  );
  expect(reply.status()).toBe(201);
  await page.reload();
  await english(page);
  await expect(
    page.getByText("Customer follow up", { exact: true }),
  ).toBeVisible();
  await act("resolve");
  await act("close");
  await act("reopen");
  detail = await ownerTicket(request, ticket.id);
  expect(detail.status).toBe("waiting_support");
});

test("real HTTP server filters find a ticket beyond page25", async ({
  page,
}) => {
  await page.goto("/admin/support/tickets");
  await english(page);
  await page
    .getByRole("searchbox", { name: "Search subject or ticket ID" })
    .fill("Browser pagination");
  let fetched = page.waitForResponse(
    (response) =>
      response.url().includes("/admin/support/tickets?") &&
      response.url().includes("query=Browser"),
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  const first = (await (await fetched).json()) as {
    items: Array<{ subject: string }>;
    totalItems: number;
  };
  expect(first.totalItems).toBe(27);
  expect(first.items).toHaveLength(25);
  expect(
    first.items.some((item) => item.subject === "Browser pagination 26"),
  ).toBe(false);
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("urgent");
  fetched = page.waitForResponse(
    (response) =>
      response.url().includes("/admin/support/tickets?") &&
      response.url().includes("priority=urgent"),
  );
  await page.getByRole("button", { name: "Apply filters" }).click();
  expect(
    ((await (await fetched).json()) as { totalItems: number }).totalItems,
  ).toBe(1);
  await expect(
    page.getByRole("link", { name: "Browser pagination 26", exact: true }),
  ).toBeVisible();
});

test("live UI never exposes simulated authority when MSW is disabled", async ({
  page,
}) => {
  await page.goto("/admin/support");
  await english(page);
  await expect(
    page.getByRole("combobox", { name: "Simulated role" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Support overview" }),
  ).toBeVisible();
});

test("a failed live session bootstrap explains the failure and can retry", async ({
  page,
}) => {
  await page.route("**/api/v1/admin/access/me", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "service_unavailable" }),
    }),
  );
  await page.goto("/admin/support");
  await english(page);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.unroute("**/api/v1/admin/access/me");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Support overview" }),
  ).toBeVisible();
});

test("real HTTP customer changes are audited and bounded audit history remains reachable", async ({
  page,
  request,
}) => {
  const owner = "user_recovery_browser_owner";
  const initial = await request.get(`${api}/admin/users/${owner}`, {
    headers: adminHeaders,
  });
  expect(initial.status()).toBe(200);
  if (((await initial.json()) as { status: string }).status === "suspended") {
    expect(
      (
        await request.post(`${api}/admin/users/${owner}/reactivate`, {
          headers: { ...adminHeaders, "idempotency-key": randomUUID() },
          data: { reason: "Reset the owned browser fixture precondition" },
        })
      ).status(),
    ).toBe(201);
  }
  await page.goto(`/admin/users/${owner}`);
  await english(page);
  await expect(
    page.getByRole("button", { name: "Suspend account", exact: true }),
  ).toBeVisible();
  for (const action of ["suspend", "reactivate"]) {
    const name =
      action === "suspend" ? "Suspend account" : "Reactivate account";
    await page.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    await dialog
      .getByRole("textbox", { name: "Reason for action", exact: true })
      .fill("Local browser customer lifecycle verification");
    const changed = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/users/${owner}/${action}`),
    );
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    expect((await changed).status()).toBe(201);
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", {
        name: action === "suspend" ? "Reactivate account" : "Suspend account",
        exact: true,
      }),
    ).toBeVisible();
  }
  const customer = await request.get(`${api}/admin/users/${owner}`, {
    headers: adminHeaders,
  });
  expect(customer.status()).toBe(200);
  await page.goto("/admin/audit");
  await english(page);
  await expect(
    page
      .locator(".audit-event-key:visible")
      .filter({ hasText: "customer.suspend" })
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/≥\d+ immutable entries/)).toBeVisible();
  const next = page.waitForResponse(
    (response) =>
      response.url().includes("/admin/audit/events?") &&
      response.url().includes("cursor="),
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  expect((await next).status()).toBe(200);
  await expect(page.locator("nav.toolbar-actions span")).toHaveText("2");
});

test("real HTTP views fit Arabic and English, light and dark with the approved fonts", async ({
  page,
}, info) => {
  for (const locale of ["ar", "en"])
    for (const theme of ["light", "dark"]) {
      await page.goto("/admin/support/tickets");
      await expect(
        page.locator(".support-ticket-list article").first(),
      ).toBeVisible();
      if (locale === "en") await english(page);
      if (theme === "dark")
        await page
          .getByRole("button", {
            name: locale === "en" ? "Toggle theme" : "تبديل المظهر",
          })
          .click();
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        locale === "ar" ? "rtl" : "ltr",
      );
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      await expect(page.locator(".environment")).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`support-${locale}-${theme}.png`),
      });
    }
  if (info.project.name === "desktop-1280") {
    await page.setViewportSize({ width: 640, height: 450 });
    const session = await page.context().newCDPSession(page);
    // Half the CSS viewport at double DPR emulates 200% desktop zoom with reflow.
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 640,
      height: 450,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(640);
    await expect(page.locator(".mobile-menu")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("support-text-scale-200.png"),
    });
    await session.detach();
  }
});
