import { z } from 'zod';
import { requestJson } from './http-client';

const accountLink = (pattern: RegExp) =>
  z
    .string()
    .max(500)
    .refine(
      (value) => value === '' || (!/[\s\\]/u.test(value) && pattern.test(value))
    );
export const socialMediaLinksSchema = z
  .object({
    instagram: accountLink(
      /^https:\/\/(?:www\.)?instagram\.com\/[a-z0-9._]+\/?(?:[?#][^\s\\]*)?$/iu
    ),
    tiktok: accountLink(
      /^https:\/\/(?:www\.)?tiktok\.com\/@[a-z0-9._]+\/?(?:[?#][^\s\\]*)?$/iu
    ),
    snapchat: accountLink(
      /^https:\/\/(?:www\.)?snapchat\.com\/(?:add\/|@)[a-z0-9._-]+\/?(?:[?#][^\s\\]*)?$/iu
    )
  })
  .strict();
export type SocialMediaLinksValue = z.infer<typeof socialMediaLinksSchema>;

export function readSocialMediaLinks(signal?: AbortSignal) {
  return requestJson('/api/v1/meta/social-media', socialMediaLinksSchema, {
    signal
  });
}
