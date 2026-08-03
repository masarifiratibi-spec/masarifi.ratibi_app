import { describe, expect, test } from "vitest";
import { aiActionLockKey, aiQueryKeys } from "./hooks";

describe("Spec 006 shared AI hooks", () => {
  test("builds stable query keys by operation and filters", () => {
    expect(aiQueryKeys.overview({ platform: "all", period: "30d" })).toEqual([
      "phase5-ai",
      "overview",
      { platform: "all", period: "30d" },
    ]);
    expect(aiQueryKeys.list("providers", { page: 1, pageSize: 25 })).not.toEqual(
      aiQueryKeys.list("models", { page: 1, pageSize: 25 }),
    );
  });

  test("targets detail keys and duplicate mutation locks by resource id and action", () => {
    expect(aiQueryKeys.detail("providers", "AIP-OPENAI")).toEqual([
      "phase5-ai",
      "providers",
      "detail",
      "AIP-OPENAI",
    ]);
    expect(aiActionLockKey("providers", "AIP-OPENAI", "activate")).toBe("providers:AIP-OPENAI:activate");
  });

  test("keeps overview filters in the query key", () => {
    expect(aiQueryKeys.overview({ platform: "ios", period: "7d" })).not.toEqual(
      aiQueryKeys.overview({ platform: "android", period: "7d" }),
    );
  });
});
