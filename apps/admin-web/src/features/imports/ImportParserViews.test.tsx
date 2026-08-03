import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { phase4Records } from "@/mocks/fixtures/imports";
import type { OperationalRecord } from "./contracts";
import { RecordCards, RecordRows } from "./ImportsViews";
import { operationalCopy } from "./operationalCopy";

describe("Spec 005 operational record presentation", () => {
  test("renders safe session links, statuses, and masked summaries", () => {
    const html = renderToStaticMarkup(
      <table><tbody><RecordRows records={phase4Records.sessions} /></tbody></table>,
    );

    expect(html).toContain("/admin/imports/sessions/IMP-77241");
    expect(html).toContain("USR-10***");
    expect(html).toContain("failed");
    expect(html).toContain("PV-3182");
    expect(html).not.toMatch(/\b\d{10,}\b/);
    expect(html).not.toContain("rawMessage");
    expect(html).not.toContain("amount");
  });

  test("renders bank and parser detail links in mobile cards", () => {
    const html = renderToStaticMarkup(
      <RecordCards records={[...phase4Records.banks, ...phase4Records["parser-rules"]]} copy={operationalCopy.ar} />,
    );

    expect(html).toContain("/admin/parsers/banks/BNK-001");
    expect(html).toContain("/admin/parsers/rules/PRL-001");
    expect(html).toContain("mobile-cards");
  });

  test("escapes untrusted record text instead of interpreting markup", () => {
    const unsafe: OperationalRecord = {
      ...phase4Records.failures[0],
      title: "<img src=x onerror=alert(1)>",
    };
    const html = renderToStaticMarkup(
      <table><tbody><RecordRows records={[unsafe]} /></tbody></table>,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  test("keeps parser samples explicitly fictional and customer-free", () => {
    const parser = phase4Records["parser-rules"][0];
    expect(parser.fictionalSample).toMatch(/^FICTIONAL:/);
    expect(parser.fictionalSample).not.toMatch(/USR-|account|phone|email/i);
  });

  test("keeps sender and category rule metadata bounded and plain text", () => {
    const html = renderToStaticMarkup(
      <RecordCards records={[...phase4Records.senders, ...phase4Records["category-rules"]]} copy={operationalCopy.ar} />,
    );

    expect(html).toContain("SND-001");
    expect(html).toContain("CR-001");
    expect(html).toContain("demo-store");
    expect(html).not.toContain("rawPayload");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
