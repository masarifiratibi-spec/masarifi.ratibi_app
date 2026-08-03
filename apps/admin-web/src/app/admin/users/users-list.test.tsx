import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/core/localization/provider";
import UsersPage from "./page";

const useUsers = vi.fn();
vi.mock("@/features/users/hooks", () => ({ useUsers: (...args: unknown[]) => useUsers(...args) }));

const customer = {
  id: "USR-10461", displayName: "Omar Kareem", maskedEmail: "o***@example.test",
  country: "AE", language: "en", primaryPlatform: "ios", registeredPlatforms: ["ios", "android"],
  iosDeviceCount: 1, androidDeviceCount: 2, totalDeviceCount: 3, plan: "Premium",
  status: "active", verification: "verified", registeredAt: "2026-04-14T00:00:00+03:00",
  lastActiveAt: "2026-07-22T05:20:00+03:00", risk: "medium",
} as const;

function renderUsersPage(locale: "ar" | "en" = "ar") {
  return renderToStaticMarkup(
    <LocaleProvider locale={locale} setLocale={() => undefined}>
      <UsersPage />
    </LocaleProvider>,
  );
}

beforeEach(() => {
  useUsers.mockReturnValue({
    data: {
      items: [customer],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
      uniqueCustomersTotal: 1, iosCustomers: 1, androidCustomers: 1,
      multiPlatformCustomers: 1, region: { availability: "available" },
    },
    isPending: false, isError: false,
  });
});

describe("users list", () => {
  test("renders platform controls, unique totals, masking, and additive device labels", () => {
    const html = renderUsersPage();
    expect(html).toContain("كل المنصات");
    expect(html).toContain("iOS");
    expect(html).toContain("Android");
    expect(html).toContain("متعدد المنصات");
    expect(html).toContain("o***@example.test");
    expect(html).toContain("3 أجهزة");
    expect(html).not.toContain("o@example.test");
  });

  test("renders non-color-only status and risk text in desktop and mobile views", () => {
    const html = renderUsersPage();
    expect(html.match(/نشط/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/متوسط/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("renders the exact full-profile link", () => {
    expect(renderUsersPage()).toContain('href="/admin/users/USR-10461"');
  });

  test("renders English labels when the admin locale is English", () => {
    const html = renderUsersPage("en");
    expect(html).toContain("User Management");
    expect(html).toContain("All platforms");
    expect(html).toContain("United Arab Emirates");
    expect(html).toContain("Active");
    expect(html).toContain("Medium");
    expect(html).toContain("Open full profile");
    expect(html).not.toContain("إدارة المستخدمين");
  });

  test("renders empty, error, and forbidden regions", () => {
    useUsers.mockReturnValueOnce({
      data: { items: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
        uniqueCustomersTotal: 0, iosCustomers: 0, androidCustomers: 0,
        multiPlatformCustomers: 0, region: { availability: "empty" } },
      isPending: false, isError: false,
    });
    expect(renderUsersPage()).toContain("لا توجد");
    useUsers.mockReturnValueOnce({ data: undefined, isPending: false, isError: true, error: { code: "forbidden" } });
    expect(renderUsersPage()).toContain("users.read");
  });
});
