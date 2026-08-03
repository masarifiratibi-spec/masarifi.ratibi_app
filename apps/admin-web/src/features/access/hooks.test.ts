import { describe, expect, test } from "vitest";
import { SIMULATED_ACTORS } from "@/core/permissions/role-map";
import { ApiError } from "@/core/api/errors";
import { accessQueryKeys, isTerminalWorkspaceError, millisecondsUntilExpiry } from "./hooks";

describe("access query keys and expiry", () => {
  test("normalizes list keys", () => {
    expect(accessQueryKeys.list({})).toEqual([
      "access",
      "list",
      { page: 1, pageSize: 25 },
      "super-admin",
    ]);
  });

  test("isolates workspaces by stable actor", () => {
    expect(accessQueryKeys.workspace("ACC-1003", SIMULATED_ACTORS["support-agent"]))
      .not.toEqual(accessQueryKeys.workspace("ACC-1003", SIMULATED_ACTORS["security-administrator"]));
  });

  test("schedules exact absolute expiry without negative delays", () => {
    expect(millisecondsUntilExpiry("2026-07-28T10:00:05.000Z", new Date("2026-07-28T10:00:00.000Z"))).toBe(5_000);
    expect(millisecondsUntilExpiry("2026-07-28T09:59:59.000Z", new Date("2026-07-28T10:00:00.000Z"))).toBe(0);
  });

  test("classifies access-loss errors for immediate cache removal", () => {
    expect(isTerminalWorkspaceError(new ApiError("forbidden", "safe", 403))).toBe(true);
    expect(isTerminalWorkspaceError(new ApiError("session_expired", "safe", 401))).toBe(true);
    expect(isTerminalWorkspaceError(new ApiError("internal_error", "safe", 500))).toBe(false);
  });
});
