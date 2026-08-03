import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ExpiredWorkspace, WorkspaceProjection } from "./TemporaryAccessWorkspace";

describe("temporary access workspace", () => {
  test("shows persistent context and only approved classified sections", () => {
    const html = renderToStaticMarkup(<WorkspaceProjection workspace={{
      requestId: "ACC-1003",
      supportTicketId: "TKT-12003",
      assignee: "ADM-DEMO-SUPPORT",
      status: "active",
      approvedScope: ["session-diagnostics"],
      startsAt: "2026-07-28T06:10:00.000Z",
      expiresAt: "2099-07-28T06:40:00.000Z",
      accessNotice: "وصول مؤقت ومراقب",
      auditIndicator: "AUD-ACC-1003-2",
      sections: [{
        scope: "session-diagnostics",
        title: "تشخيص الجلسات",
        fields: [{ label: "الجلسات النشطة", value: 1, classification: "aggregate" }],
      }],
      region: { availability: "available" },
    }} />);
    expect(html).toContain("TKT-12003");
    expect(html).toContain("ADM-DEMO-SUPPORT");
    expect(html).toContain("aggregate");
    expect(html).toContain("تشخيص الجلسات");
    expect(html).not.toContain("بيانات التواصل");
  });

  test("expired state contains no protected projection", () => {
    const html = renderToStaticMarkup(<ExpiredWorkspace />);
    expect(html).toContain("انتهت صلاحية الوصول المؤقت");
    expect(html).not.toContain("الجلسات النشطة");
    expect(html).not.toContain("workspace-note");
  });
});
