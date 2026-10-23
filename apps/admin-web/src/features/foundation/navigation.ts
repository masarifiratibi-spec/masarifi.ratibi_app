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
        id: "ai-usage-limits",
        labelKey: "AI Usage Limits",
        route: "/admin/system-health/ai-usage-limits",
        iconKey: "settings",
        permission: "operations.settings.read",
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
        id: "social-media",
        labelKey: "السوشيال ميديا",
        route: "/admin/social-media",
        iconKey: "globe",
        permission: "operations.settings.read",
        availability: "active",
      },
      {
        id: "security",
        labelKey: "الأمان",
        route: "/admin/security",
        iconKey: "shield-check",
        permission: "security.events.read",
        availability: "active",
      },
      { id: "audit-logs", labelKey: "Audit logs", route: "/admin/audit", iconKey: "shield-check", permission: "audit.logs.read", availability: "active" },
      { id: "data-exports", labelKey: "Data exports", route: "/admin/data-requests/exports", iconKey: "database", permission: "data_requests.exports.read", availability: "active" },
      { id: "data-deletions", labelKey: "Account deletion", route: "/admin/data-requests/deletions", iconKey: "database", permission: "data_requests.deletions.read", availability: "active" },
      { id: "data-retention", labelKey: "Data retention", route: "/admin/data-requests/retention", iconKey: "database", permission: "data_retention.read", availability: "active" },
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
  const platform = LIVE_ADMIN_NAVIGATION.find((group) => group.id === "platform");
  const operations = LIVE_ADMIN_NAVIGATION.find((group) => group.id === "operations");
  const governance = LIVE_ADMIN_NAVIGATION.find((group) => group.id === "governance");
  if (!platform || !operations || !governance) throw new Error("Navigation configuration is incomplete");
  return [
    { ...platform, items: platform.items.filter((item) => item.id === "overview") },
    { id: "customers", labelKey: "Customers and support", items: [
      { id: "users", labelKey: "Customers", route: "/admin/users", iconKey: "users", permission: "users.read", availability: "active" },
      { id: "support-overview", labelKey: "Support overview", route: "/admin/support", iconKey: "activity", permission: "support.overview.read", availability: "active" },
      { id: "support-tickets", labelKey: "Support tickets", route: "/admin/support/tickets", iconKey: "activity", permission: "support.tickets.read", availability: "active" },
      { id: "support-categories", labelKey: "Support categories", route: "/admin/support/categories", iconKey: "database", permission: "support.categories.read", availability: "active" },
      { id: "access-requests", labelKey: "Support access requests", route: "/admin/access-requests", iconKey: "shield-check", permission: "support.access.read", availability: "active" },
    ] },
    operations,
    { id: "health", labelKey: "System Health", items: platform.items.filter((item) => item.id !== "overview") },
    governance,
  ];
}

export function permittedNavigation(groups: NavigationGroup[], permissions: ReadonlySet<string>): NavigationGroup[] {
  return groups.map((group) => ({ ...group, items: group.items.filter((item) =>
    item.availability === "active" && (!item.permission || permissions.has(item.permission))) }))
    .filter((group) => group.items.length > 0);
}
