"use client";

import { Info, MonitorSmartphone, ShieldAlert } from "lucide-react";
import { MaskedField } from "@/components/admin/MaskedField";
import { PermissionBoundary } from "@/components/admin/PermissionBoundary";
import { PageHeader, RegionState } from "@/components/admin/ui";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import type { AdminRole } from "@/core/permissions/permissions";
import { hasPermission } from "@/core/permissions/role-map";
import { formatDate } from "@/lib/admin-utils";
import type {
  CapabilityState,
  UserDevice,
  UserProfileSummary,
  UserSession,
} from "./contracts";
import { useUser, useUserDevices, useUserSessions } from "./hooks";
import { UserActions } from "./UserActions";
import { useLocale } from "@/core/localization/provider";

const englishLabels: Record<string,string> = {
  "تعرض هذه الصفحة هوية مخفية وملخصات رقمية فقط، دون سجلات أو مبالغ مالية حساسة.": "This page shows masked identity and aggregate metadata without sensitive financial records or amounts.",
  "البريد المخفي": "Masked email", "الحالة": "Status", "طلبات إلغاء الجلسات": "Session revocation requests", "قيد التنفيذ": "Pending", "تعذرت المحاولة؛ إعادة المحاولة مجدولة": "Attempt failed; retry scheduled", "اكتملت الطلبات السابقة": "Previous requests completed", "التحقق": "Verification", "الخطة": "Plan", "المنصات": "Platforms", "آخر نشاط": "Last activity", "الحسابات": "Accounts", "المعاملات المجمّعة": "Aggregate transactions", "الأهداف": "Goals", "الديون النشطة": "Active debts", "مصادر الاستيراد": "Import sources", "المخاطر": "Risk", "الإشعارات": "Push notifications", "الاختصارات": "Shortcuts", "امتداد المشاركة": "Share extension", "تتبّع الرسائل": "SMS tracking", "مستمع الإشعارات": "Notification listener", "العمل في الخلفية": "Background activity", "آخر ظهور": "Last seen", "الجلسة الحالية المرئية للمسؤول": "Current session visible to the administrator", "موضع إجراء إلغاء الجهاز": "Device revocation action", "موضع إجراء إلغاء الجلسة": "Session revocation action", "المستخدمون": "Customers", "ملف المستخدم": "Customer profile", "مراجعة الهوية المخفية وملخص الأجهزة والجلسات ضمن حدود الصلاحيات.": "Review masked identity, devices and sessions within granted permissions.", "الملف والملخصات": "Profile and summaries", "الأجهزة": "Devices", "لا توجد أجهزة مسجلة.": "No registered devices.", "الجلسات": "Sessions", "لا توجد جلسات.": "No sessions.", "الموقع معروض على مستوى المدينة والدولة فقط؛ لا تُعرض عناوين IP أو رموز جلسة.": "Only coarse city/country information is shown; IP addresses and session tokens are hidden.", "الجهاز": "Device", "المنصة": "Platform", "المنطقة التقريبية": "Coarse region", "بدأت": "Started", "تنبيه": "Notice",
  "نشط": "Active", "موقوف": "Suspended", "قيد التفعيل": "Pending", "قيد الحذف": "Deletion pending", "محذوف": "Deleted", "موثّق": "Verified", "معلّق": "Pending", "غير معروف": "Unknown", "نشطة": "Active", "منتهية": "Expired", "ملغاة": "Revoked", "ملغى": "Revoked", "منخفضة": "Low", "متوسطة": "Medium", "مرتفعة": "High", "غير مقاسة": "Not measured", "مفعّل": "Enabled", "معطّل": "Disabled", "مرفوض": "Denied", "غير متاح": "Unavailable", "غير منطبق": "Not applicable",
};
function useDetailText() { const { locale } = useLocale(); return (value: string) => locale === "ar" ? value : englishLabels[value] ?? value; }

const statusLabels = { active: "نشط", suspended: "موقوف", pending: "قيد التفعيل", deletion_pending: "قيد الحذف", deleted: "محذوف" };
const verificationLabels = { verified: "موثّق", pending: "معلّق", unknown: "غير معروف" };
const sessionLabels = { active: "نشطة", expired: "منتهية", revoked: "ملغاة" };
const deviceLabels = { active: "نشط", revoked: "ملغى" };
const riskLabels = { low: "منخفضة", medium: "متوسطة", high: "مرتفعة", unknown: "غير مقاسة" };
const capabilityLabels: Record<CapabilityState, string> = {
  enabled: "مفعّل",
  disabled: "معطّل",
  denied: "مرفوض",
  unavailable: "غير متاح",
  unknown: "غير معروف",
  "not-applicable": "غير منطبق",
};

