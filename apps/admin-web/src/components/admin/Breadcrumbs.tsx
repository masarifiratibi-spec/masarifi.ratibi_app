"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/core/localization/direction";

const labels = {
  ar: {
    "/admin": "نظرة عامة",
    "/admin/users": "المستخدمون",
    "/admin/imports": "الاستيراد والمعاملات",
    "/admin/system-health": "صحة النظام",
    "/admin/system-health/api": "مراقبة API",
    "/admin/system-health/database": "مراقبة قاعدة البيانات",
    "/admin/system-health/storage": "مراقبة التخزين",
    "/admin/system-health/providers": "صحة المزودين",
    "/admin/jobs/queues": "قوائم الانتظار",
    "/admin/jobs/runs": "تشغيلات المهام",
    "/admin/jobs/scheduled": "المهام المجدولة",
    "/admin/admin-team": "فريق الإدارة",
    "/admin/admin-team/invite": "دعوة مسؤول",
    "/admin/roles": "الأدوار والصلاحيات",
    "/admin/roles/new": "دور جديد",
    "/admin/roles/permissions": "مصفوفة الصلاحيات",
    "/admin/settings": "إعدادات النظام",
    "/admin/settings/mobile": "إعدادات الجوال",
    "/admin/settings/feature-flags": "الأعلام التجريبية",
    "/admin/settings/imports": "إعدادات الاستيراد",
    "/admin/settings/ai": "إعدادات الذكاء الاصطناعي",
    "/admin/settings/subscriptions": "إعدادات الاشتراكات",
    "/admin/settings/security": "إعدادات الأمان",
    "/admin/settings/maintenance": "الصيانة",
  },
  en: {
    "/admin": "Overview",
    "/admin/users": "Users",
    "/admin/imports": "Imports",
    "/admin/system-health": "System Health",
    "/admin/system-health/api": "API Monitoring",
    "/admin/system-health/database": "Database Monitoring",
    "/admin/system-health/storage": "Storage Monitoring",
    "/admin/system-health/providers": "Provider Health",
    "/admin/jobs/queues": "Queues",
    "/admin/jobs/runs": "Job Runs",
    "/admin/jobs/scheduled": "Scheduled Jobs",
    "/admin/admin-team": "Admin Team",
    "/admin/admin-team/invite": "Invite Admin",
    "/admin/roles": "Roles and Permissions",
    "/admin/roles/new": "New Role",
    "/admin/roles/permissions": "Permission Matrix",
    "/admin/settings": "System Settings",
    "/admin/settings/mobile": "Mobile Settings",
    "/admin/settings/feature-flags": "Feature Flags",
    "/admin/settings/imports": "Import Settings",
    "/admin/settings/ai": "AI Settings",
    "/admin/settings/subscriptions": "Subscription Settings",
    "/admin/settings/security": "Security Settings",
    "/admin/settings/maintenance": "Maintenance",
  },
} as const;

export function Breadcrumbs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const jobRunDetailLabel = locale === "ar" ? "تفاصيل تشغيل المهمة" : "Job Run Detail";
  const adminDetailLabel = locale === "ar" ? "ملف مسؤول" : "Admin Profile";
  const roleDetailLabel = locale === "ar" ? "تفاصيل الدور" : "Role Detail";
  const roleEditLabel = locale === "ar" ? "تعديل الدور" : "Edit Role";
  const label = /^\/admin\/jobs\/runs\/JOB-[A-Za-z0-9-]+$/.test(pathname)
    ? jobRunDetailLabel
    : /^\/admin\/admin-team\/ADM-[A-Z0-9-]{3,64}$/.test(pathname)
      ? adminDetailLabel
      : /^\/admin\/roles\/ROLE-[A-Z0-9-]{3,64}\/edit$/.test(pathname)
        ? roleEditLabel
        : /^\/admin\/roles\/ROLE-[A-Z0-9-]{3,64}$/.test(pathname)
          ? roleDetailLabel
    : labels[locale][pathname as keyof (typeof labels)[typeof locale]] ?? pathname;
  return (
    <nav className="breadcrumbs" aria-label={locale === "ar" ? "مسار الصفحة" : "Breadcrumb"}>
      <Link href="/admin">{locale === "ar" ? "المنصة" : "Platform"}</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{label}</span>
    </nav>
  );
}
