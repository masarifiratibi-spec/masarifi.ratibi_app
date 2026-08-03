"use client";

import Link from "next/link";
import { Crown, Download, FilterX, Gift, Info, Search, Star, UserRound } from "lucide-react";
import { useState } from "react";
import {
  Drawer,
  MetricCard,
  PageHeader,
  RegionState,
} from "@/components/admin/ui";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import {
  getCountryLabel,
  getLanguageLabel,
  getPlanLabel,
  getPlatformLabel,
  getSeverityLabel,
  getStatusLabel,
} from "@/core/localization/display-labels";
import { useLocale } from "@/core/localization/provider";
import {
  type AdminUserListItem,
  type AdminUsersQuery,
  type PlatformFilter,
} from "@/features/users/contracts";
import { useUsers } from "@/features/users/hooks";
import { UserBulkActions } from "@/features/users/UserActions";
import { formatDate } from "@/lib/admin-utils";

const userCopy = {
  ar: {
    eyebrow: "العملاء والإيرادات / المستخدمون",
    title: "إدارة المستخدمين",
    description: "اكتشاف الحسابات ومراجعة حالتها دون عرض بيانات مالية حساسة.",
    exportSummary: "تصدير الملخص",
    uniqueCustomers: "العملاء الفريدون",
    uniqueContext: "قيمة مستقلة عن مجموع المنصات",
    iosCustomers: "عملاء iOS",
    androidCustomers: "عملاء Android",
    multiPlatformCustomers: "متعددو المنصات",
    searchUsers: "بحث المستخدمين",
    searchPlaceholder: "الاسم، البريد المخفي، أو المعرف",
    platform: "المنصة",
    accountStatus: "حالة الحساب",
    allStatuses: "كل الحالات",
    plan: "الخطة",
    allPlans: "كل الخطط",
    country: "الدولة",
    allCountries: "كل الدول",
    language: "اللغة",
    allLanguages: "كل اللغات",
    verification: "التحقق",
    allVerification: "كل حالات التحقق",
    risk: "المخاطر",
    allRisk: "كل مستويات المخاطر",
    appVersion: "إصدار التطبيق",
    registeredFrom: "التسجيل من",
    registeredTo: "التسجيل إلى",
    sortBy: "ترتيب حسب",
    order: "اتجاه الترتيب",
    lastActive: "آخر نشاط",
    name: "الاسم",
    registeredAt: "تاريخ التسجيل",
    desc: "تنازلي",
    asc: "تصاعدي",
    clear: "مسح",
    select: "تحديد",
    user: "المستخدم",
    countryLanguage: "الدولة واللغة",
    platforms: "المنصات",
    devices: "الأجهزة",
    action: "الإجراء",
    primary: "الأساسية",
    deviceCount: "أجهزة",
    fullProfile: "فتح الملف الكامل",
    viewSummary: "عرض الملخص",
    showing: "عرض",
    of: "من",
    pageSize: "حجم الصفحة",
    previous: "السابق",
    next: "التالي",
    privacyNotice: "البيانات المالية الحساسة مخفية افتراضيا.",
    maskedEmail: "البريد المخفي",
  },
  en: {
    eyebrow: "Customers and Revenue / Users",
    title: "User Management",
    description: "Find accounts and review their state without exposing sensitive financial data.",
    exportSummary: "Export summary",
    uniqueCustomers: "Unique customers",
    uniqueContext: "Independent from the combined platform total",
    iosCustomers: "iOS customers",
    androidCustomers: "Android customers",
    multiPlatformCustomers: "Multi-platform customers",
    searchUsers: "Search users",
    searchPlaceholder: "Name, masked email, or ID",
    platform: "Platform",
    accountStatus: "Account status",
    allStatuses: "All statuses",
    plan: "Plan",
    allPlans: "All plans",
    country: "Country",
    allCountries: "All countries",
    language: "Language",
    allLanguages: "All languages",
    verification: "Verification",
    allVerification: "All verification states",
    risk: "Risk",
    allRisk: "All risk levels",
    appVersion: "App version",
    registeredFrom: "Registered from",
    registeredTo: "Registered to",
    sortBy: "Sort by",
    order: "Sort direction",
    lastActive: "Last active",
    name: "Name",
    registeredAt: "Registration date",
    desc: "Descending",
    asc: "Ascending",
    clear: "Clear",
    select: "Select",
    user: "User",
    countryLanguage: "Country and language",
    platforms: "Platforms",
    devices: "Devices",
    action: "Action",
    primary: "Primary",
    deviceCount: "devices",
    fullProfile: "Open full profile",
    viewSummary: "View summary",
    showing: "Showing",
    of: "of",
    pageSize: "Page size",
    previous: "Previous",
    next: "Next",
    privacyNotice: "Sensitive financial data is hidden by default.",
    maskedEmail: "Masked email",
  },
} as const;

