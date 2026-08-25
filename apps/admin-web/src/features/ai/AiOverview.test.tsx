import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LocaleProvider } from "@/core/localization/provider";
import { aiOverviewFixture } from "@/mocks/fixtures/ai";
import { AiOverview } from "./AiOverview";

function renderAiOverview(locale: "ar" | "en") {
  return renderToStaticMarkup(
    <LocaleProvider locale={locale} setLocale={() => undefined}>
      <AiOverview overview={aiOverviewFixture} />
    </LocaleProvider>,
  );
}

describe("Spec 006 AI overview view", () => {
  test.each([
    ["ar", ["إدارة الذكاء الاصطناعي", "الطلبات الأصلية", "المحاولات", "محاولات الاحتياط", "غير معروف"]],
    ["en", ["AI Management", "Original requests", "Attempts", "Fallback attempts", "Unknown"]],
  ] as const)("renders required %s metrics, filters, and drill-down links", (locale, labels) => {
    const html = renderAiOverview(locale);

    labels.forEach((label) => expect(html).toContain(label));
    expect(html).toContain("USD");
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
