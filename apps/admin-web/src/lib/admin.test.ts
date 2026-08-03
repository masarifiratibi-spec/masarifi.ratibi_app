import { expect, test } from "vitest";
import type { AdminUserListItem } from "@/features/users/contracts";
import { filterUsers, formatAdminNumber, formatCompactNumber, formatDate, paginate, sortUsers } from "./admin-utils.ts";

const iosOnly: AdminUserListItem = {
  id: "USR-10482",
  displayName: "نورة العتيبي",
  maskedEmail: "n***@example.test",
  country: "SA",
  language: "ar",
  primaryPlatform: "ios",
  registeredPlatforms: ["ios"],
  iosDeviceCount: 2,
  androidDeviceCount: 0,
  totalDeviceCount: 2,
  plan: "Premium",
  status: "active",
  verification: "verified",
  registeredAt: "2026-01-11T00:00:00+03:00",
  lastActiveAt: "2026-07-25T08:20:00+03:00",
  risk: "low",
};

const androidOnly: AdminUserListItem = {
  id: "USR-10479",
  displayName: "سالم المنصوري",
  maskedEmail: "s***@example.test",
  country: "AE",
  language: "ar",
  primaryPlatform: "android",
  registeredPlatforms: ["android"],
  iosDeviceCount: 0,
  androidDeviceCount: 1,
  totalDeviceCount: 1,
  plan: "Basic",
  status: "active",
  verification: "verified",
  registeredAt: "2026-02-12T00:00:00+03:00",
  lastActiveAt: "2026-07-24T07:20:00+03:00",
  risk: "low",
};

const multiPlatform: AdminUserListItem = {
  id: "USR-10461",
  displayName: "Omar Kareem",
  maskedEmail: "o***@example.test",
  country: "AE",
  language: "en",
  primaryPlatform: "ios",
  registeredPlatforms: ["ios", "android"],
  iosDeviceCount: 1,
  androidDeviceCount: 2,
  totalDeviceCount: 3,
  plan: "Premium",
  status: "active",
  verification: "verified",
  registeredAt: "2026-03-13T00:00:00+03:00",
  lastActiveAt: "2026-07-23T06:20:00+03:00",
  risk: "medium",
};

const all = [iosOnly, androidOnly, multiPlatform];

test("All platform filter shows each customer once including multi-platform", () => {
  expect(filterUsers(all, { platform: "all" })).toHaveLength(3);
});

test("iOS filter includes multi-platform customers", () => {
  const result = filterUsers(all, { platform: "ios" });
  expect(result.map((u) => u.id)).toEqual(expect.arrayContaining(["USR-10482", "USR-10461"]));
  expect(result).not.toContainEqual(expect.objectContaining({ id: "USR-10479" }));
});

test("Android filter includes multi-platform customers", () => {
  const result = filterUsers(all, { platform: "android" });
  expect(result.map((u) => u.id)).toEqual(expect.arrayContaining(["USR-10479", "USR-10461"]));
});

test("Multi filter shows only customers with both platforms", () => {
  const result = filterUsers(all, { platform: "multi" });
  expect(result.map((u) => u.id)).toEqual(["USR-10461"]);
});

test("search matches name, masked email, or id", () => {
  expect(filterUsers(all, { query: "نورة" })).toHaveLength(1);
  expect(filterUsers(all, { query: "o***" })).toHaveLength(1);
  expect(filterUsers(all, { query: "USR-10479" })).toHaveLength(1);
});

test("status, plan, country, language, verification, and risk filters work", () => {
  expect(filterUsers(all, { status: "active" })).toHaveLength(3);
  expect(filterUsers(all, { plan: "Premium" })).toHaveLength(2);
  expect(filterUsers(all, { country: "SA" })).toHaveLength(1);
  expect(filterUsers(all, { language: "en" })).toHaveLength(1);
  expect(filterUsers(all, { verification: "verified" })).toHaveLength(3);
  expect(filterUsers(all, { risk: "medium" })).toHaveLength(1);
});

test("registration and last-activity date-range filters work", () => {
  expect(filterUsers(all, { registeredFrom: "2026-03-01" })).toHaveLength(1);
  expect(filterUsers(all, { registeredTo: "2026-01-31" })).toHaveLength(1);
  expect(filterUsers(all, { lastActiveFrom: "2026-07-24T00:00:00+03:00" })).toHaveLength(2);
  expect(filterUsers(all, { lastActiveTo: "2026-07-23T07:00:00+03:00" })).toHaveLength(1);
});

test("sortUsers sorts by name, registeredAt, lastActive, and risk", () => {
  const byNameAsc = sortUsers(all, "name", "asc");
  expect(byNameAsc[0].displayName).toBe("Omar Kareem");
  const byRiskDesc = sortUsers(all, "risk", "desc");
  expect(byRiskDesc[0].id).toBe("USR-10461");
  const byRegisteredAsc = sortUsers(all, "registeredAt", "asc");
  expect(byRegisteredAsc[0].id).toBe("USR-10482");
  const byLastActiveDesc = sortUsers(all, "lastActive", "desc");
  expect(byLastActiveDesc[0].id).toBe("USR-10482");
});

test("paginate returns the requested slice", () => {
  expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
});

test("formatCompactNumber uses English digits", () => {
  expect(formatCompactNumber(12400)).toMatch(/12/);
  expect(formatCompactNumber(12400)).not.toMatch(/[٠-٩]/);
});

test("formatAdminNumber uses English digits for dashboard counts", () => {
  expect(formatAdminNumber(1234567)).toBe("1,234,567");
});

test("formatDate uses English digits and meridiem in Arabic dashboard UI", () => {
  const formatted = formatDate("2026-07-24T07:30:00+03:00", true);

  expect(formatted).not.toMatch(/[٠-٩]/);
  expect(formatted).not.toMatch(/[صم]/);
  expect(formatted).toMatch(/[0-9]/);
  expect(formatted).toMatch(/AM|PM/);
});