function platformLabel(user: AdminUserListItem, locale: "ar" | "en") {
  return user.registeredPlatforms.map((platform) => getPlatformLabel(locale, platform)).join(" + ");
}

function platformName(platform: AdminUserListItem["registeredPlatforms"][number], locale: "ar" | "en") {
  return getPlatformLabel(locale, platform);
}

function PlanBadge({ plan, locale }: { plan: AdminUserListItem["plan"]; locale: "ar" | "en" }) {
  const Icon = plan === "Premium" ? Crown : plan === "Basic" ? Star : Gift;
  return (
    <span className={`badge plan-badge plan-${plan.toLowerCase()}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      <span>{getPlanLabel(locale, plan)}</span>
    </span>
  );
}

export default function UsersPage() {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const copy = userCopy[locale];
  const [filters, setFilters] = useState<Partial<AdminUsersQuery>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOutcome, setBulkOutcome] = useState("");
  const [activeUser, setActiveUser] = useState<AdminUserListItem | null>(null);
  const query = useUsers({ ...filters, page, pageSize });
  const users = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  function updateFilter<Key extends keyof AdminUsersQuery>(key: Key, value: AdminUsersQuery[Key] | undefined) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSelected([]);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setSelected([]);
  }

  function toggleUser(userId: string) {
    setSelected((current) => current.includes(userId)
      ? current.filter((selectedId) => selectedId !== userId)
      : [...current, userId]);
  }

  const metrics = [
    { label: copy.uniqueCustomers, value: String(query.data?.uniqueCustomersTotal ?? 0), context: copy.uniqueContext },
    { label: copy.iosCustomers, value: String(query.data?.iosCustomers ?? 0) },
    { label: copy.androidCustomers, value: String(query.data?.androidCustomers ?? 0) },
    { label: copy.multiPlatformCustomers, value: String(query.data?.multiPlatformCustomers ?? 0), tone: "premium" as const },
  ];
  const platformOptions: { value: PlatformFilter; label: string }[] = [
    { value: "all", label: getPlatformLabel(locale, "all") },
    { value: "ios", label: getPlatformLabel(locale, "ios") },
    { value: "android", label: getPlatformLabel(locale, "android") },
    { value: "multi", label: getPlatformLabel(locale, "multi") },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={<button className="button"><Download size={16} /><span>{copy.exportSummary}</span></button>}
      />
      <div className="metrics-grid">{metrics.map((metric) => <MetricCard metric={metric} key={metric.label} />)}</div>
      <span className="sr-only" data-spec="users-platform-totals">
        unique:{query.data?.uniqueCustomersTotal ?? 0};ios:{query.data?.iosCustomers ?? 0};android:{query.data?.androidCustomers ?? 0};multi:{query.data?.multiPlatformCustomers ?? 0}
      </span>
      <div className="toolbar users-filter-toolbar">
        <div className="toolbar-filters">
          <label className="search-input">
            <Search size={17} /><span className="sr-only">{copy.searchUsers}</span>
            <input className="input" value={filters.query ?? ""} onChange={(event) => updateFilter("query", event.target.value || undefined)} placeholder={copy.searchPlaceholder} />
          </label>
          <select className="select" aria-label={copy.platform} value={filters.platform ?? "all"} onChange={(event) => updateFilter("platform", event.target.value as PlatformFilter)}>
            {platformOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <select className="select" aria-label={copy.accountStatus} value={filters.status ?? ""} onChange={(event) => updateFilter("status", event.target.value as AdminUsersQuery["status"] || undefined)}>
            <option value="">{copy.allStatuses}</option><option value="active">{getStatusLabel(locale, "active")}</option><option value="pending">{getStatusLabel(locale, "pending")}</option><option value="suspended">{getStatusLabel(locale, "suspended")}</option>
          </select>
          <select className="select" aria-label={copy.plan} value={filters.plan ?? ""} onChange={(event) => updateFilter("plan", event.target.value as AdminUsersQuery["plan"] || undefined)}>
            <option value="">{copy.allPlans}</option><option value="Free">{getPlanLabel(locale, "Free")}</option><option value="Basic">{getPlanLabel(locale, "Basic")}</option><option value="Premium">{getPlanLabel(locale, "Premium")}</option>
          </select>
          <select className="select" aria-label={copy.country} value={filters.country ?? ""} onChange={(event) => updateFilter("country", event.target.value as AdminUsersQuery["country"] || undefined)}>
            <option value="">{copy.allCountries}</option><option value="SA">{getCountryLabel(locale, "SA")}</option><option value="AE">{getCountryLabel(locale, "AE")}</option>
          </select>
          <select className="select" aria-label={copy.language} value={filters.language ?? ""} onChange={(event) => updateFilter("language", event.target.value as AdminUsersQuery["language"] || undefined)}>
            <option value="">{copy.allLanguages}</option><option value="ar">{getLanguageLabel(locale, "ar")}</option><option value="en">{getLanguageLabel(locale, "en")}</option>
          </select>
          <select className="select" aria-label={copy.verification} value={filters.verification ?? ""} onChange={(event) => updateFilter("verification", event.target.value as AdminUsersQuery["verification"] || undefined)}>
            <option value="">{copy.allVerification}</option><option value="verified">{getStatusLabel(locale, "verified")}</option><option value="pending">{getStatusLabel(locale, "pending")}</option>
          </select>
          <select className="select" aria-label={copy.risk} value={filters.risk ?? ""} onChange={(event) => updateFilter("risk", event.target.value as AdminUsersQuery["risk"] || undefined)}>
            <option value="">{copy.allRisk}</option><option value="low">{getSeverityLabel(locale, "low")}</option><option value="medium">{getSeverityLabel(locale, "medium")}</option><option value="high">{getSeverityLabel(locale, "high")}</option>
          </select>
          <input className="input ltr" aria-label={copy.appVersion} value={filters.appVersion ?? ""} onChange={(event) => updateFilter("appVersion", event.target.value || undefined)} placeholder="4.8.2" />
          <input className="input" type="date" aria-label={copy.registeredFrom} value={filters.registeredFrom ?? ""} onChange={(event) => updateFilter("registeredFrom", event.target.value || undefined)} />
          <input className="input" type="date" aria-label={copy.registeredTo} value={filters.registeredTo ?? ""} onChange={(event) => updateFilter("registeredTo", event.target.value || undefined)} />
          <select className="select" aria-label={copy.sortBy} value={filters.sort ?? "lastActive"} onChange={(event) => updateFilter("sort", event.target.value as AdminUsersQuery["sort"])}>
            <option value="lastActive">{copy.lastActive}</option><option value="name">{copy.name}</option><option value="registeredAt">{copy.registeredAt}</option><option value="risk">{copy.risk}</option>
          </select>
          <select className="select" aria-label={copy.order} value={filters.order ?? "desc"} onChange={(event) => updateFilter("order", event.target.value as AdminUsersQuery["order"])}>
            <option value="desc">{copy.desc}</option><option value="asc">{copy.asc}</option>
          </select>
          {Object.keys(filters).length > 0 && <button className="button ghost" onClick={() => { setFilters({}); setPage(1); setSelected([]); }}><FilterX size={16} /> {copy.clear}</button>}
        </div>
      </div>
      <div className="table-card users-table-card">
        <RegionState
          isPending={query.isPending}
          isError={query.isError}
          error={query.error as { code?: string } | undefined}
          region={query.data?.region}
          permission="users.read"
        >
          <>
            <div className="desktop-table">
              <table className="data-table users-data-table">
                <thead><tr><th><span className="sr-only">{copy.select}</span></th><th>{copy.user}</th><th>{copy.countryLanguage}</th><th>{copy.platforms}</th><th>{copy.devices}</th><th>{copy.plan}</th><th>{copy.accountStatus}</th><th>{copy.risk}</th><th>{copy.lastActive}</th><th>{copy.action}</th></tr></thead>
                <tbody>{users.map((user) => <tr key={user.id} className={selected.includes(user.id) ? "selected" : ""}>
                  <td className="users-select-cell"><input type="checkbox" checked={selected.includes(user.id)} onChange={() => toggleUser(user.id)} aria-label={`${copy.select} ${user.displayName}`} /></td>
                  <td><div className="user-cell users-user-cell"><div className="avatar">{user.displayName.slice(0, 2)}</div><div><button className="table-link" onClick={() => setActiveUser(user)} title={user.displayName}>{user.displayName}</button><small className="ltr" title={user.maskedEmail}>{user.maskedEmail} {" · "} {user.id}</small></div></div></td>
                  <td className="users-locale-cell">{getCountryLabel(locale, user.country)} <span>·</span> {getLanguageLabel(locale, user.language)}</td>
                  <td><div className="users-platform-cell"><div>{user.registeredPlatforms.map((platform) => <span className={`platform-chip platform-chip-${platform}`} key={platform}>{platformName(platform, locale)}</span>)}</div><small>{copy.primary}: {getPlatformLabel(locale, user.primaryPlatform)}</small></div></td>
                  <td className="users-devices-cell"><strong>{user.totalDeviceCount} {copy.deviceCount}</strong><small className="ltr">iOS {user.iosDeviceCount} + Android {user.androidDeviceCount}</small></td>
                  <td><PlanBadge plan={user.plan} locale={locale} /></td><td><span className={`badge users-status-badge status-${user.status}`}>{getStatusLabel(locale, user.status)}</span></td><td><span className={`badge severity-${user.risk}`}>{getSeverityLabel(locale, user.risk)}</span></td>
                  <td className="users-date-cell">{formatDate(user.lastActiveAt, true)}</td>
                  <td className="users-action-cell"><Link className="button ghost users-profile-action" href={`/admin/users/${user.id}`} title={copy.fullProfile} aria-label={copy.fullProfile}><UserRound size={13} aria-hidden="true" /><span>{copy.fullProfile}</span></Link></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="mobile-cards users-mobile-cards">{users.map((user) => <article className="mobile-data-card users-mobile-card" key={user.id}>
              <div className="mobile-data-head">
                <label><input type="checkbox" checked={selected.includes(user.id)} onChange={() => toggleUser(user.id)} aria-label={`${copy.select} ${user.displayName}`} /> <strong>{user.displayName}</strong></label>
              </div>
              <small className="ltr">{user.maskedEmail} {" · "} {user.id}</small>
              <div className="mobile-data-meta"><div><small>{copy.platforms}</small><strong className="users-platform-cell">{user.registeredPlatforms.map((platform) => <span className={`platform-chip platform-chip-${platform}`} key={platform}>{platformName(platform, locale)}</span>)}</strong></div><div><small>{copy.devices}</small><strong>{user.totalDeviceCount} {copy.deviceCount}</strong></div><div><small>{copy.plan}</small><strong><PlanBadge plan={user.plan} locale={locale} /></strong></div><div><small>{copy.accountStatus}</small><strong><span className={`badge users-status-badge status-${user.status}`}>{getStatusLabel(locale, user.status)}</span></strong></div><div><small>{copy.risk}</small><strong><span className={`badge severity-${user.risk}`}>{getSeverityLabel(locale, user.risk)}</span></strong></div></div>
              <button className="button" style={{ minHeight: 44 }} onClick={() => setActiveUser(user)}>{copy.viewSummary}</button>
            </article>)}</div>
            <div className="pagination">
              <span>{copy.showing} {users.length} {copy.of} {pagination?.totalItems ?? 0}</span>
              <select aria-label={copy.pageSize} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 25 | 50 | 100); changePage(1); }}><option>25</option><option>50</option><option>100</option></select>
              <div><button className="button" disabled={page === 1} onClick={() => changePage(page - 1)}>{copy.previous}</button><button className="button" disabled={page >= (pagination?.totalPages ?? 0)} onClick={() => changePage(page + 1)}>{copy.next}</button></div>
            </div>
          </>
        </RegionState>
      </div>
      {selected.length > 0 && <UserBulkActions
        selectedUsers={users.filter(({ id }) => selected.includes(id))}
        role={role}
        onClear={() => setSelected([])}
        onComplete={setBulkOutcome}
      />}
      {bulkOutcome && <p role="status">{bulkOutcome}</p>}
      <Drawer open={Boolean(activeUser)} onClose={() => setActiveUser(null)} title={activeUser?.displayName ?? ""} eyebrow={activeUser?.id} className="user-summary-modal">
        {activeUser && <><div className="privacy-notice"><Info size={18} /><span>{copy.privacyNotice}</span></div><div className="detail-grid"><div className="detail-item"><small>{copy.maskedEmail}</small><strong className="ltr">{activeUser.maskedEmail}</strong></div><div className="detail-item"><small>{copy.platforms}</small><strong className="ltr">{platformLabel(activeUser, locale)}</strong></div><div className="detail-item"><small>{copy.accountStatus}</small><strong>{getStatusLabel(locale, activeUser.status)}</strong></div><div className="detail-item"><small>{copy.risk}</small><strong>{getSeverityLabel(locale, activeUser.risk)}</strong></div></div><Link className="button primary" href={`/admin/users/${activeUser.id}`}>{copy.fullProfile}</Link></>}
      </Drawer>
    </div>
  );
}
