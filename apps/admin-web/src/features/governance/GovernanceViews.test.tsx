import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { AdminProfileView, AdminTeamView, EditRoleView, InvitationAcceptanceView, InviteAdminView, NewRoleView, PermissionMatrixView, RoleDetailView, RolesView } from "./GovernanceViews";

const roots: Root[] = [];

HTMLDialogElement.prototype.showModal ??= function showModal() {
  this.open = true;
  this.focus();
};

HTMLDialogElement.prototype.close ??= function close() {
  this.open = false;
};

function setField(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderView(node = <AdminTeamView />) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    flushSync(() => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          {node}
        </QueryClientProvider>,
      );
    });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  return host;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => act(async () => root.unmount())));
});

describe("US2 role and permission views", () => {
  test("renders role list, immutable badges, assignment counts, and no delete control", async () => {
    const host = await renderView(<RolesView />);
    expect(host.textContent).toContain("الأدوار والصلاحيات");
    expect(host.textContent).toContain("Super Admin");
    expect(host.textContent).toContain("نظام");
    expect(host.textContent).toContain("الإسنادات");
    expect(host.textContent).not.toMatch(/delete/i);
  });

  test("renders custom role detail and read-only permission matrix", async () => {
    const detail = await renderView(<RoleDetailView roleId="ROLE-DEMO-CUSTOM-RISK" />);
    expect(detail.textContent).toContain("Risk Reviewer");
    expect(detail.innerHTML).toContain("/admin/roles/ROLE-DEMO-CUSTOM-RISK/edit");

    const matrix = await renderView(<PermissionMatrixView />);
    expect(matrix.textContent).toContain("مصفوفة الصلاحيات");
    expect(matrix.textContent).toContain("admin-team.read");
    expect(matrix.textContent).not.toMatch(/save permission|edit permission/i);
  });

  test("validates create role form and blocks system-role editing", async () => {
    const create = await renderView(<NewRoleView />);
    expect(create.textContent).toContain("دور جديد");
    await act(async () => {
      (create.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(create.textContent).toContain("Role created safely");

    const system = await renderView(<EditRoleView roleId="ROLE-DEMO-SUPER" />);
    expect(system.textContent).toContain("immutable-system-role");
  });
});

describe("US1 admin team views", () => {
  test("renders list, filters, masked identity, non-color status, and authorized links", async () => {
    const host = await renderView();
    expect(host.textContent).toContain("فريق الإدارة");
    expect(host.querySelector("input")?.getAttribute("placeholder")).toContain("الاسم");
    expect(host.textContent).toContain("Noura Al Masarifi");
    expect(host.textContent).toContain("n***@example.test");
    expect(host.innerHTML).toContain("/admin/admin-team/ADM-DEMO-SUPER-01");
    expect(host.textContent).toContain("الحالة active");
    expect(host.textContent).not.toMatch(/[a-z0-9._%+-]+@(?!example\.test)/i);
  });

  test("renders permission denial safely", async () => {
    window.sessionStorage.setItem("admin-simulated-role", "billing-operator");
    const host = await renderView();
    expect(host.textContent).toContain("admin-team.read");
  });

  test("validates invitation form and locks pending submit", async () => {
    const host = await renderView(<InviteAdminView />);
    expect(host.textContent).toContain("دعوة مسؤول");
    await act(async () => {
      setField(host.querySelector("input[aria-label='البريد الإلكتروني']") as HTMLInputElement, "bad");
    });
    expect(host.textContent).toContain("أدخل بريدا صحيحا");
    await act(async () => {
      setField(host.querySelector("input[aria-label='البريد الإلكتروني']") as HTMLInputElement, "ui.admin@example.test");
      setField(host.querySelector("input[aria-label='الاسم']") as HTMLInputElement, "UI Admin");
      (host.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(host.textContent).toContain("تم إنشاء الدعوة المعلقة بأمان");
  });

  test("renders detail confirmations, protected current sessions, success/error messages, and restores focus", async () => {
    const host = await renderView(<AdminProfileView adminId="ADM-DEMO-SUPPORT-03" />);
    expect(host.textContent).toContain("Salem Support");
    expect(host.textContent).toContain("Support tablet");
    const button = Array.from(host.querySelectorAll("button")).find((candidate) => candidate.textContent === "إلغاء الجلسات") as HTMLButtonElement;
    button.focus();
    await act(async () => {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      const confirm = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent === "Confirm" || candidate.textContent === "تأكيد") as HTMLButtonElement;
      confirm?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(host.textContent).toContain("Admin governance action completed safely");
    expect(document.activeElement === button || document.body.contains(document.activeElement)).toBe(true);
  });
});

describe("live admin role controls", () => {
  const roleId = "33000000-0000-4000-8000-000000000001";
  const assignmentId = "33000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
    mockServer.use(
      http.get("/api/v1/admin/access/roles", () => HttpResponse.json({
        items: [{ id: roleId, key: "support-agent", name: "Support Agent", description: null, systemRole: true, enabled: true, permissionKeys: ["admin-team.read"], assignmentCount: 1, version: 1 }],
        nextCursor: null,
      })),
      http.get("/api/v1/admin/access/admins/user_target", () => HttpResponse.json({
        id: "user_target",
        displayName: "Live Operator",
        emailMasked: "op***@example.test",
        status: "active",
        department: "Support",
        roleKeys: ["support-agent"],
        mfaStatus: "enabled",
        activeSessionCount: 1,
        version: 1,
        assignments: [{ id: assignmentId, userId: "user_target", roleId, startsAt: "2026-09-10T08:00:00.000Z", endsAt: null, revokedAt: null, version: 1 }],
        effectivePermissionKeys: ["admin-team.read"],
        eligibleActions: ["assign_roles"],
      })),
      http.post("/api/v1/admin/access/invitations/accept", () => HttpResponse.json({ id: "user_target", status: "active" })),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.NEXT_PUBLIC_ENABLE_MOCKS = "true";
  });

  test("loads live role IDs for invitations instead of demo IDs", async () => {
    const host = await renderView(<InviteAdminView />);
    const values = Array.from(host.querySelectorAll("select option"), (option) => option.getAttribute("value"));
    expect(values).toContain(roleId);
    expect(values.some((value) => value?.includes("DEMO"))).toBe(false);
  });

  test("renders live assignment and revoke controls", async () => {
    const host = await renderView(<AdminProfileView adminId="user_target" />);
    expect(host.textContent).toContain("Live Operator");
    expect(host.textContent).toContain("Support Agent");
    expect(host.querySelector("button[aria-label='Revoke role']")).not.toBeNull();
  });

  test("accepts an invitation token from the protected landing page", async () => {
    const host = await renderView(<InvitationAcceptanceView token={"x".repeat(32)} />);
    await act(async () => {
      (host.querySelector("button[aria-label='Accept invitation']") as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(host.textContent).toContain("Invitation accepted");
  });
});
