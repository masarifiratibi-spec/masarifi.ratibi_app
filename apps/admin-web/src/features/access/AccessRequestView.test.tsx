import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrentPermissionsProvider } from "@/core/permissions/current-permissions";
import { AccessRequestCards, AccessRequestRows, AccessRequestView } from "./AccessRequestView";
import { createAccessFixtures } from "@/mocks/fixtures/access";

describe("access request view", () => {
  test("live access creation uses granted authority and starts without fixture targets", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const render = (permissions: string[]) => renderToStaticMarkup(
      <QueryClientProvider client={client}><CurrentPermissionsProvider permissions={new Set(permissions)}><AccessRequestView /></CurrentPermissionsProvider></QueryClientProvider>,
    );
    try {
      expect(render([])).not.toContain('<form');
      const allowed = render(["support.access.request"]);
      expect(allowed).toContain('<form');
      expect(allowed).not.toContain('value="USR-10461"');
      expect(allowed).not.toContain('value="TKT-12002"');
      expect(allowed).not.toContain('value="ADM-DEMO-SUPPORT-01"');
    } finally { client.clear(); vi.unstubAllEnvs(); }
  });
  test("renders masked required columns and accessible detail links", () => {
    const html = renderToStaticMarkup(<table><tbody><AccessRequestRows requests={createAccessFixtures().slice(0, 1)} /></tbody></table>);
    expect(html).toContain("ACC-1001");
    expect(html).toContain("TKT-12001");
    expect(html).toContain("***@example.test");
    expect(html).toContain("/admin/access-requests/ACC-1001");
    expect(html).not.toContain("noura@");
  });

  test("mobile alternative includes reason and absolute access window", () => {
    const request = createAccessFixtures().find((candidate) => candidate.status === "active");
    expect(request).toBeDefined();
    const html = renderToStaticMarkup(<AccessRequestCards requests={request ? [request] : []} />);
    expect(html).toContain(request?.reasonSummary ?? "");
    expect(html).toContain(request?.startsAt ?? "");
    expect(html).toContain(request?.expiresAt ?? "");
  });
});
