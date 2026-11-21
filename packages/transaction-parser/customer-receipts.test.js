"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const parser = require("./index");

// Customer SMS reported 2026-11-12: the available balance is not another purchase.
const flexiblePay =
  "Your FlexiblePay card ending with 4753 has been used for USD 5.25 at ANTHROPIC +14152360599 US. Avl. Bal. is USD 17.95";
for (const channel of ["android_sms", "android_notification"]) {
  test(`${channel}: FlexiblePay keeps purchase amount, currency and card suffix`, () => {
    const input = {
      text: flexiblePay,
      sender: "FlexiblePay",
      channel,
      country: "AE",
      receivedAt: Date.parse("2026-11-12T08:00:00Z"),
    };
    const classified = parser.classifyFinancialMessage(input);
    assert.equal(classified.amountMinor, 525);
    assert.equal(classified.currency, "USD");
    assert.equal(classified.disposition, "capture_candidate");
    assert.deepEqual(classified.instruments, [
      { role: "card", suffix: "4753" },
    ]);
    const nominal = parser.discoverNominalTrackingMessage(
      input,
      parser.defaultSnapshot,
      [],
      [],
      { sourceAdmissionPolicy: "financial_content_v1" },
    );
    assert.equal(nominal.strong, true);
    assert.equal(nominal.eligibleSource, true);
    assert.equal(nominal.sourceAmountDecimal, "5.25");
    assert.equal(nominal.classification.amountMinor, 525);
    assert.equal(nominal.classification.disposition, "capture_candidate");
    assert.deepEqual(nominal.classification.reasonCodes, []);
  });
}

for (const balance of [
  "Avl. Bal. is AED 17.95",
  "Avl Bal is USD 17.95",
  "Available Balance is USD 17.95",
]) {
  test(`keeps the transaction currency separate from ${balance}`, () => {
    const result = parser.discoverNominalTrackingMessage(
      {
        text: `Paid USD 5.25. ${balance}`,
        sender: "FlexiblePay",
        channel: "android_sms",
      },
      parser.defaultSnapshot,
      [],
      [],
      { sourceAdmissionPolicy: "financial_content_v1" },
    );
    assert.equal(result.sourceAmountDecimal, "5.25");
    assert.equal(result.classification.currency, "USD");
    assert.equal(result.classification.amountMinor, 525);
    assert.equal(result.classification.disposition, "capture_candidate");
  });
}

test("two real purchase amounts remain unresolved even with an abbreviated balance", () => {
  const result = parser.discoverNominalTrackingMessage(
    {
      text: "Purchase USD 5.25 and USD 2.00. Avl. Bal. is USD 17.95",
      sender: "FlexiblePay",
      channel: "android_sms",
    },
    parser.defaultSnapshot,
    [],
    [],
    { sourceAdmissionPolicy: "financial_content_v1" },
  );
  assert.equal(result.sourceAmountDecimal, null);
  assert.equal(result.classification.disposition, "review");
  assert.ok(result.classification.reasonCodes.includes("amount_conflict"));
});
