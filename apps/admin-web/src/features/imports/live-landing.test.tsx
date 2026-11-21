import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test } from "vitest";
import ImportsPage from "@/app/admin/imports/page";
import { importOverviewSchema, operationalListSchema } from "./contracts";
import { phase4QueryKeys } from "./hooks";

afterEach(() => { delete process.env.NEXT_PUBLIC_ENABLE_MOCKS; });

test("live imports describe completed sessions without demo charts or unsupported retry actions", () => {
  process.env.NEXT_PUBLIC_ENABLE_MOCKS = "false";
  const client = new QueryClient();
  client.setQueryData(phase4QueryKeys.overview("all"), importOverviewSchema.parse({
    platform: "all", uniqueCustomers: 1, uniqueCustomerSemantics: "authoritative",
    totalSessions: 1, totalItems: 1, failedSessions: 0, highestFailureSource: "manual",
    eventDeduplication: "non_duplicated_events", region: { availability: "available" },
  }));
  client.setQueryData(phase4QueryKeys.list("sessions", {
    platform: "all", sort: "updatedAt", order: "desc", page: 1, pageSize: 25,
  }), operationalListSchema.parse({
    items: [{
      id: "99000000-0000-4000-8000-000000000001", kind: "sessions", title: "Completed session",
      secondary: "sms", source: "sms", status: "complete", updatedAt: "2026-10-23T00:00:00Z",
      revision: 4, accessLevel: "limited", actions: [], attempts: 1,
    }],
    page: 1, pageSize: 25, totalItems: 1, totalPages: 1, region: { availability: "available" },
  }));
  try {
    const markup = renderToStaticMarkup(<QueryClientProvider client={client}><ImportsPage /></QueryClientProvider>);
    expect(markup).toContain("جلسات الاستيراد");
    expect(markup).toContain("Completed session");
    expect(markup).not.toContain("1.4");
    expect(markup).not.toContain("2.8");
    expect(markup).not.toContain("إعادة المحاولة");
    expect(markup).not.toContain("<strong>manual</strong>");
  } finally {
    client.clear();
  }
});
