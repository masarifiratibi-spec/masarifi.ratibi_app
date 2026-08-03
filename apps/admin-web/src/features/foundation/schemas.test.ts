import { describe, expect, test } from "vitest";
import { attentionItemSchema, attentionQuerySchema, attentionResponseSchema } from "./schemas";

const baseAttentionItem = {
  id: "ATT-DEMO-1",
  type: "incident",
  severity: "critical",
  summary: "تنبيه تشغيلي تجريبي آمن.",
  occurredAt: "2026-07-27T10:00:00+03:00",
  platformScope: "global",
  permission: "attention.read",
} as const;

describe("attention schemas", () => {
  test("accept approved categories, platform scope, period, and pagination", () => {
    expect(attentionItemSchema.parse(baseAttentionItem).severity).toBe("critical");
    expect(
      attentionQuerySchema.parse({
        role: "super-admin",
        platform: "ios",
        period: "30d",
        page: 1,
        pageSize: 5,
      }),
    ).toMatchObject({ platform: "ios", period: "30d", page: 1, pageSize: 5 });
  });

  test("reject unsafe shape, invalid timestamps, and unapproved destinations", () => {
    expect(() => attentionItemSchema.parse({ ...baseAttentionItem, occurredAt: "now" })).toThrow();
    expect(() => attentionItemSchema.parse({ ...baseAttentionItem, destination: "/admin/unknown" })).toThrow();
    expect(() => attentionItemSchema.parse({ ...baseAttentionItem, type: "later-phase" })).toThrow();
    expect(() => attentionItemSchema.parse({ ...baseAttentionItem, summary: "x".repeat(241) })).toThrow();
  });

  test("bounds the paginated attention response", () => {
    expect(
      attentionResponseSchema.parse({
        items: [baseAttentionItem],
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        region: { region: "attention", availability: "available", retryable: true },
      }).items,
    ).toHaveLength(1);
    expect(() =>
      attentionResponseSchema.parse({
        items: [],
        page: 1,
        pageSize: 26,
        totalItems: 0,
        totalPages: 0,
        region: { region: "attention", availability: "available", retryable: true },
      }),
    ).toThrow();
  });

  test("accepts the ten Spec 010 attention event types and rejects unknown fields", () => {
    const types = [
      "incident",
      "payment",
      "import",
      "ai-provider",
      "queue",
      "security",
      "account-deletion",
      "support",
      "admin-governance",
      "settings",
    ] as const;
    expect(types).toHaveLength(10);
    for (const type of types) {
      expect(attentionItemSchema.safeParse({ ...baseAttentionItem, type }).success).toBe(true);
    }
    expect(attentionItemSchema.safeParse({ ...baseAttentionItem, type: "settings", unsafe: true }).success).toBe(false);
  });
});
