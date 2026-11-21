import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "@/core/api/errors";
import { accessRepository } from "./repository";
import { accessQueryKeys, useTemporaryWorkspace } from "./hooks";
import { SIMULATED_ACTORS } from "@/core/permissions/role-map";
import type { TemporaryWorkspace } from "./contracts";

vi.mock("./repository", () => ({ accessRepository: { getWorkspace: vi.fn() } }));
const actor = SIMULATED_ACTORS["support-agent"];
const make = (id: string, milliseconds = 100) => ({ requestId: id, expiresAt: new Date(Date.now() + milliseconds).toISOString(), version: 1 }) as TemporaryWorkspace;
let root: Root, element: HTMLDivElement, client: QueryClient;
let latest: ReturnType<typeof useTemporaryWorkspace>;
function Probe({ id }: { id: string }) { const query = useTemporaryWorkspace(id, "support-agent"); useEffect(() => { latest = query; }, [query]); return <span>{query.data?.requestId ?? (query.expired ? "expired" : "empty")}</span>; }
async function render(id: string) { await act(async () => root.render(<QueryClientProvider client={client}><Probe id={id} /></QueryClientProvider>)); }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  element = document.createElement("div"); document.body.append(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); element.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

test("expires and purges one request without disabling the next direct request", async () => {
  vi.mocked(accessRepository.getWorkspace).mockImplementation(async id => make(id, id === "ACC-OLD" ? 100 : 5000));
  await render("ACC-OLD"); await settle(); expect(element.textContent).toBe("ACC-OLD");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
  expect(element.textContent).toBe("expired"); expect(client.getQueryData(accessQueryKeys.workspace("ACC-OLD", actor))).toBeUndefined();
  await render("ACC-NEW"); await settle(); expect(element.textContent).toBe("ACC-NEW");
});

test("removes previously visible protected data after failed permission or contract revalidation", async () => {
  for (const code of ["forbidden", "contract_mismatch", "recent_auth_required"] as const) {
    vi.mocked(accessRepository.getWorkspace).mockResolvedValue(make("ACC-RECHECK", 5000));
    await render("ACC-RECHECK"); await settle(); expect(latest.data).toBeDefined();
    vi.mocked(accessRepository.getWorkspace).mockRejectedValue(new ApiError(code, "safe", 403));
    await act(async () => { await latest.refetch(); }); await settle();
    expect(latest.data).toBeUndefined(); expect(client.getQueryData(accessQueryKeys.workspace("ACC-RECHECK", actor))).toBeUndefined();
    await render("ACC-RESET"); await settle();
  }
});


test("revalidates a foreground workspace and clears it after an external revoke without a focus change", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  vi.mocked(accessRepository.getWorkspace).mockResolvedValueOnce(make("ACC-FOREGROUND", 30_000)).mockRejectedValue(new ApiError("forbidden", "safe", 403));
  await render("ACC-FOREGROUND"); await settle(); expect(latest.data?.requestId).toBe("ACC-FOREGROUND");
  await act(async () => { vi.advanceTimersByTime(10_000); }); await settle();
  expect(latest.data).toBeUndefined(); expect(client.getQueryData(accessQueryKeys.workspace("ACC-FOREGROUND", actor))).toBeUndefined();
});
