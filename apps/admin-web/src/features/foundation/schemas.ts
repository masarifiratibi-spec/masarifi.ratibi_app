import { z } from "zod";
import {
  directionSchema,
  environmentSchema,
  identifierSchema,
  isoDateSchema,
  localeSchema,
  paginationSchema,
  platformFilterSchema,
  routeSchema,
  searchTextSchema,
  themeSchema,
} from "@/core/validation/common";
import { ADMIN_ROLES, PERMISSION_KEYS } from "@/core/permissions/permissions";

export const adminRoleSchema = z.enum(ADMIN_ROLES);
export const permissionKeySchema = z.enum(PERMISSION_KEYS);

export const adminSessionSchema = z.object({
  adminId: identifierSchema,
  displayName: z.string().trim().min(1).max(100),
  role: adminRoleSchema,
  permissions: z.array(permissionKeySchema),
  environment: environmentSchema,
  locale: localeSchema,
  direction: directionSchema,
  theme: themeSchema,
  expiresAt: isoDateSchema,
  developmentOnly: z.literal(true),
});

export const platformOptionSchema = z.object({
  value: platformFilterSchema,
  labelKey: z.string().min(1),
  isDefault: z.boolean(),
});

export const platformOptionsResponseSchema = z.object({
  options: z.array(platformOptionSchema).length(3).refine(
    (options) => options.filter((option) => option.isDefault).length === 1
      && options.find((option) => option.isDefault)?.value === "all",
    "Only the all-platform option may be the default.",
  ),
});

export const platformBreakdownSchema = z.object({
  total: z.number().nonnegative(),
  ios: z.number().nonnegative(),
  android: z.number().nonnegative(),
  multiPlatformCustomers: z.number().nonnegative().optional(),
  metricKind: z.enum(["unique-customers", "devices", "events"]),
}).superRefine((value, context) => {
  if (value.metricKind === "unique-customers" && value.total > value.ios + value.android) {
    context.addIssue({
      code: "custom",
      message: "Deduplicated customer total cannot exceed platform counts.",
    });
  }
});

export const navigationItemSchema = z.object({
  id: identifierSchema,
  labelKey: z.string().min(1),
  route: routeSchema.nullable().optional(),
  iconKey: z.string().min(1),
  permission: permissionKeySchema.nullable().optional(),
  availability: z.enum(["active", "planned", "denied"]),
  attentionCount: z.number().int().nonnegative().optional(),
});

export const navigationGroupSchema = z.object({
  id: identifierSchema,
  labelKey: z.string().min(1),
  items: z.array(navigationItemSchema),
});

export const navigationResponseSchema = z.object({
  groups: z.array(navigationGroupSchema),
});

export const attentionItemSchema = z.object({
  id: identifierSchema,
  type: z.enum([
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
  ]),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  summary: z.string().min(1).max(240),
  occurredAt: isoDateSchema,
  platformScope: z.enum(["all", "ios", "android", "global", "unknown"]),
  permission: permissionKeySchema,
  destination: routeSchema.optional(),
}).strict();

export const attentionRegionSchema = z.object({
  region: z.literal("attention"),
  availability: z.enum(["available", "empty", "stale", "partial", "unavailable", "forbidden"]),
  message: z.string().min(1).max(240).optional(),
  lastSuccessfulAt: isoDateSchema.optional(),
  retryable: z.boolean(),
});

export const attentionQuerySchema = paginationSchema.extend({
  role: adminRoleSchema.optional(),
  platform: platformFilterSchema.optional(),
  period: z.enum(["7d", "30d", "90d"]).optional(),
  locale: localeSchema.optional(),
  scenario: z.string().min(1).max(50).optional(),
});

export const attentionResponseSchema = z.object({
  items: z.array(attentionItemSchema).max(25),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(25),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().min(0),
  region: attentionRegionSchema,
});

export const searchEntitySchema = z.enum([
  "navigation",
  "user",
  "subscription",
  "payment_event",
  "import",
  "support_ticket",
  "audit_event",
  "job",
  "parser_rule",
  "bank",
  "admin_user",
]);
export const globalSearchQuerySchema = paginationSchema.extend({
  query: searchTextSchema.pipe(z.string().min(2)),
  entityTypes: z.array(searchEntitySchema).optional(),
  platform: platformFilterSchema.optional(),
});

export const globalSearchResultSchema = z.object({
  id: identifierSchema,
  entityType: searchEntitySchema,
  primaryLabel: z.string().min(1),
  secondaryLabel: z.string().optional(),
  route: routeSchema,
  permission: permissionKeySchema,
});

export const globalSearchResponseSchema = z.object({
  items: z.array(globalSearchResultSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const dateRangeSchema = z.object({
  start: z.iso.date(),
  end: z.iso.date(),
  preset: z.enum(["7d", "30d", "90d", "custom"]),
}).refine((value) => value.start <= value.end, {
  message: "يجب ألا يسبق تاريخ النهاية تاريخ البداية.",
  path: ["end"],
});

export function safeResponseSchema<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    partial: z.boolean().optional(),
    warning: z.string().optional(),
  });
}
