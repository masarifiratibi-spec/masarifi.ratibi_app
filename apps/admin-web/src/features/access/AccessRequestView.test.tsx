import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AccessRequestCards, AccessRequestRows } from "./AccessRequestView";
import { createAccessFixtures } from "@/mocks/fixtures/access";

describe("access request view", () => {
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
