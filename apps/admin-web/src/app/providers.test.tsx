import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiActorCacheKey, liveCursor, rememberLiveCursor } from "@/core/api/client";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Providers } from "./providers";

const clerk = vi.hoisted(() => ({
  identity: { userId: "support", sessionId: "session-support", isLoaded: true, getToken: vi.fn(async () => "support-token") },
  signOut: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => clerk.identity, useClerk: () => ({ signOut: clerk.signOut, get session() { return { id: clerk.identity.sessionId, user: { id: clerk.identity.userId }, getToken: clerk.identity.getToken }; } }) }));
vi.mock("@/core/auth/sign-in-navigation", () => ({ returnToAdminSignIn: clerk.redirect }));
vi.mock("./MockProvider", () => ({ MockProvider: ({ children }: { children: React.ReactNode }) => children }));

let root: Root;
let element: HTMLDivElement;
let currentClient: QueryClient;
const clients: QueryClient[] = [];
function Probe() {
  const client = useQueryClient();
  useEffect(() => { currentClient = client; clients.push(client); }, [client]);
  return <SignOutButton />;
}
async function render(enabled = true) {
  await act(async () => root.render(<Providers identityEnabled={enabled}><Probe /></Providers>));
}
async function click() {
  await act(async () => element.querySelector("button")?.click());
}
beforeEach(() => {
  element = document.createElement("div"); document.body.append(element); root = createRoot(element);
  clients.length = 0;
  clerk.identity = { userId: "support", sessionId: "session-support", isLoaded: true, getToken: vi.fn(async () => "support-token") };
  clerk.signOut.mockImplementation(async (callback: () => Promise<void>) => callback());
});
afterEach(async () => { await act(async () => root.unmount()); });

describe("Admin current-session sign out", () => {
  test("is visible for authenticated users, hidden for demo, loading and signed-out users", async () => {
    await render(); expect(element.textContent).toContain("تسجيل الخروج");
    await render(false); expect(element.querySelector("button")).toBeNull();
    clerk.identity.isLoaded = false; await render(); expect(element.querySelector("button")).toBeNull();
    clerk.identity.isLoaded = true; clerk.identity.userId = ""; clerk.identity.sessionId = "";
    await render(); expect(element.querySelector("button")).toBeNull();
    expect(clerk.signOut).not.toHaveBeenCalled();
  });

  test("terminates only the current Clerk session, clears Admin cache, and then redirects to sign-in", async () => {
    await render();
    currentClient.setQueryData(["permissions"], { permissions: ["support.read"] });
    liveCursor("users", 1); rememberLiveCursor("users", 1, "old-cursor");
    sessionStorage.setItem("unrelated-session", "keep"); localStorage.setItem("unrelated-preference", "keep");
    await click();
    expect(clerk.signOut).toHaveBeenCalledWith(expect.any(Function), { sessionId: "session-support" });
    expect(currentClient.getQueryCache().getAll()).toHaveLength(0);
    expect(apiActorCacheKey()).not.toBe("support");
    expect(clerk.redirect).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("unrelated-session")).toBe("keep");
    expect(localStorage.getItem("unrelated-preference")).toBe("keep");
  });

  test("does not redirect or pretend to terminate a session when Clerk rejects logout; allows retry", async () => {
    clerk.signOut.mockRejectedValueOnce(new Error("provider failure with private details"));
    await render(); currentClient.setQueryData(["permissions"], { permissions: ["support.read"] });
    await click();
    expect(clerk.redirect).not.toHaveBeenCalled();
    expect(currentClient.getQueryData(["permissions"])).toBeDefined();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain("تعذر تسجيل الخروج");
    expect(element.textContent).not.toContain("private details");
    await click(); expect(clerk.redirect).toHaveBeenCalledOnce();
  });

  test("prevents repeated clicks while session termination is pending", async () => {
    let finish!: () => void;
    clerk.signOut.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    await render(); await click(); await click();
    expect(element.querySelector("button")?.disabled).toBe(true);
    expect(clerk.signOut).toHaveBeenCalledOnce();
    await act(async () => finish());
  });

  test("Support to Admin switch has fresh permission and cursor state, including new sessions for the same user", async () => {
    await render(); const supportClient = currentClient;
    supportClient.setQueryData(["permissions"], { permissions: ["support.read"] });
    liveCursor("users", 1); rememberLiveCursor("users", 1, "support-cursor");
    await click();
    clerk.identity = { ...clerk.identity, userId: "admin", sessionId: "session-admin", getToken: vi.fn(async () => "admin-token") };
    await render();
    expect(currentClient).not.toBe(supportClient);
    expect(currentClient.getQueryData(["permissions"])).toBeUndefined();
    expect(apiActorCacheKey()).toBe("admin");
    expect(() => liveCursor("users", 2)).toThrow("CURSOR_PAGE_UNAVAILABLE");
    currentClient.setQueryData(["permissions"], { permissions: ["ai.prompts.publish", "ai.routes.manage"] });
    const adminClient = currentClient;
    clerk.identity.sessionId = "session-admin-new"; await render();
    expect(currentClient).not.toBe(adminClient);
    expect(currentClient.getQueryData(["permissions"])).toBeUndefined();
    expect(clerk.signOut).toHaveBeenCalledOnce();
  });
});
