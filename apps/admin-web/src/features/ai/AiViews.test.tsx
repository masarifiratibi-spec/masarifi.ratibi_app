import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { aiModelsFixture, aiProviderDetailFixture, aiProvidersFixture } from "@/mocks/fixtures/ai";
import { AiModelListView, AiProviderDetailView, AiProviderListView } from "./AiViews";

describe("Spec 006 provider and model views", () => {
  test("renders provider list and detail without credentials or raw payloads", () => {
    const listHtml = renderToStaticMarkup(<AiProviderListView providers={aiProvidersFixture} />);
    const detailHtml = renderToStaticMarkup(<AiProviderDetailView provider={aiProviderDetailFixture} />);

    expect(listHtml).toContain("AIP-OPENAI");
    expect(listHtml).toContain("مزودو الذكاء الاصطناعي");
    expect(listHtml).toContain("<thead>");
    expect(listHtml).toContain("mobile-data-card");
    expect(detailHtml).toContain("receipt_analysis");
    expect(detailHtml).toContain("feature/locale fallback");
    expect(`${listHtml}${detailHtml}`).not.toMatch(/secret|credential|providerPayload|apiKey|token/i);
  });

  test("renders model assignments and safe cost fields", () => {
    const html = renderToStaticMarkup(<AiModelListView models={aiModelsFixture} />);

    expect(html).toContain("AIM-GPT-4O");
    expect(html).toContain("receipt_analysis");
    expect(html).toContain("USD");
  });
});
