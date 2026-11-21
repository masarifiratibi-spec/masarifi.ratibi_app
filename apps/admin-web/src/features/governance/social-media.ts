import { z } from "zod";
import { apiClient } from "@/core/api/client";
import { phase13MutationResultSchema } from "./contracts";

const accountLink = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) =>
        value === "" || (!/[\s\\]/u.test(value) && pattern.test(value)),
    );
export const socialMediaLinksSchema = z
  .object({
    instagram: accountLink(
      /^https:\/\/(?:www\.)?instagram\.com\/[a-z0-9._]+\/?(?:[?#][^\s\\]*)?$/iu,
    ),
    tiktok: accountLink(
      /^https:\/\/(?:www\.)?tiktok\.com\/@[a-z0-9._]+\/?(?:[?#][^\s\\]*)?$/iu,
    ),
    snapchat: accountLink(
      /^https:\/\/(?:www\.)?snapchat\.com\/(?:add\/|@)[a-z0-9._-]+\/?(?:[?#][^\s\\]*)?$/iu,
    ),
  })
  .strict();
export type SocialMediaLinks = z.infer<typeof socialMediaLinksSchema>;
const settingSchema = z
  .object({
    key: z.literal("mobile.social_links"),
    value: socialMediaLinksSchema,
    sensitivity: z.literal("public"),
    redacted: z.literal(false),
    version: z.number().int().positive(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type SocialMediaSetting = z.infer<typeof settingSchema>;

export const socialMediaRepository = {
  read: (signal?: AbortSignal) =>
    apiClient.get("/api/v1/admin/settings/mobile.social_links", settingSchema, {
      signal,
    }),
  save: (value: SocialMediaLinks, expectedVersion: number, reason: string) =>
    apiClient.patch(
      "/api/v1/admin/settings/mobile.social_links",
      { value: socialMediaLinksSchema.parse(value), expectedVersion, reason },
      phase13MutationResultSchema,
    ),
};
