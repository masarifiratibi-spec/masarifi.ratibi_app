"use client";

import { createContext, useContext } from "react";
import { mocksEnabled } from "@/core/config/runtime";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import type { AdminRole } from "./permissions";
import { hasPermission, toClientPermission } from "./role-map";

const CurrentPermissions = createContext<ReadonlySet<string> | null>(null);

export function CurrentPermissionsProvider({
  permissions,
  children,
}: {
  permissions: ReadonlySet<string> | null;
  children: React.ReactNode;
}) {
  return (
    <CurrentPermissions.Provider
      value={
        permissions === null
          ? null
          : new Set([...permissions].map(toClientPermission))
      }
    >
      {children}
    </CurrentPermissions.Provider>
  );
}

export function useCurrentPermission(fixtureRole?: AdminRole) {
  const permissions = useContext(CurrentPermissions);
  const simulatedRole = useSimulatedRole();
  return (permission: string): boolean =>
    permissions !== null
      ? permissions.has(toClientPermission(permission))
      : mocksEnabled() &&
        hasPermission(fixtureRole ?? simulatedRole, permission);
}
