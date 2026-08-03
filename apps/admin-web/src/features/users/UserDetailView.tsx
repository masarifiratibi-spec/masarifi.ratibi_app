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

const statusLabels = { active: "نشط", suspended: "موقوف", pending: "قيد التفعيل" };
const verificationLabels = { verified: "موثّق", pending: "معلّق" };
const sessionLabels = { active: "نشطة", expired: "منتهية", revoked: "ملغاة" };
const deviceLabels = { active: "نشط", revoked: "ملغى" };
const riskLabels = { low: "منخفضة", medium: "متوسطة", high: "مرتفعة" };
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
  return (
    <>
      <div className="privacy-notice" role="note">
        <Info size={18} />
        <span>تعرض هذه الصفحة هوية مخفية وملخصات رقمية فقط، دون سجلات أو مبالغ مالية حساسة.</span>
      </div>
      <div className="detail-grid">
        <DetailItem label="البريد المخفي">
          <MaskedField label="البريد المخفي" maskedValue={profile.maskedEmail} />
        </DetailItem>
        <DetailItem label="الحالة">{statusLabels[profile.status]}</DetailItem>
        <DetailItem label="التحقق">{verificationLabels[profile.verification]}</DetailItem>
        <DetailItem label="الخطة">{profile.currentPlan}</DetailItem>
        <DetailItem label="المنصات"><bdi>{profile.registeredPlatforms.join(" + ")}</bdi></DetailItem>
        <DetailItem label="آخر نشاط">{formatDate(profile.lastActiveAt, true)}</DetailItem>
        <DetailItem label="الحسابات">{profile.aggregates.accountsCount}</DetailItem>
        <DetailItem label="المعاملات المجمّعة">{profile.aggregates.transactionsCount}</DetailItem>
        <DetailItem label="الأهداف">{profile.aggregates.goalsCount}</DetailItem>
        <DetailItem label="الديون النشطة">{profile.aggregates.activeDebtsCount}</DetailItem>
        <DetailItem label="مصادر الاستيراد">{profile.aggregates.importSourcesCount}</DetailItem>
        <DetailItem label="المخاطر">{profile.risk.label} · {profile.risk.signalsCount}</DetailItem>
      </div>
    </>
  );
}

function Capability({ label, state }: { label: string; state: CapabilityState }) {
  return <li><span>{label}</span>: <strong>{capabilityLabels[state]}</strong></li>;
}

function DeviceCard({ device, role }: { device: UserDevice; role: AdminRole }) {
  return (
    <article className="mobile-data-card">
      <div className="mobile-data-head">
        <strong><MonitorSmartphone size={16} /> {device.safeLabel}</strong>
        <span className={`badge status-${device.state}`}>{deviceLabels[device.state]}</span>
      </div>
      <p className="ltr">{device.platform === "ios" ? "iOS" : "Android"} · {device.osVersion} · {device.appVersion}</p>
      <ul>
        <Capability label="الإشعارات" state={device.pushState} />
        <Capability label="الاختصارات" state={device.shortcutState} />
        <Capability label="امتداد المشاركة" state={device.shareExtensionState} />
        <Capability label="تتبّع الرسائل" state={device.smsTrackingState} />
        <Capability label="مستمع الإشعارات" state={device.notificationListenerState} />
        <Capability label="العمل في الخلفية" state={device.backgroundState} />
      </ul>
      <small>آخر ظهور: {formatDate(device.lastSeenAt, true)}</small>
      <PermissionBoundary allowed={hasPermission(role, "devices.revoke")} permission="devices.revoke">
        <span className="sr-only">موضع إجراء إلغاء الجهاز</span>
      </PermissionBoundary>
    </article>
  );
}

function SessionRow({ session, role }: { session: UserSession; role: AdminRole }) {
  return (
    <tr>
      <td>{session.safeDeviceLabel}</td>
      <td><bdi>{session.platform === "ios" ? "iOS" : "Android"}</bdi></td>
      <td>{session.coarseRegion}</td>
      <td>{formatDate(session.startedAt, true)}</td>
      <td>{formatDate(session.lastActivityAt, true)}</td>
      <td>{sessionLabels[session.state]}</td>
      <td>{riskLabels[session.risk]}</td>
      <td>
        {session.isCurrentAdminVisibleSession && <span className="badge state-warning">الجلسة الحالية المرئية للمسؤول</span>}
        <PermissionBoundary allowed={hasPermission(role, "sessions.revoke")} permission="sessions.revoke">
          <span className="sr-only">موضع إجراء إلغاء الجلسة</span>
        </PermissionBoundary>
      </td>
    </tr>
  );
}

export function UserDetailView({ userId, role }: UserDetailViewProps) {
  const simulatedRole = useSimulatedRole();
  const activeRole = role ?? simulatedRole;
  const input = { userId, role: activeRole };
  const profileQuery = useUser(input);
  const devicesQuery = useUserDevices(input);
  const sessionsQuery = useUserSessions(input);

  return (
    <div className="page">
      <PageHeader
        eyebrow={`المستخدمون / ${userId}`}
        title={profileQuery.data?.displayName ?? "ملف المستخدم"}
        description="مراجعة الهوية المخفية وملخص الأجهزة والجلسات ضمن حدود الصلاحيات."
      />
      <section className="table-card" aria-labelledby="profile-region-title">
        <h2 id="profile-region-title">الملف والملخصات</h2>
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
        <h2 id="devices-region-title">الأجهزة</h2>
        <RegionState
          isPending={devicesQuery.isPending}
          isError={devicesQuery.isError}
          error={devicesQuery.error as { code?: string } | undefined}
          region={devicesQuery.data?.region}
          emptyLabel="لا توجد أجهزة مسجلة."
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
        <h2 id="sessions-region-title">الجلسات</h2>
        <RegionState
          isPending={sessionsQuery.isPending}
          isError={sessionsQuery.isError}
          error={sessionsQuery.error as { code?: string } | undefined}
          region={sessionsQuery.data?.region}
          emptyLabel="لا توجد جلسات."
          permission="sessions.read"
        >
          {sessionsQuery.data && (
            <>
              <div className="privacy-notice" role="note">
                <ShieldAlert size={18} />
                <span>الموقع معروض على مستوى المدينة والدولة فقط؛ لا تُعرض عناوين IP أو رموز جلسة.</span>
              </div>
              <div className="desktop-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الجهاز</th><th>المنصة</th><th>المنطقة التقريبية</th><th>بدأت</th>
                      <th>آخر نشاط</th><th>الحالة</th><th>المخاطر</th><th>تنبيه</th>
                    </tr>
                  </thead>
                  <tbody>{sessionsQuery.data.items.map((session) => <SessionRow session={session} role={activeRole} key={session.id} />)}</tbody>
                </table>
              </div>
              <div className="mobile-cards">
                {sessionsQuery.data.items.map((session) => (
                  <article className="mobile-data-card" key={session.id}>
                    <strong>{session.safeDeviceLabel}</strong>
                    <span>{session.coarseRegion}</span>
                    <span>{sessionLabels[session.state]} · {riskLabels[session.risk]}</span>
                    {session.isCurrentAdminVisibleSession && <strong>الجلسة الحالية المرئية للمسؤول</strong>}
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
