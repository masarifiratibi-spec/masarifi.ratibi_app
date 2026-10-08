import { z } from "zod";
import { apiClient } from "@/core/api/client";
import { phase13MutationResultSchema } from "./contracts";

export const aiUsageKeys = [
  "ai.user.rolling_limit", "ai.global.monthly_budget",
  "ai.chat.rolling_limit", "ai.chat.monthly_limit", "ai.chat.enabled", "ai.chat.user_override",
  "ai.voice.rolling_limit", "ai.voice.monthly_limit", "ai.voice.enabled", "ai.voice.user_override",
] as const;
export type AiUsageKey = typeof aiUsageKeys[number];
const count = z.number().int().nonnegative();
const timestamp = z.iso.datetime({ offset: true });
const feature = z.object({
  feature: z.enum(["chat", "voice"]), limit: count, monthlyLimit: count.nullable(), enabled: z.boolean(),
  override: z.object({ rollingLimit: count.nullable(), monthlyLimit: count.nullable() }).strict(),
  used: count, remaining: count, resetsAt: timestamp, windowHours: z.literal(24),
  monthlyUsed: count, monthlyRemaining: count.nullable(), monthlyResetsAt: timestamp,
  estimatedCostUsd: z.number().nonnegative(), routeEnabled: z.boolean(),
}).strict();
export const aiUsageSchema = z.object({
  userId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  settings: z.array(z.object({ key: z.enum(aiUsageKeys), value: z.json(), version: z.number().int().positive() }).strict()).length(10),
  features: z.array(feature).length(2).refine(items => new Set(items.map(item => item.feature)).size === 2),
  projectEstimatedCostUsd: z.number().nonnegative(), monthlyProjectResetsAt: timestamp,
  directReadsConsumeQuota: z.literal(false),
  history: z.array(z.object({ id: z.string(), key: z.enum(aiUsageKeys), at: timestamp, actorId: z.string(),
    reason: z.string().nullable(), before: z.string().nullable(), after: z.string().nullable() }).strict()).max(20),
}).strict();
export type AiUsage = z.infer<typeof aiUsageSchema>;

export function quotaValue(input: string, monthly: boolean): number | null {
  if (monthly && input.trim() === "") return null;
  if (!/^[1-9][0-9]*$/.test(input) || Number(input) > (monthly ? 1_000_000 : 1000))
    throw new Error("QUOTA_VALUE_INVALID");
  return Number(input);
}

export const aiUsageRepository = {
  read: (userId: string, signal?: AbortSignal) => apiClient.get(
    `/api/v1/admin/ai/usage-limits${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`, aiUsageSchema, { signal }),
  update: (key: AiUsageKey, value: unknown, expectedVersion: number, reason: string) => apiClient.patch(
    `/api/v1/admin/settings/${encodeURIComponent(key)}`, { value, expectedVersion, reason }, phase13MutationResultSchema),
};
