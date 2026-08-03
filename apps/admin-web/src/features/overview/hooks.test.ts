import { describe, expect, test } from "vitest";
import { overviewQueryKeys } from "./hooks";

describe("overview query keys", () => {
  test("summary key is serializable and includes platform, period, locale, scenario", () => {
    expect(overviewQueryKeys.summary({ platform: "ios", period: "30d", locale: "ar" })).toEqual([
      "overview",
      "summary",
      "ios",
      "30d",
      "ar",
      null,
    ]);
    expect(
      overviewQueryKeys.summary({ platform: "all", period: "7d", locale: "en", scenario: "stale" }),
    ).toEqual(["overview", "summary", "all", "7d", "en", "stale"]);
  });

  test("platform analytics key differs by platform and period", () => {
    const ios = overviewQueryKeys.platformAnalytics({ platform: "ios", period: "30d", locale: "ar" });
    const android = overviewQueryKeys.platformAnalytics({ platform: "android", period: "30d", locale: "ar" });
    const ios7 = overviewQueryKeys.platformAnalytics({ platform: "ios", period: "7d", locale: "ar" });
    expect(ios).not.toEqual(android);
    expect(ios).not.toEqual(ios7);
  });

  test("activity key includes page and pageSize so pagination is cached separately", () => {
    const page1 = overviewQueryKeys.activity({ platform: "all", period: "30d", locale: "ar", page: 1, pageSize: 10 });
    const page2 = overviewQueryKeys.activity({ platform: "all", period: "30d", locale: "ar", page: 2, pageSize: 10 });
    expect(page1).not.toEqual(page2);
    expect(JSON.stringify(page1)).toContain("activity");
  });

  test("keys normalize omitted query values to the contract defaults", () => {
    expect(overviewQueryKeys.summary({})).toEqual([
      "overview",
      "summary",
      "all",
      "30d",
      "ar",
      null,
    ]);
    expect(overviewQueryKeys.activity({})).toEqual([
      "overview",
      "activity",
      "all",
      "30d",
      "ar",
      1,
      10,
      null,
    ]);
  });
});