interface UserDetailViewProps {
  userId: string;
  role?: AdminRole;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="detail-item"><small>{label}</small><strong>{children}</strong></div>;
}

function ProfileOverview({ profile }: { profile: UserProfileSummary }) {
  const text = useDetailText();
  return (
    <>
      <div className="privacy-notice" role="note">
        <Info size={18} />
        <span>{text("تعرض هذه الصفحة هوية مخفية وملخصات رقمية فقط، دون سجلات أو مبالغ مالية حساسة.")}</span>
      </div>
      <div className="detail-grid">
        <DetailItem label={text("البريد المخفي")}>
          <MaskedField label={text("البريد المخفي")} maskedValue={profile.maskedEmail ?? "—"} />
        </DetailItem>
        <DetailItem label={text("الحالة")}>{text(statusLabels[profile.status])}</DetailItem>
        {profile.providerRevocationStatus !== undefined && <DetailItem label={text("طلبات إلغاء الجلسات")}>
          {profile.providerRevocationStatus === "pending" ? text("قيد التنفيذ") : profile.providerRevocationStatus === "failed" ? text("تعذرت المحاولة؛ إعادة المحاولة مجدولة") : profile.providerRevocationStatus === "completed" ? text("اكتملت الطلبات السابقة") : "—"}
        </DetailItem>}
        <DetailItem label={text("التحقق")}>{text(verificationLabels[profile.verification])}</DetailItem>
        <DetailItem label={text("الخطة")}>{profile.currentPlan ?? "—"}</DetailItem>
        <DetailItem label={text("المنصات")}><bdi>{profile.registeredPlatforms.join(" + ") || "—"}</bdi></DetailItem>
        <DetailItem label={text("آخر نشاط")}>{profile.lastActiveAt ? formatDate(profile.lastActiveAt, true) : "—"}</DetailItem>
        <DetailItem label={text("الحسابات")}>{profile.aggregates.accountsCount ?? "—"}</DetailItem>
        <DetailItem label={text("المعاملات المجمّعة")}>{profile.aggregates.transactionsCount ?? "—"}</DetailItem>
        <DetailItem label={text("الأهداف")}>{profile.aggregates.goalsCount ?? "—"}</DetailItem>
        <DetailItem label={text("الديون النشطة")}>{profile.aggregates.activeDebtsCount ?? "—"}</DetailItem>
        <DetailItem label={text("مصادر الاستيراد")}>{profile.aggregates.importSourcesCount ?? "—"}</DetailItem>
        <DetailItem label={text("المخاطر")}>{profile.risk.label} · {profile.risk.signalsCount ?? "—"}</DetailItem>
      </div>
    </>
  );
}

function Capability({ label, state }: { label: string; state: CapabilityState }) {
  const text = useDetailText();
  return <li><span>{label}</span>: <strong>{text(capabilityLabels[state])}</strong></li>;
}

function DeviceCard({ device, role }: { device: UserDevice; role: AdminRole }) {
  const text = useDetailText();
  return (
    <article className="mobile-data-card">
      <div className="mobile-data-head">
        <strong><MonitorSmartphone size={16} /> {device.safeLabel}</strong>
        <span className={`badge status-${device.state}`}>{text(deviceLabels[device.state])}</span>
      </div>
      <p className="ltr">{device.platform === "ios" ? "iOS" : device.platform === "android" ? "Android" : "Web"} · {device.osVersion ?? "—"} · {device.appVersion}</p>
      <ul>
        <Capability label={text("الإشعارات")} state={device.pushState} />
        <Capability label={text("الاختصارات")} state={device.shortcutState} />
        <Capability label={text("امتداد المشاركة")} state={device.shareExtensionState} />
        <Capability label={text("تتبّع الرسائل")} state={device.smsTrackingState} />
        <Capability label={text("مستمع الإشعارات")} state={device.notificationListenerState} />
        <Capability label={text("العمل في الخلفية")} state={device.backgroundState} />
      </ul>
      <small>{text("آخر ظهور")}: {formatDate(device.lastSeenAt, true)}</small>
      <PermissionBoundary allowed={hasPermission(role, "devices.revoke")} permission="devices.revoke">
        <span className="sr-only">{text("موضع إجراء إلغاء الجهاز")}</span>
      </PermissionBoundary>
    </article>
  );
}

