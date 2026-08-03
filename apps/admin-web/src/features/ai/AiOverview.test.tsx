import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { aiOverviewFixture } from "@/mocks/fixtures/ai";
import { AiOverview } from "./AiOverview";

describe("Spec 006 AI overview view", () => {
  test("renders required metrics, units, freshness, platform filters, and drill-down links", () => {
    const html = renderToStaticMarkup(<AiOverview overview={aiOverviewFixture} />);

    expect(html).toContain("إدارة الذكاء الاصطناعي");
    expect(html).toContain("AI Management");
    expect(html).toContain("Original requests");
    expect(html).toContain("Attempts");
    expect(html).toContain("Fallback attempts");
    expect(html).toContain("USD");
    expect(html).toContain("unknown");
    expect(html).toContain("/admin/ai/providers");
    expect(html).toContain("/admin/ai/failures");
    expect(html).not.toMatch(/rawPrompt|providerPayload|apiKey|token/i);
  });

  test("renders an accessible empty region without fabricating zero-value cards", () => {
    const html = renderToStaticMarkup(<AiOverview overview={{
      ...aiOverviewFixture,
      metrics: [],
      featureDistribution: [],
      providerDistribution: [],
      platformDistribution: [],
      trend: [],
      costByCurrency: [],
      regions: {
        metrics: { availability: "empty" },
        charts: { availability: "empty" },
      },
    }} />);

    expect(html).toContain('role="status"');
    expect(html).toContain("لا توجد بيانات");
  });
});
