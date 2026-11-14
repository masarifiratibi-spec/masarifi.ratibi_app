import { z } from 'zod';

const smsId = z
  .string()
  .regex(/^\d{1,19}$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
export const trackingInstallationSourcesSchema = z
  .object({
    smsEnabled: z.boolean(),
    notificationEnabled: z.boolean(),
    smsActivatedAt: z.string().datetime({ offset: true }).nullable(),
    smsActivationId: smsId.nullable(),
    notificationActivatedAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
  .refine((value) =>
    value.smsEnabled
      ? value.smsActivatedAt !== null && value.smsActivationId !== null
      : value.smsActivatedAt === null && value.smsActivationId === null
  )
  .refine((value) =>
    value.notificationEnabled
      ? value.notificationActivatedAt !== null
      : value.notificationActivatedAt === null
  );

export const trackingInstallationReceiptSchema = z
  .object({
    deviceId: z.string().uuid(),
    version: z.number().int().min(1).max(2147483647),
    generation: z.string().uuid(),
    sessionBinding: z.string().regex(/^[a-f0-9]{64}$/),
    sources: trackingInstallationSourcesSchema,
    captureAllowed: z.boolean()
  })
  .strict()
  .refine(
    (value) =>
      !value.captureAllowed ||
      value.sources.smsEnabled ||
      value.sources.notificationEnabled
  );
export type TrackingInstallationReceipt = z.infer<
  typeof trackingInstallationReceiptSchema
>;
export type TrackingInstallationSources = z.infer<
  typeof trackingInstallationSourcesSchema
>;