function SessionRow({ session, role }: { session: UserSession; role: AdminRole }) {
  const text = useDetailText();
  return (
    <tr>
      <td>{session.safeDeviceLabel}</td>
      <td><bdi>{session.platform === null ? "—" : session.platform === "ios" ? "iOS" : session.platform === "android" ? "Android" : "Web"}</bdi></td>
      <td>{session.coarseRegion ?? "—"}</td>
      <td>{formatDate(session.startedAt, true)}</td>
      <td>{formatDate(session.lastActivityAt, true)}</td>
      <td>{text(sessionLabels[session.state])}</td>
      <td>{text(riskLabels[session.risk])}</td>
      <td>
        {session.isCurrentAdminVisibleSession && <span className="badge state-warning">{text("الجلسة الحالية المرئية للمسؤول")}</span>}
        <PermissionBoundary allowed={hasPermission(role, "sessions.revoke")} permission="sessions.revoke">
          <span className="sr-only">{text("موضع إجراء إلغاء الجلسة")}</span>
        </PermissionBoundary>
      </td>
    </tr>
  );
}

export function UserDetailView({ userId, role }: UserDetailViewProps) {
  const text = useDetailText();
  const simulatedRole = useSimulatedRole();
  const activeRole = role ?? simulatedRole;
  const input = { userId, role: activeRole };
  const profileQuery = useUser(input);
  const devicesQuery = useUserDevices(input);
  const sessionsQuery = useUserSessions(input);

  return (
    <div className="page">
      <PageHeader
        eyebrow={`${text("المستخدمون")} / ${userId}`}
        title={profileQuery.data?.displayName ?? text("ملف المستخدم")}
        description={text("مراجعة الهوية المخفية وملخص الأجهزة والجلسات ضمن حدود الصلاحيات.")}
      />
      <section className="table-card" aria-labelledby="profile-region-title">
        <h2 id="profile-region-title">{text("الملف والملخصات")}</h2>
        <RegionState
          isPending={profileQuery.isPending}
          isError={profileQuery.isError}
          error={profileQuery.error as { code?: string } | undefined}
          region={profileQuery.data?.region}
          permission="users.read"
        >
          {profileQuery.data && <ProfileOverview profile={profileQuery.data} />}
        </RegionState>
      </section>
      {profileQuery.data && (
        <UserActions
          user={profileQuery.data}
          devices={devicesQuery.data?.items ?? []}
          sessions={sessionsQuery.data?.items ?? []}
          role={activeRole}
        />
      )}
      <section className="table-card" aria-labelledby="devices-region-title">
        <h2 id="devices-region-title">{text("الأجهزة")}</h2>
        <RegionState
          isPending={devicesQuery.isPending}
          isError={devicesQuery.isError}
          error={devicesQuery.error as { code?: string } | undefined}
          region={devicesQuery.data?.region}
          emptyLabel={text("لا توجد أجهزة مسجلة.")}
          permission="devices.read"
        >
          {devicesQuery.data && (
            <>
              <p className="ltr">iOS {devicesQuery.data.iosDeviceCount} + Android {devicesQuery.data.androidDeviceCount}</p>
              <div className="device-grid">
                {devicesQuery.data.items.map((device) => <DeviceCard device={device} role={activeRole} key={device.id} />)}
              </div>
            </>
          )}
        </RegionState>
      </section>
      <section className="table-card" aria-labelledby="sessions-region-title">
        <h2 id="sessions-region-title">{text("الجلسات")}</h2>
        <RegionState
          isPending={sessionsQuery.isPending}
          isError={sessionsQuery.isError}
          error={sessionsQuery.error as { code?: string } | undefined}
          region={sessionsQuery.data?.region}
          emptyLabel={text("لا توجد جلسات.")}
          permission="sessions.read"
        >
          {sessionsQuery.data && (
            <>
              <div className="privacy-notice" role="note">
                <ShieldAlert size={18} />
                <span>{text("الموقع معروض على مستوى المدينة والدولة فقط؛ لا تُعرض عناوين IP أو رموز جلسة.")}</span>
              </div>
              <div className="desktop-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{text("الجهاز")}</th><th>{text("المنصة")}</th><th>{text("المنطقة التقريبية")}</th><th>{text("بدأت")}</th>
                      <th>{text("آخر نشاط")}</th><th>{text("الحالة")}</th><th>{text("المخاطر")}</th><th>{text("تنبيه")}</th>
                    </tr>
                  </thead>
                  <tbody>{sessionsQuery.data.items.map((session) => <SessionRow session={session} role={activeRole} key={session.id} />)}</tbody>
                </table>
              </div>
              <div className="mobile-cards">
                {sessionsQuery.data.items.map((session) => (
                  <article className="mobile-data-card" key={session.id}>
                    <strong>{session.safeDeviceLabel}</strong>
                    <span>{session.coarseRegion ?? "—"}</span>
                    <span>{text(sessionLabels[session.state])} · {text(riskLabels[session.risk])}</span>
                    {session.isCurrentAdminVisibleSession && <strong>{text("الجلسة الحالية المرئية للمسؤول")}</strong>}
                  </article>
                ))}
              </div>
            </>
          )}
        </RegionState>
      </section>
    </div>
  );
}
