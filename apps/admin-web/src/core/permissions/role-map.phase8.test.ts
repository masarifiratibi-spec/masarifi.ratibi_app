import { describe, expect, test } from "vitest";
import { PERMISSION_KEYS, type AdminRole } from "./permissions";
import { hasPermission } from "./role-map";

const PHASE8_PERMISSIONS = [
  "system-health.api.read",
  "system-health.database.read",
  "system-health.storage.read",
  "system-health.providers.read",
  "jobs.queues.read",
  "jobs.runs.read",
  "jobs.runs.retry",
  "jobs.runs.cancel",
  "jobs.schedules.read",
] as const;

const READ_PERMISSIONS = PHASE8_PERMISSIONS.filter(
  (permission) => permission !== "jobs.runs.retry" && permission !== "jobs.runs.cancel",
);

const ROLE_EXPECTATIONS: Record<AdminRole, readonly string[]> = {
  "super-admin": PHASE8_PERMISSIONS,
  "security-administrator": READ_PERMISSIONS,
  "billing-operator": [
    "system-health.providers.read",
    "jobs.queues.read",
    "jobs.runs.read",
    "jobs.runs.retry",
    "jobs.schedules.read",
  ],
  "import-operator": [
    "system-health.providers.read",
    "jobs.queues.read",
    "jobs.runs.read",
    "jobs.runs.retry",
    "jobs.runs.cancel",
    "jobs.schedules.read",
  ],
  "ai-operator": [
    "system-health.providers.read",
    "jobs.queues.read",
    "jobs.runs.read",
    "jobs.runs.retry",
    "jobs.runs.cancel",
    "jobs.schedules.read",
  ],
  "content-manager": [
    "system-health.providers.read",
    "jobs.queues.read",
    "jobs.runs.read",
    "jobs.runs.retry",
    "jobs.runs.cancel",
    "jobs.schedules.read",
  ],
  "support-agent": [],
};

describe("Phase 8 permission matrix", () => {
  test("declares every System Health and Jobs permission key", () => {
    for (const permission of PHASE8_PERMISSIONS) {
      expect(PERMISSION_KEYS, `missing ${permission}`).toContain(permission);
    }
  });

  test.each(Object.entries(ROLE_EXPECTATIONS) as Array<[AdminRole, readonly string[]]>)(
    "%s receives only its direct Phase 8 permissions",
    (role, allowed) => {
      for (const permission of PHASE8_PERMISSIONS) {
        expect(hasPermission(role, permission), `${role} ${permission}`).toBe(allowed.includes(permission));
      }
    },
  );
});
