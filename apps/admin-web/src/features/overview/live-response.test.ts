import { describe, it, expect } from "vitest";
import {
  adminOverview,
  adminAnalytics,
} from "../../../../api/src/reports/reports.admin";
import {
  overviewSummaryResponseSchema,
  platformAnalyticsResponseSchema,
} from "./contracts";
const query = { platform: "all", period: "7d", locale: "en" };
const measured = {
  totalUsers: 12,
  newUsers: 2,
  iosUsers: 7,
  androidUsers: 6,
  bothUsers: 3,
  unknownUsers: 2,
  iosDevices: 8,
  androidDevices: 6,
  newIosUsers: 1,
  newAndroidUsers: 1,
  newBothUsers: 1,
  newUnknownUsers: 1,
  observedAt: "2026-10-23T09:00:00.000Z",
  timezone: "Asia/Riyadh",
  periodStart: "2026-10-16T21:00:00.000Z",
  periodEnd: "2026-10-23T09:00:00.000Z",
  collectionStartedAt: "2026-10-23T08:00:00.000Z",
  activity: {
    total: 0,
    ios: 0,
    android: 0,
    daily: [
      { timestamp: "2026-10-16T21:00:00.000Z", value: null },
      { timestamp: "2026-10-22T21:00:00.000Z", value: 0 },
    ],
    monthly: [],
  },
  operations: [
    { id: "imports", kind: "imports", total: 1234, platformScope: "global" },
  ],
};
describe("actual API overview output", () => {
  it("accepts measured zeros, unknown billing and partially collected activity without losing metadata", () => {
    const overview = overviewSummaryResponseSchema.parse(
      adminOverview(query, measured),
    );
    const analytics = platformAnalyticsResponseSchema.parse(
      adminAnalytics(query, measured),
    );
    expect(
      overview.metrics.find((item) => item.id === "mrr")?.numericValue,
    ).toBeNull();
    expect(
      overview.metrics.find((item) => item.id === "imports")?.numericValue,
    ).toBe(1234);
    expect(analytics.customers.unknownPlatformCustomers).toBe(2);
    expect(analytics.dailyActiveUsers.points.map((item) => item.value)).toEqual(
      [null, 0],
    );
    expect(analytics.customers.observation?.collectionStartedAt).toBe(
      measured.collectionStartedAt,
    );
  });
});
