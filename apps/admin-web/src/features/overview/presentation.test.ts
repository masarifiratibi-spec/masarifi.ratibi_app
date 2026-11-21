import { describe, expect, it } from "vitest";
import {
  formatOverviewMetric,
  planLabel,
  paidCustomerNote,
} from "./presentation";

describe("truthful overview presentation", () => {
  it.each([0, 12, 1234])("renders the actual numeric value %i", (value) => {
    expect(
      formatOverviewMetric(
        { id: "imports", numericValue: value, formattedValue: String(value) },
        "en",
      ),
    ).toBe(String(value));
    expect(
      formatOverviewMetric(
        { id: "mrr", numericValue: value, formattedValue: `${value} USD` },
        "en",
      ),
    ).toBe(`${value} USD`);
  });
  it("distinguishes unknown from zero", () => {
    expect(
      formatOverviewMetric(
        { id: "mrr", numericValue: null, formattedValue: "0" },
        "en",
      ),
    ).toBe("Unavailable");
  });
  it("uses the plan key and the actual paid ratio", () => {
    expect(planLabel("Premium", "en")).toBe("Premium");
    expect(planLabel("unclassified", "en")).toBe("Unclassified");
    expect(paidCustomerNote(12, 48, "en")).toBe("25% of total");
    expect(paidCustomerNote(null, 48, "en")).toBeUndefined();
  });
});
