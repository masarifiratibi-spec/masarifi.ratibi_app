import type { PermissionKey } from "@/core/permissions/permissions";

export type DeniedBehavior = "hidden" | "disabled" | "denied";

export function PermissionBoundary({
  allowed,
  behavior = "hidden",
  permission,
  children,
}: {
  allowed: boolean;
  behavior?: DeniedBehavior;
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  if (allowed) return children;
  if (behavior === "hidden") return null;
  if (behavior === "disabled") {
    return <span aria-disabled="true" className="permission-disabled" title={`الصلاحية المطلوبة: ${permission}`}>{children}</span>;
  }
  return <div className="state-box error" role="alert"><strong>لا تملك صلاحية الوصول</strong><p className="ltr">{permission}</p></div>;
}
