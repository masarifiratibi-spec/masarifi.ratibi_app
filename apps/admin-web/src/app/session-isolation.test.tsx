import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, StrictMode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AdminShell } from "@/components/admin/AdminShell";
import { requestJson } from "@/core/api/client";
import { z } from "zod";
import { Providers } from "./providers";
import OverviewPage from "./admin/page";

const clerk = vi.hoisted(() => ({
  identity: { userId: "admin", sessionId: "admin-session", isLoaded: true, getToken: vi.fn(async () => "admin-token") },
  signOut: vi.fn(), redirect: vi.fn(),
  activeSession: { id: "admin-session", user: { id: "admin" }, getToken: vi.fn(async () => "admin-token") },
  listeners: new Set<(resources: { session?: { id: string }; user?: { id: string } }) => void>(),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => clerk.identity, useClerk: () => ({
  signOut: clerk.signOut,
  get session() { return clerk.activeSession; },
  addListener: (listener: (resources: { session?: { id: string }; user?: { id: string } }) => void) => {
    clerk.listeners.add(listener); return () => clerk.listeners.delete(listener);
  },
}) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/ai/prompts" }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/core/auth/sign-in-navigation", () => ({ returnToAdminSignIn: clerk.redirect }));

type Pending = { signal: AbortSignal; finish: (value: Response) => void; token: string };
let root: Root;
let element: HTMLDivElement;
let currentClient: QueryClient;
let pending: Pending[];
const response = (id: string) => ({ ok: true, status: 200, json: async () => ({
  id, displayName: id === "admin" ? "Administrator" : "Waleed",
  roleKeys: [id === "admin" ? "super-admin" : "support-agent"],
  effectivePermissionKeys: id === "admin" ? ["ai.prompts.read", "admin.overview.read"] : ["support.access.read"],
  mfaStatus: "enabled", activeSessionCount: 2, version: 1,
}) }) as Response;
function Probe({ overview = false }: { overview?: boolean }) {
  const client = useQueryClient();
  useEffect(() => { currentClient = client; }, [client]);
  return <AdminShell>{overview ? <OverviewPage /> : <p>Protected prompt page</p>}</AdminShell>;
}
async function render(overview = false) {
  clerk.activeSession = { id: clerk.identity.sessionId, user: { id: clerk.identity.userId }, getToken: clerk.identity.getToken };
  await act(async () => root.render(<Providers identityEnabled><Probe overview={overview} /></Providers>));
}
async function settle(index: number, id: string) {
  await act(async () => pending[index].finish(response(id)));
  await act(async () => { await vi.waitFor(() => expect(element.querySelector(".profile strong")?.textContent).toBe(id === "admin" ? "Administrator" : "Waleed")); });
}
beforeEach(() => {
  clerk.listeners.clear();
  vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
  clerk.identity = { userId: "admin", sessionId: "admin-session", isLoaded: true, getToken: vi.fn(async () => "admin-token") };
  clerk.signOut.mockImplementation(async (callback: () => Promise<void>) => callback());
  element = document.createElement("div"); document.body.append(element); root = createRoot(element); pending = [];
  vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((finish) => {
    pending.push({ signal: init.signal as AbortSignal, finish, token: new Headers(init.headers).get("Authorization") ?? "" });
  })));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllEnvs(); });

test("fresh Admin loading never renders the demo Support identity or protected content", async () => {
  await render();
  expect(element.textContent).not.toContain("Waleed");
  expect(element.textContent).not.toContain("وكيل الدعم");
  expect(element.textContent).not.toContain("Protected prompt page");
  await settle(0, "admin");
  expect(element.textContent).toContain("Protected prompt page");
});

test("Strict Mode cleanup does not leave the active account stuck or reuse a retired request", async () => {
  clerk.activeSession = { id: clerk.identity.sessionId, user: { id: clerk.identity.userId }, getToken: clerk.identity.getToken };
  await act(async () => root.render(<StrictMode><Providers identityEnabled><Probe /></Providers></StrictMode>));
  await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
  expect(element.textContent).not.toContain("Waleed");
  await settle(pending.length - 1, "admin");
  expect(element.textContent).toContain("Protected prompt page");
});

test("the live overview greeting uses the validated account rather than the demo identity", async () => {
  await render(true); await settle(0, "admin");
  expect(element.querySelector("h1")?.textContent).toContain("Administrator");
  expect(element.textContent).not.toContain("Waleed");
});

test.each([["support", "admin"], ["admin", "support"]])("%s to %s clears the old cache and cancels delayed permission requests", async (previous, next) => {
  clerk.identity = { ...clerk.identity, userId: previous, sessionId: `${previous}-session`, getToken: vi.fn(async () => `${previous}-token`) };
  await render(); await settle(0, previous);
  const oldClient = currentClient;
  const stale = oldClient.fetchQuery({ queryKey: ["delayed-permissions"], queryFn: () => requestJson("/delayed", z.object({ ok: z.boolean() })) }).catch(() => undefined);
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  clerk.identity = { ...clerk.identity, userId: next, sessionId: `${next}-session`, getToken: vi.fn(async () => `${next}-token`) };
  await render();
  expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
  expect(pending[1].signal.aborted).toBe(true);
  expect(element.textContent).not.toContain(previous === "admin" ? "Administrator" : "Waleed");
  await act(async () => pending[1].finish({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response));
  await stale;
  await settle(2, next);
  expect(currentClient.getQueryData(["delayed-permissions"])).toBeUndefined();
  expect(element.textContent.includes("Protected prompt page")).toBe(next === "admin");
});

test("switching between Clerk sessions for the same user invalidates old results", async () => {
  await render();
  clerk.identity = { ...clerk.identity, sessionId: "another-admin-session", getToken: vi.fn(async () => "other-active-session-token") }; await render();
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[0].finish(response("support")));
  expect(element.textContent).not.toContain("Waleed");
  await settle(1, "admin");
  expect(pending[1].token).toBe("Bearer other-active-session-token");
});

