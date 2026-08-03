import { describe, expect, test } from "vitest";
import * as hooks from "./hooks";

describe("Phase 8 system health hooks", () => {
  test("uses role-scoped Phase 8 query keys", () => {
    expect(hooks.phase8SystemHealthQueryKeys.overview({
      role: "super-admin",
      range: "24h",
      platform: "all",
    })).toEqual(["phase8-system-health", "super-admin", "overview", "24h", "all"]);
  });

  test("refetches every 60 seconds only while visible, online, and not action-pending", () => {
    expect(hooks.phase8RefetchPolicy({
      documentHidden: false,
      online: true,
      actionPending: false,
    })).toMatchObject({ refetchInterval: 60_000, refetchIntervalInBackground: false });
    expect(hooks.phase8RefetchPolicy({
      documentHidden: true,
      online: true,
      actionPending: false,
    }).refetchInterval).toBe(false);
    expect(hooks.phase8RefetchPolicy({
      documentHidden: false,
      online: false,
      actionPending: false,
    }).refetchInterval).toBe(false);
    expect(hooks.phase8RefetchPolicy({
      documentHidden: false,
      online: true,
      actionPending: true,
    }).refetchInterval).toBe(false);
  });

  test("keeps manual refresh on the Phase 8 read query boundary", () => {
    expect(hooks.phase8SystemHealthQueryKeys.all).toEqual(["phase8-system-health"]);
  });
});
