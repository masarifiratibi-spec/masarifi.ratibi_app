import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import { QueryProvider } from "@/app/QueryProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  configureApiActorProvider,
  configureApiTokenProvider,
} from "@/core/api/client";
import OverviewPage from "@/app/admin/page";
import UsersPage from "@/app/admin/users/page";
import { UserDetailView } from "@/features/users/UserDetailView";
import {
  SupportOverviewRoute,
  SupportTicketsRoute,
  SupportTicketDetailRoute,
} from "@/features/communications/CommunicationRoutes";
import {
  AuditExplorerRoute,
  AuditEventDetailRoute,
} from "@/features/security/AuditViews";

// Test-only identity and routing boundary; all HTTP parsing, feature components and SQL are real.
// There is no MSW, provider credential, or product authentication bypass in this entry point.
configureApiActorProvider(() => "demo-admin");
configureApiTokenProvider(() => Promise.resolve("recovery-test-principal"));
const path = window.location.pathname;
const user = /^\/admin\/users\/([^/]+)$/.exec(path)?.[1];
const ticket = /^\/admin\/support\/tickets\/([^/]+)$/.exec(path)?.[1];
const audit = /^\/admin\/audit\/([^/]+)$/.exec(path)?.[1];
const page = user ? (
  <UserDetailView userId={decodeURIComponent(user)} />
) : ticket ? (
  <SupportTicketDetailRoute ticketId={decodeURIComponent(ticket)} />
) : audit ? (
  <AuditEventDetailRoute eventId={decodeURIComponent(audit)} />
) : path === "/admin/users" ? (
  <UsersPage />
) : path === "/admin/support/tickets" ? (
  <SupportTicketsRoute />
) : path === "/admin/support" ? (
  <SupportOverviewRoute />
) : path === "/admin/audit" ? (
  <AuditExplorerRoute />
) : path === "/admin" ? (
  <OverviewPage />
) : (
  <p>This route is outside the local recovery test fixture.</p>
);
const root = document.getElementById("root");
if (!root) throw new Error("Recovery fixture root missing");
createRoot(root).render(
  <QueryProvider>
    <AdminShell>{page}</AdminShell>
  </QueryProvider>,
);
