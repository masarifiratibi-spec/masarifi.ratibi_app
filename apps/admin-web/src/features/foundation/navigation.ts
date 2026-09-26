import type { NavigationGroup } from "./contracts";

const LIVE_ADMIN_NAVIGATION: NavigationGroup[] = [
  {
    id: "platform",
    labelKey: "المنصة",
    items: [
      {
        id: "overview",
        labelKey: "نظرة عامة",
        route: "/admin",
        iconKey: "layout-dashboard",
        permission: "admin.overview.read",
        availability: "active",
      },
      {
        id: "health",
        labelKey: "صحة النظام",
        route: "/admin/system-health",
        iconKey: "heart-pulse",
        permission: "system-health.read",
        availability: "active",
      },
      {
        id: "health-api",
        labelKey: "API Monitoring",
        route: "/admin/system-health/api",
        iconKey: "activity",
        permission: "system-health.api.read",
        availability: "active",
      },
      {
        id: "health-database",
        labelKey: "Database Monitoring",
        route: "/admin/system-health/database",
        iconKey: "database",
        permission: "system-health.database.read",
        availability: "active",
      },
      {
        id: "health-storage",
        labelKey: "Storage Monitoring",
        route: "/admin/system-health/storage",
        iconKey: "database",
        permission: "system-health.storage.read",
        availability: "active",
      },
      {
        id: "health-providers",
        labelKey: "Provider Health",
        route: "/admin/system-health/providers",
        iconKey: "activity",
        permission: "system-health.providers.read",
        availability: "active",
      },
      {
        id: "jobs",
        labelKey: "المهام وقوائم الانتظار",
        route: "/admin/jobs/queues",
        iconKey: "activity",
        permission: "jobs.queues.read",
        availability: "active",
      },
      {
        id: "job-runs",
        labelKey: "Job Runs",
        route: "/admin/jobs/runs",
        iconKey: "activity",
        permission: "jobs.runs.read",
        availability: "active",
      },
      {
        id: "scheduled-jobs",
        labelKey: "Scheduled Jobs",
        route: "/admin/jobs/scheduled",
        iconKey: "activity",
        permission: "jobs.schedules.read",
        availability: "active",
      },
    ],
  },
  {
    id: "operations",
    labelKey: "العمليات",
    items: [
      {
        id: "imports",
        labelKey: "الاستيراد والمعاملات",
        route: "/admin/imports",
        iconKey: "file-input",
        permission: "imports.read",
        availability: "active",
      },
      {
        id: "parsers",
        labelKey: "إدارة المحللات",
        route: "/admin/parsers/banks",
        iconKey: "database",
        permission: "parsers.coverage.read",
        availability: "active",
      },
      {
        id: "ai",
        labelKey: "إدارة الذكاء الاصطناعي",
        route: "/admin/ai",
        iconKey: "activity",
        permission: "ai.overview.read",
        availability: "active",
      },
    ],
  },
  {
    id: "governance",
    labelKey: "الحوكمة",
    items: [
      {
        id: "security",
        labelKey: "الأمان",
        route: "/admin/security",
        iconKey: "shield-check",
        permission: "security.events.read",
        availability: "active",
      },
      {
        id: "admin-team",
        labelKey: "Admin Team",
        route: "/admin/admin-team",
        iconKey: "users",
        permission: "admin-team.read",
        availability: "active",
      },
      {
        id: "roles",
        labelKey: "Roles and Permissions",
        route: "/admin/roles",
        iconKey: "shield-check",
        permission: "roles.read",
        availability: "active",
      },
      {
        id: "settings",
        labelKey: "System Settings",
        route: "/admin/settings",
        iconKey: "settings",
        permission: "settings.general.read",
        availability: "active",
      },
    ],
  },
];

export function getLiveNavigation(): NavigationGroup[] {
  return LIVE_ADMIN_NAVIGATION;
}
