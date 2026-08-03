"use client";

import { ADMIN_ROLES, type AdminRole } from "@/core/permissions/permissions";
import { getRoleLabel } from "@/core/localization/display-labels";
import { useLocale, useT } from "@/core/localization/provider";

export function RoleSwitcher({
  role,
  onChange,
}: {
  role: AdminRole;
  onChange: (role: AdminRole) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  return (
    <label className="role-switcher">
      <span className="sr-only">{t("roleSwitcher.label")}</span>
      <select
        aria-label={t("roleSwitcher.label")}
        className="select"
        value={role}
        onChange={(event) => onChange(event.target.value as AdminRole)}
      >
        {ADMIN_ROLES.map((value) => <option key={value} value={value}>{getRoleLabel(locale, value)}</option>)}
      </select>
    </label>
  );
}
