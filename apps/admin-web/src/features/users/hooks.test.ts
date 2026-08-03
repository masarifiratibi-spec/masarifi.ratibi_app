import { describe, expect, test } from "vitest";
import { userMutationLockKeys, usersQueryKeys } from "./hooks";

describe("users query keys", () => {
  test("normalizes omitted defaults and trimmed search", () => {
    expect(usersQueryKeys.list({ query: "  Omar  " })).toEqual([
      "users",
      "list",
      {
        query: "Omar",
        platform: "all",
        sort: "lastActive",
        order: "desc",
        page: 1,
        pageSize: 25,
      },
    ]);
  });

  test("uses page-one inputs after a list control changes", () => {
    const key = usersQueryKeys.list({ platform: "multi", sort: "name", page: 1, pageSize: 50 });
    expect(key.at(-1)).toMatchObject({ platform: "multi", sort: "name", page: 1, pageSize: 50 });
  });

  test("produces equal keys for semantically equal raw inputs", () => {
    expect(usersQueryKeys.list({})).toEqual(usersQueryKeys.list({
      platform: "all", sort: "lastActive", order: "desc", page: 1, pageSize: 25,
    }));
  });

  test("normalizes independent profile, device, and session keys", () => {
    const input = { userId: "USR-10482", role: "support-agent" as const };
    expect(usersQueryKeys.detail(input)).toEqual(["users", "detail", input]);
    expect(usersQueryKeys.devices(input)).toEqual(["users", "devices", input]);
    expect(usersQueryKeys.sessions(input)).toEqual(["users", "sessions", input]);
  });

  test("produces equal detail-region keys for semantically equal inputs", () => {
    const input = { userId: "USR-10482" };
    expect(usersQueryKeys.detail(input)).toEqual(usersQueryKeys.detail({ ...input }));
    expect(usersQueryKeys.devices(input)).toEqual(usersQueryKeys.devices({ ...input }));
    expect(usersQueryKeys.sessions(input)).toEqual(usersQueryKeys.sessions({ ...input }));
  });
});

describe("user mutation locks", () => {
  test("isolates each controlled action by action and resource", () => {
    expect(new Set([
      userMutationLockKeys.suspend("USR-10482"),
      userMutationLockKeys.reactivate("USR-10482"),
      userMutationLockKeys.verification("USR-10482"),
      userMutationLockKeys.device("USR-10482", "DEV-IOS-10482-A"),
      userMutationLockKeys.sessions("USR-10482"),
    ]).size).toBe(5);
  });

  test("derives one order-independent bulk lock from explicit selection", () => {
    expect(userMutationLockKeys.bulk("suspend", ["USR-10482", "USR-10443"]))
      .toBe(userMutationLockKeys.bulk("suspend", ["USR-10443", "USR-10482"]));
    expect(userMutationLockKeys.bulk("reactivate", ["USR-10482"]))
      .not.toBe(userMutationLockKeys.bulk("suspend", ["USR-10482"]));
  });
});
