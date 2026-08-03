import { describe, expect, test } from "vitest";
import { phase4QueryKeys } from "./hooks";

describe("Spec 005 query keys", () => {
  test("isolates overview queries by authoritative platform scope", () => {
    expect(phase4QueryKeys.overview("all")).not.toEqual(phase4QueryKeys.overview("ios"));
    expect(phase4QueryKeys.overview("android")).toEqual([
      "phase4-imports-parsers",
      "overview",
      "android",
    ]);
  });

  test("isolates list queries by resource, platform, and page", () => {
    const sessions = phase4QueryKeys.list("sessions", {
      platform: "all",
      page: 1,
      pageSize: 25,
    });
    const iosSessions = phase4QueryKeys.list("sessions", {
      platform: "ios",
      page: 1,
      pageSize: 25,
    });
    const failures = phase4QueryKeys.list("failures", {
      platform: "all",
      page: 1,
      pageSize: 25,
    });

    expect(sessions).not.toEqual(iosSessions);
    expect(sessions).not.toEqual(failures);
  });

  test("isolates detail queries by resource and safe identifier", () => {
    expect(phase4QueryKeys.detail("sessions", "IMP-77241")).not.toEqual(
      phase4QueryKeys.detail("sessions", "IMP-77236"),
    );
    expect(phase4QueryKeys.detail("banks", "BNK-001")).toEqual([
      "phase4-imports-parsers",
      "banks",
      "detail",
      "BNK-001",
    ]);
  });
});
