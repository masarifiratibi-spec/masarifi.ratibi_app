import test from "node:test";
import assert from "node:assert/strict";
import { filterUsers, formatCompactNumber, paginate } from "./admin-utils.ts";
import type { UserRecord } from "@/types/admin";

const users: UserRecord[] = [
  {
    id: "USR-1001",
    name: "نورة العتيبي",
    email: "n***@example.test",
    country: "السعودية",
    platform: "iOS",
    plan: "Premium",
    status: "active",
    verification: "verified",
    risk: "low",
    registeredAt: "2026-05-02",
    lastActive: "2026-07-25T08:30:00+03:00",
    language: "العربية",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    appVersion: "4.8.2",
    accounts: 3,
    transactions: 284,
    goals: 2,
    lastSync: "2026-07-25T08:28:00+03:00",
    importSources: 4,
  },
];

test("filterUsers searches Arabic names and filters plans", () => {
  assert.equal(filterUsers(users, { query: "نورة", plan: "Premium" }).length, 1);
  assert.equal(filterUsers(users, { query: "نورة", plan: "Free" }).length, 0);
});

test("paginate returns the requested slice", () => {
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2, 2), [3, 4]);
});

test("formatCompactNumber uses Arabic compact notation", () => {
  assert.match(formatCompactNumber(12400), /١٢/);
});
