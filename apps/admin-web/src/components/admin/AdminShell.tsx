"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Languages,
  Menu,
  Moon,
  PanelRightClose,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setSimulatedRole, useSimulatedRole } from "@/core/auth/use-simulated-role";
import type { AdminRole } from "@/core/permissions/permissions";
import { hasPermission, toClientPermission } from "@/core/permissions/role-map";
import { ApiError } from "@/core/api/errors";
import { mocksEnabled } from "@/core/config/runtime";
import { ADMIN_ROLES } from "@/core/permissions/permissions";
import { CurrentPermissionsProvider } from "@/core/permissions/current-permissions";
import { resolveDeploymentEnvironment } from "@/core/config/deployment-environment";
import { permittedNavigation } from "@/features/foundation/navigation";
import { applyDocumentLocale, type Locale } from "@/core/localization/direction";
import { getNavigationLabel, getRoleLabel } from "@/core/localization/display-labels";
import { LocaleProvider, useLocale, useT } from "@/core/localization/provider";
import { t } from "@/core/localization/messages";
import type { NavigationGroup } from "@/features/foundation/contracts";
import { useAdminNavigation, useAdminSession } from "@/features/foundation/hooks";
import { AttentionPanel } from "./AttentionPanel";
import { AccessDenied } from "./AccessDenied";
import { EnvironmentIndicator } from "./EnvironmentIndicator";
import { GlobalSearch } from "./GlobalSearch";
import { RoleSwitcher } from "./RoleSwitcher";
import { SessionExpired } from "./SessionExpired";
import { SignOutButton } from "./SignOutButton";
import { SidebarNavigationList } from "./SidebarAccordion";
import { ToastRegion } from "./ToastRegion";
import { RegionState } from "./ui";
import { buildSidebarSections, nextTheme, resolveRoutePermission } from "./shell-state";
import { useAdminIdentity } from "@/app/providers";

const subscribeToEnvironment = () => () => undefined;
const serverEnvironment = () => resolveDeploymentEnvironment(process.env.NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT);
const browserEnvironment = () => resolveDeploymentEnvironment(process.env.NEXT_PUBLIC_DEPLOYMENT_ENVIRONMENT, window.location.hostname);

