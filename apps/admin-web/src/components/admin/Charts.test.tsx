import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CHART_SERIES, ChartCard } from "./Charts";

describe("admin charts", () => {
  test("keeps the text summary available to assistive technology", () => {
    const html = renderToStaticMarkup(
      <ChartCard title="النمو" summary="ارتفع العدد من 10 إلى 20.">
        <div>chart</div>
      </ChartCard>,
    );

    expect(html).toContain("sr-only");
    expect(html).toContain("ارتفع العدد من 10 إلى 20.");
  });

  test("uses semantic CSS tokens for every chart series", () => {
    expect(CHART_SERIES).toHaveLength(4);
    expect(CHART_SERIES.every((color) => color.startsWith("var(--chart-"))).toBe(true);
    expect(CHART_SERIES.join("")).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
