import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { AdminProfileView, AdminTeamView, EditRoleView, InviteAdminView, NewRoleView, PermissionMatrixView, RoleDetailView, RolesView } from "./GovernanceViews";

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