function Sidebar({
  compact,
  groups,
  mobile = false,
  close,
  inert = false,
}: {
  compact: boolean;
  groups: NavigationGroup[];
  mobile?: boolean;
  close?: () => void;
  inert?: boolean;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const translate = useT();
  const sections = buildSidebarSections(groups, pathname);
  return (
    <aside
      aria-label={mobile ? translate("shell.mainNavigation") : undefined}
      className={`sidebar ${compact ? "sidebar-compact" : ""} ${mobile ? "sidebar-mobile" : ""}`}
      inert={inert}
    >
      <div className="brand">
        <Image className="brand-mark" src="/brand-icon.png" alt="" width={36} height={36} />
        {!compact && <div><strong>{translate("shell.appName")}</strong><small>{translate("shell.appSubtitle")}</small></div>}
        {mobile && <button className="icon-button sidebar-close" onClick={close} aria-label={translate("shell.mobileClose")}><X size={20} /></button>}
      </div>
      <nav aria-label={translate("shell.mainNavigation")}>
        {sections.map((group) => (
          <div className="nav-group" key={group.id}>
            {!compact && <p>{getNavigationLabel(locale, group.id, group.labelKey)}</p>}
            <SidebarNavigationList close={close} compact={compact && !mobile} key={`${group.id}:${pathname}`} nodes={group.items} pathname={pathname} />
          </div>
        ))}
      </nav>
      {!compact && <div className="sidebar-note"><ShieldCheck size={18} /><span>{translate("shell.financialDataHidden")}</span></div>}
    </aside>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const identity = useAdminIdentity();
  const pathname = usePathname();
  const demoMode = mocksEnabled();
  const session = useAdminSession(identity.actorId);
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<Locale>("ar");
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const simulatedRole = useSimulatedRole();
  const deploymentEnvironment = useSyncExternalStore(subscribeToEnvironment, browserEnvironment, serverEnvironment);
  const currentSession = (demoMode || (identity.loaded && session.data?.id === identity.actorId)) && !session.error ? session.data : undefined;
  const serverRole = currentSession?.roleKeys.find((key): key is AdminRole =>
    ADMIN_ROLES.some((role) => role === key),
  );
  const role = demoMode ? simulatedRole : (serverRole ?? "support-agent");
  const effectivePermissions = new Set(
    (currentSession?.effectivePermissionKeys ?? []).map(toClientPermission),
  );
  const navigation = useAdminNavigation(role);
  const groups = demoMode || currentSession ? navigation.data?.groups ?? [] : [];
  const displayName = currentSession?.displayName ?? (demoMode ? "Waleed" : t(locale, "common.loading"));
  const sidebarGroups = mocksEnabled() ? groups.filter((group) => group.id !== "communications") : permittedNavigation(groups, effectivePermissions);
  const routePermission = resolveRoutePermission(pathname);
  const deniedPermission = routePermission === "forbidden"
    ? routePermission
    : routePermission && !(demoMode
      ? hasPermission(role, routePermission)
      : identity.loaded && effectivePermissions.has(routePermission))
      ? routePermission
      : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => applyDocumentLocale(locale), [locale]);

  const closeMobile = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => mobileTrigger.current?.focus());
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = mobileDialog.current;
    const trigger = mobileTrigger.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 900px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (event.matches) setMobileOpen(false); };
    desktop.addEventListener("change",closeOnDesktop);
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = overflow;
      desktop.removeEventListener("change",closeOnDesktop);
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [mobileOpen]);

  const changeRole = (nextRole: AdminRole) => {
    setSimulatedRole(nextRole);
  };

  if (session.error instanceof ApiError && session.error.code === "session_expired") {
    return <><SessionExpired temporary onReturn={() => window.location.assign("/admin")} /><SignOutButton /></>;
  }

  return (
    <LocaleProvider locale={locale} setLocale={setLocale}>
    <div className={`admin-shell ${compact ? "shell-compact" : ""}`} data-admin-shell>
      <Sidebar compact={compact} groups={sidebarGroups} inert={mobileOpen} />
      {mobileOpen && (
        <dialog
          ref={mobileDialog}
          className="mobile-overlay"
          aria-modal="true"
          aria-label={t(locale, "shell.mainNavigation")}
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeMobile(); }}
          onCancel={(event) => { event.preventDefault(); closeMobile(); }}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const dialog = event.currentTarget;
            const controls = [...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
              .filter((element) => element.getClientRects().length > 0);
            const first = controls[0]; const last = controls.at(-1);
            if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
              event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault(); first.focus();
            }
          }}
        >
          <div onMouseDown={(event) => event.stopPropagation()}>
            <Sidebar close={closeMobile} compact={false} groups={sidebarGroups} mobile />
          </div>
        </dialog>
      )}
      <div className="admin-main" inert={mobileOpen}>
        <header className="topbar">
          <div className="topbar-start">
            <button ref={mobileTrigger} className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label={t(locale, "shell.mobileOpen")}><Menu size={20} /></button>
            <button className="icon-button desktop-collapse" onClick={() => setCompact((value) => !value)} aria-label={compact ? t(locale, "shell.expandSidebar") : t(locale, "shell.collapseSidebar")}><PanelRightClose size={20} /></button>
            {demoMode && <GlobalSearch role={role} />}
          </div>
          <div className="topbar-actions">
            <EnvironmentIndicator environment={deploymentEnvironment} locale={locale} />
            {demoMode && <RoleSwitcher role={role} onChange={changeRole} />}
            {demoMode && <span className="development-disclaimer">{t(locale, "shell.developmentDisclaimer")}</span>}
            <button className="icon-button" aria-label={t(locale, "shell.languageToggle")} onClick={() => setLocale((value) => value === "ar" ? "en" : "ar")}><Languages size={19} /></button>
            <button className="icon-button" onClick={() => setTheme(nextTheme)} aria-label={t(locale, "shell.themeToggle")}>
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {demoMode && <AttentionPanel role={role} />}
            <SignOutButton />
            <div className="profile">
              <div className="avatar profile-photo" role="img" aria-label={t(locale, "shell.profilePhoto", { name: displayName })} />
              <div><strong>{displayName}</strong><small>{demoMode || serverRole ? getRoleLabel(locale, role) : ""}</small></div>
            </div>
          </div>
        </header>
        <main><CurrentPermissionsProvider permissions={mocksEnabled() ? null : effectivePermissions}>{!demoMode && !currentSession ? <RegionState isPending={!session.isError} isError={session.isError} error={session.error instanceof ApiError ? session.error : undefined} permission={routePermission ?? "admin.overview.read"} onRetry={() => void session.refetch()}>{null}</RegionState> : deniedPermission ? <AccessDenied permission={deniedPermission} /> : children}</CurrentPermissionsProvider></main>
      </div>
      <ToastRegion messages={[]} />
    </div>
    </LocaleProvider>
  );
}
