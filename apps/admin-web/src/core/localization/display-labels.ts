import type { AdminRole } from "@/core/permissions/permissions";
import type { Locale } from "./direction";

const labels = {
  status: {
    active: { ar: "نشط", en: "Active" },
    disabled: { ar: "معطل", en: "Disabled" },
    pending: { ar: "معلق", en: "Pending" },
    suspended: { ar: "موقوف", en: "Suspended" },
    ready: { ar: "جاهز", en: "Ready" },
    success: { ar: "نجاح", en: "Success" },
    failed: { ar: "فشل", en: "Failed" },
    expired: { ar: "منتهي", en: "Expired" },
    revoked: { ar: "ملغي", en: "Revoked" },
    verified: { ar: "موثق", en: "Verified" },
    draft: { ar: "مسودة", en: "Draft" },
    trialing: { ar: "تجريبي", en: "Trialing" },
    past_due: { ar: "متأخر", en: "Past due" },
    cancel_at_period_end: { ar: "إلغاء بنهاية الفترة", en: "Cancel at period end" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
    paid: { ar: "مدفوع", en: "Paid" },
    unpaid: { ar: "غير مدفوع", en: "Unpaid" },
    refunded: { ar: "مسترد", en: "Refunded" },
    processed: { ar: "معالج", en: "Processed" },
    reviewed: { ar: "تمت المراجعة", en: "Reviewed" },
    recovered: { ar: "متعاف", en: "Recovered" },
    open: { ar: "مفتوح", en: "Open" },
    reviewing: { ar: "قيد المراجعة", en: "Reviewing" },
    resolved: { ar: "محلول", en: "Resolved" },
    blocked: { ar: "محظور", en: "Blocked" },
    fresh: { ar: "حديث", en: "Fresh" },
    retry_handoff_prepared: { ar: "تم تحضير تسليم الإعادة", en: "Retry handoff prepared" },
    customer_contact_handoff: { ar: "تسليم تواصل العميل", en: "Customer contact handoff" },
    provider_recovered: { ar: "تعافى المزود", en: "Provider recovered" },
    processing: { ar: "قيد المعالجة", en: "Processing" },
    validating: { ar: "قيد التحقق", en: "Validating" },
    completed: { ar: "مكتمل", en: "Completed" },
    preserved: { ar: "محفوظ", en: "Preserved" },
    clear: { ar: "واضح", en: "Clear" },
    no_file: { ar: "لا يوجد ملف", en: "No file" },
    new: { ar: "جديد", en: "New" },
    investigating: { ar: "قيد التحقيق", en: "Investigating" },
    escalated: { ar: "مصعد", en: "Escalated" },
    dismissed: { ar: "مرفوض", en: "Dismissed" },
    operational: { ar: "يعمل", en: "Operational" },
    degraded: { ar: "متراجع", en: "Degraded" },
    "partial-outage": { ar: "انقطاع جزئي", en: "Partial outage" },
    "major-outage": { ar: "انقطاع رئيسي", en: "Major outage" },
    maintenance: { ar: "صيانة", en: "Maintenance" },
    available: { ar: "متاح", en: "Available" },
    stale: { ar: "قديم", en: "Stale" },
    partial: { ar: "جزئي", en: "Partial" },
    unavailable: { ar: "غير متاح", en: "Unavailable" },
    forbidden: { ar: "غير مصرح", en: "Forbidden" },
    system: { ar: "نظام", en: "System" },
    custom: { ar: "مخصص", en: "Custom" },
  },
  severity: {
    info: { ar: "معلومة", en: "Info" },
    low: { ar: "منخفض", en: "Low" },
    medium: { ar: "متوسط", en: "Medium" },
    high: { ar: "مرتفع", en: "High" },
    critical: { ar: "حرج", en: "Critical" },
  },
  role: {
    "super-admin": { ar: "المسؤول الأعلى", en: "Super Admin" },
    "support-agent": { ar: "وكيل الدعم", en: "Support Agent" },
    "billing-operator": { ar: "مشغل الفوترة", en: "Billing Operator" },
    "import-operator": { ar: "مشغل الاستيراد", en: "Import Operator" },
    "ai-operator": { ar: "مشغل الذكاء الاصطناعي", en: "AI Operator" },
    "content-manager": { ar: "مدير المحتوى", en: "Content Manager" },
    "security-administrator": { ar: "مسؤول الأمن", en: "Security Administrator" },
  } satisfies Record<AdminRole, Record<Locale, string>>,
  environment: {
    production: { ar: "الإنتاج", en: "Production" },
    staging: { ar: "الاختبار", en: "Staging" },
    development: { ar: "التطوير", en: "Development" },
  },
  action: {
    "security.incident.updated": { ar: "تم تحديث حادث أمني", en: "Security incident updated" },
    "admin.role.created": { ar: "تم إنشاء دور إداري", en: "Admin role created" },
    "settings.updated": { ar: "تم تحديث الإعدادات", en: "Settings updated" },
    change_plan: { ar: "تغيير الخطة", en: "Change plan" },
    set_cancel_at_period_end: { ar: "إلغاء بنهاية الفترة", en: "Cancel at period end" },
    clear_cancel_at_period_end: { ar: "إزالة الإلغاء المجدول", en: "Clear scheduled cancellation" },
    resume: { ar: "استئناف الاشتراك", en: "Resume subscription" },
    record_internal_note: { ar: "ملاحظة داخلية", en: "Internal note" },
    mark_reviewed: { ar: "تمييز كمراجع", en: "Mark reviewed" },
    prepare_retry_handoff: { ar: "تحضير تسليم إعادة المحاولة", en: "Prepare retry handoff" },
    record_customer_contact_handoff: { ar: "تسليم تواصل العميل", en: "Record customer contact handoff" },
    mark_provider_recovered: { ar: "تعليم تعافي المزود", en: "Mark provider recovered" },
    mark_reviewing: { ar: "تمييز كقيد المراجعة", en: "Mark reviewing" },
    accept_internal: { ar: "قبول الحالة الداخلية", en: "Accept internal" },
    accept_provider: { ar: "قبول حالة المزود", en: "Accept provider" },
    defer: { ar: "تأجيل", en: "Defer" },
    mark_resolved: { ar: "تمييز كمحلول", en: "Mark resolved" },
    assign_reviewer: { ar: "تعيين مراجع", en: "Assign reviewer" },
    revoke: { ar: "إلغاء الوصول", en: "Revoke access" },
  },
} as const;

const planLabels: Record<string, Record<Locale, string>> = {
  Free: { ar: "مجاني", en: "Free" },
  Basic: { ar: "أساسي", en: "Basic" },
  Premium: { ar: "مميز", en: "Premium" },
  free: { ar: "مجاني", en: "Free" },
  basic: { ar: "أساسي", en: "Basic" },
  premium: { ar: "مميز", en: "Premium" },
};

const platformLabels: Record<string, Record<Locale, string>> = {
  all: { ar: "كل المنصات", en: "All platforms" },
  ios: { ar: "iOS", en: "iOS" },
  android: { ar: "Android", en: "Android" },
  multi: { ar: "متعدد المنصات", en: "Multi-platform" },
  multi_platform: { ar: "متعدد المنصات", en: "Multi-platform" },
  unattributed: { ar: "غير منسوب", en: "Unattributed" },
};

const countryLabels: Record<string, Record<Locale, string>> = {
  SA: { ar: "السعودية", en: "Saudi Arabia" },
  AE: { ar: "الإمارات", en: "United Arab Emirates" },
};

const languageLabels: Record<string, Record<Locale, string>> = {
  ar: { ar: "العربية", en: "Arabic" },
  en: { ar: "الإنجليزية", en: "English" },
};

const periodLabels: Record<string, Record<Locale, string>> = {
  "7d": { ar: "آخر 7 أيام", en: "Last 7 days" },
  "30d": { ar: "آخر 30 يوما", en: "Last 30 days" },
  "90d": { ar: "آخر 90 يوما", en: "Last 90 days" },
};

const navigationLabels: Record<string, Record<Locale, string>> = {
  platform: { ar: "المنصة", en: "Platform" },
  overview: { ar: "نظرة عامة", en: "Overview" },
  health: { ar: "صحة النظام", en: "System Health" },
  "health-api": { ar: "مراقبة API", en: "API Monitoring" },
  "health-database": { ar: "مراقبة قاعدة البيانات", en: "Database Monitoring" },
  "health-storage": { ar: "مراقبة التخزين", en: "Storage Monitoring" },
  "health-providers": { ar: "صحة المزودين", en: "Provider Health" },
  "system-health": { ar: "صحة النظام", en: "System Health" },
  "jobs-and-queues": { ar: "المهام وقوائم الانتظار", en: "Jobs and Queues" },
  jobs: { ar: "قوائم الانتظار", en: "Queue Overview" },
  "job-runs": { ar: "تشغيلات المهام", en: "Job Runs" },
  "scheduled-jobs": { ar: "المهام المجدولة", en: "Scheduled Jobs" },
  customers: { ar: "العملاء والإيرادات", en: "Customers and Revenue" },
  users: { ar: "المستخدمون", en: "Users" },
  "access-requests": { ar: "طلبات الوصول", en: "Access Requests" },
  subscriptions: { ar: "الاشتراكات", en: "Subscriptions" },
  payments: { ar: "المدفوعات", en: "Payments" },
  operations: { ar: "العمليات", en: "Operations" },
  imports: { ar: "الاستيراد والمعاملات", en: "Imports and Transactions" },
  parsers: { ar: "البنوك المدعومة", en: "Supported Banks" },
  ai: { ar: "إدارة الذكاء الاصطناعي", en: "AI Management" },
  communications: { ar: "التواصل والمحتوى", en: "Communications" },
  "communications-support": { ar: "الدعم", en: "Support" },
  "communications-feedback": { ar: "الملاحظات", en: "Feedback" },
  "communications-content": { ar: "المحتوى", en: "Content" },
  "communications-notifications": { ar: "الإشعارات", en: "Notifications" },
  governance: { ar: "الحوكمة", en: "Governance" },
  security: { ar: "الأمن", en: "Security" },
  "audit-logs": { ar: "سجلات التدقيق", en: "Audit Logs" },
  "data-requests": { ar: "طلبات البيانات", en: "Data Requests" },
  "admin-team": { ar: "فريق الإدارة", en: "Admin Team" },
  roles: { ar: "الأدوار والصلاحيات", en: "Roles and Permissions" },
  settings: { ar: "إعدادات النظام", en: "System Settings" },
};

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getLabel(group: keyof typeof labels, locale: Locale, value: string): string {
  const next = labels[group][value as keyof (typeof labels)[typeof group]];
  return next?.[locale] ?? titleize(value);
}

export function getStatusLabel(locale: Locale, value: string): string {
  return getLabel("status", locale, value);
}

export function getSeverityLabel(locale: Locale, value: string): string {
  return getLabel("severity", locale, value);
}

export function getRoleLabel(locale: Locale, value: AdminRole | string): string {
  return getLabel("role", locale, value);
}

export function getEnvironmentLabel(locale: Locale, value: string): string {
  return getLabel("environment", locale, value);
}

export function getActionLabel(locale: Locale, value: string): string {
  return getLabel("action", locale, value);
}

export function getPlanLabel(locale: Locale, value: string): string {
  return planLabels[value]?.[locale] ?? titleize(value);
}

export function getPlatformLabel(locale: Locale, value: string): string {
  return platformLabels[value]?.[locale] ?? titleize(value);
}

export function getCountryLabel(locale: Locale, value: string): string {
  return countryLabels[value]?.[locale] ?? value;
}

export function getLanguageLabel(locale: Locale, value: string): string {
  return languageLabels[value]?.[locale] ?? titleize(value);
}

export function getPeriodLabel(locale: Locale, value: string): string {
  return periodLabels[value]?.[locale] ?? value;
}

export function getNavigationLabel(locale: Locale, id: string, fallback: string): string {
  return navigationLabels[id]?.[locale] ?? fallback;
}
