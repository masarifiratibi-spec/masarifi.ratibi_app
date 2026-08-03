import { describe, expect, test } from "vitest";
import {
  PERMISSION_KEYS,
  type AdminRole,
  type PermissionKey,
} from "./permissions";
import { hasPermission } from "./role-map";

const PHASE6_PERMISSIONS: PermissionKey[] = [
  "support.tickets.read",
  "support.tickets.detail.read",
  "support.tickets.assign",
  "support.tickets.priority",
  "support.tickets.reply",
  "support.tickets.notes",
  "support.tickets.resolve",
  "support.categories.read",
  "support.categories.manage",
  "feedback.overview.read",
  "feedback.items.read",
  "feedback.items.detail.read",
  "feedback.items.link",
  "feedback.items.manage",
  "abuse.overview.read",
  "abuse.reports.read",
  "abuse.reports.detail.read",
  "abuse.reports.manage",
  "content.categories.read",
  "content.categories.manage",
  "content.tips.read",
  "content.tips.manage",
  "content.faqs.read",
  "content.faqs.manage",
  "content.onboarding.read",
  "content.onboarding.manage",
  "content.help_center.read",
  "content.help_center.manage",
  "content.announcements.read",
  "content.announcements.manage",
  "templates.email.read",
  "templates.email.manage",
  "templates.push.read",
  "templates.push.manage",
  "templates.transactional.read",
  "notifications.overview.read",
  "notifications.campaigns.read",
  "notifications.campaigns.detail.read",
  "notifications.campaigns.manage",
  "notifications.audience.preview",
  "notifications.delivery.read",
];

describe("Phase 6 permissions matrix", () => {
  test("all 42 Phase 6 permission keys exist in PERMISSION_KEYS", () => {
    for (const permission of PHASE6_PERMISSIONS) {
      expect(PERMISSION_KEYS).toContain(permission);
    }
  });

  test("Super Admin has all Phase 6 permissions", () => {
    for (const permission of PHASE6_PERMISSIONS) {
      expect(hasPermission("super-admin", permission)).toBe(true);
    }
  });

  test("Security Administrator has restricted abuse and all other Phase 6 permissions except content/template/campaign", () => {
    const restrictedAbusePermissions = [
      "abuse.reports.read",
      "abuse.reports.detail.read",
      "abuse.reports.manage",
    ] as PermissionKey[];

    const deniedPermissions = [
      "content.categories.manage",
      "content.tips.manage",
      "content.faqs.manage",
      "content.onboarding.manage",
      "content.help_center.manage",
      "content.announcements.manage",
      "templates.email.manage",
      "templates.push.manage",
      "notifications.campaigns.manage",
      "notifications.audience.preview",
    ] as PermissionKey[];

    for (const permission of restrictedAbusePermissions) {
      expect(hasPermission("security-administrator", permission)).toBe(true);
    }

    for (const permission of deniedPermissions) {
      expect(hasPermission("security-administrator", permission)).toBe(false);
    }
  });

  test("Support Agent has support and feedback permissions, linked delivery context only", () => {
    const allowedSupportPermissions = [
      "support.tickets.read",
      "support.tickets.detail.read",
      "support.tickets.assign",
      "support.tickets.priority",
      "support.tickets.reply",
      "support.tickets.notes",
      "support.tickets.resolve",
      "support.categories.read",
      "support.categories.manage",
      "feedback.overview.read",
      "feedback.items.read",
      "feedback.items.detail.read",
      "feedback.items.link",
      "feedback.items.manage",
      "notifications.delivery.read",
    ] as PermissionKey[];

    const deniedPermissions = [
      "abuse.reports.read",
      "abuse.reports.detail.read",
      "abuse.reports.manage",
      "content.categories.manage",
      "content.tips.manage",
      "content.faqs.manage",
      "content.onboarding.manage",
      "content.help_center.manage",
      "content.announcements.manage",
      "templates.email.manage",
      "templates.push.manage",
      "notifications.campaigns.manage",
      "notifications.audience.preview",
    ] as PermissionKey[];

    for (const permission of allowedSupportPermissions) {
      expect(hasPermission("support-agent", permission)).toBe(true);
    }

    for (const permission of deniedPermissions) {
      expect(hasPermission("support-agent", permission)).toBe(false);
    }
  });

  test("Content Manager has content/templates/campaigns and aggregate feedback/support context", () => {
    const allowedContentPermissions = [
      "content.categories.read",
      "content.categories.manage",
      "content.tips.read",
      "content.tips.manage",
      "content.faqs.read",
      "content.faqs.manage",
      "content.onboarding.read",
      "content.onboarding.manage",
      "content.help_center.read",
      "content.help_center.manage",
      "content.announcements.read",
      "content.announcements.manage",
      "templates.email.read",
      "templates.email.manage",
      "templates.push.read",
      "templates.push.manage",
      "templates.transactional.read",
      "notifications.overview.read",
      "notifications.campaigns.read",
      "notifications.campaigns.detail.read",
      "notifications.campaigns.manage",
      "notifications.audience.preview",
      "feedback.overview.read",
      "support.overview.read",
    ] as PermissionKey[];

    const deniedPermissions = [
      "support.tickets.read",
      "support.tickets.detail.read",
      "abuse.reports.read",
      "abuse.reports.detail.read",
      "abuse.reports.manage",
    ] as PermissionKey[];

    for (const permission of allowedContentPermissions) {
      expect(hasPermission("content-manager", permission)).toBe(true);
    }

    for (const permission of deniedPermissions) {
      expect(hasPermission("content-manager", permission)).toBe(false);
    }
  });

  test("Billing, Import, and AI operators have no general Phase 6 routes", () => {
    const noAccessRoles: AdminRole[] = [
      "billing-operator",
      "import-operator",
      "ai-operator",
    ];

    for (const role of noAccessRoles) {
      for (const permission of PHASE6_PERMISSIONS) {
        expect(hasPermission(role, permission)).toBe(false);
      }
    }
  });
});