test("a Clerk session selected before React updates cannot send another account's bearer", async () => {
  await render(); await settle(0, "admin");
  clerk.activeSession = { id: "support-other-browser-session", user: { id: "support" }, getToken: vi.fn(async () => "support-token") };
  await expect(requestJson("/permissions", z.object({ ok: z.boolean() }))).rejects.toMatchObject({ code: "session_expired" });
  expect(pending).toHaveLength(1);
});

test("a token resolved after the active Clerk session changes cannot dispatch the old request", async () => {
  let token!: (value: string) => void;
  clerk.identity.getToken = vi.fn(() => new Promise<string>((resolve) => { token = resolve; }));
  await render();
  clerk.activeSession = { id: "support-other-session", user: { id: "support" }, getToken: vi.fn(async () => "support-token") };
  await act(async () => token("admin-token"));
  expect(pending).toHaveLength(0);
  expect(element.textContent).not.toContain("Protected prompt page");
});

test("rapid Admin to Support to Admin ignores responses from both retired sessions", async () => {
  await render();
  clerk.identity = { ...clerk.identity, userId: "support", sessionId: "support-session" }; await render();
  clerk.identity = { ...clerk.identity, userId: "admin", sessionId: "admin-session" }; await render();
  expect(pending[0].signal.aborted).toBe(true); expect(pending[1].signal.aborted).toBe(true);
  await act(async () => { pending[1].finish(response("support")); pending[0].finish(response("admin")); });
  expect(element.textContent).not.toContain("Waleed"); expect(element.textContent).not.toContain("Protected prompt page");
  await settle(2, "admin");
});

test("unloaded Clerk state cannot query using retained user/session fields", async () => {
  clerk.identity.isLoaded = false; await render();
  expect(pending).toHaveLength(0); expect(element.textContent).not.toContain("Waleed");
});

test("a profile belonging to a different actor fails closed", async () => {
  await render();
  await act(async () => pending[0].finish(response("support")));
  expect(element.textContent).not.toContain("Waleed"); expect(element.textContent).not.toContain("Protected prompt page");
});

test("logout completion cannot render the previous identity even before Clerk updates its hook", async () => {
  await render(); await settle(0, "admin");
  await act(async () => element.querySelector<HTMLButtonElement>(".topbar-actions button.button")?.click());
  expect(clerk.redirect).toHaveBeenCalledOnce();
  expect(element.textContent).not.toContain("Administrator"); expect(element.textContent).not.toContain("Protected prompt page");
});

test("a cross-tab Clerk account change clears permissions and cancels requests before React's auth hook updates", async () => {
  await render(); await settle(0, "admin");
  const oldClient = currentClient;
  const stale = requestJson("/permissions", z.object({ ok: z.boolean() })).catch(() => undefined);
  await vi.waitFor(() => expect(pending).toHaveLength(2));
  clerk.activeSession = { id: "support-other-session", user: { id: "support" }, getToken: vi.fn(async () => "support-token") };
  await act(async () => { for (const listener of clerk.listeners) listener({ session: { id: "support-other-session" }, user: { id: "support" } }); });
  expect(oldClient.getQueryCache().getAll()).toHaveLength(0);
  expect(pending[1].signal.aborted).toBe(true);
  expect(element.textContent).not.toContain("Administrator"); expect(element.textContent).not.toContain("Protected prompt page");
  pending[1].finish({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response); await stale;
});

test("ordinary Clerk updates for the active session do not clear permissions or cause logout loops", async () => {
  await render(); await settle(0, "admin");
  await act(async () => { for (const listener of clerk.listeners) listener({ session: { id: "admin-session" }, user: { id: "admin" } }); });
  expect(element.textContent).toContain("Administrator"); expect(element.textContent).toContain("Protected prompt page");
  expect(clerk.redirect).not.toHaveBeenCalled(); expect(clerk.signOut).not.toHaveBeenCalled();
});

test("an old logout finishing after account switch cannot clear or redirect the new session", async () => {
  let finish!: () => Promise<void>;
  clerk.signOut.mockImplementation((callback: () => Promise<void>) => new Promise<void>((resolve) => {
    finish = async () => { await callback(); resolve(); };
  }));
  await render(); await settle(0, "admin");
  await act(async () => element.querySelector<HTMLButtonElement>(".topbar-actions button.button")?.click());
  clerk.identity = { ...clerk.identity, userId: "support", sessionId: "support-session", getToken: vi.fn(async () => "support-token") };
  await render(); await settle(1, "support");
  await act(async () => finish());
  expect(element.textContent).toContain("Waleed"); expect(clerk.redirect).not.toHaveBeenCalled();
  expect(currentClient.getQueryCache().getAll().length).toBeGreaterThan(0);
});
