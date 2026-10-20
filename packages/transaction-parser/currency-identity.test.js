"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classifyFinancialMessage } = require("./index");
const parser = require("./index");

const currencyPhrases = [
  [
    "AED",
    [
      "AED",
      "درهم إماراتي",
      "درهم اماراتي",
      "درهم إماراتى",
      "درهم اماراتى",
      "دراهم إماراتية",
      "دراهم اماراتية",
      "د.إ",
      "Dhs",
    ],
  ],
  [
    "EGP",
    [
      "EGP",
      "جنيه مصري",
      "جنيه مصرى",
      "جنية",
      "جنية مصري",
      "جنية مصرى",
      "ج.م",
      "L.E.",
    ],
  ],
  ["SAR", ["SAR", "ريال سعودي", "ريال سعودى", "ر.س"]],
];

for (const channel of ["android_sms", "android_notification"]) {
  for (const [currency, phrases] of currencyPhrases) {
    for (const phrase of phrases) {
      test(`${channel} captures ${phrase} before or after the amount`, () => {
        for (const text of [`Paid ${phrase} ١٢٫٥٠`, `Paid ۱۲٫۵۰ ${phrase}`]) {
          const result = parser.discoverNominalTrackingMessage(
            { text, channel, sender: "example.synthetic.source" },
            parser.defaultSnapshot,
            [],
            [],
            { sourceAdmissionPolicy: "financial_content_v1" },
          );
          assert.equal(result.sourceAmountDecimal, "12.5", text);
          assert.equal(result.classification.currency, currency, text);
          assert.equal(result.classification.amountMinor, 1250, text);
          assert.equal(
            result.classification.disposition,
            "capture_candidate",
            text,
          );
        }
      });
    }
  }
}

test("compiled native policy adds currency phrases without mutating the published snapshot", () => {
  const before = JSON.stringify(parser.defaultSnapshot);
  const policy = parser.compileFinancialDiscoveryPolicy(parser.defaultSnapshot);
  for (const [code, phrases] of currencyPhrases) {
    const currency = policy.currencies.find(
      (currency) => currency.code === code,
    );
    for (const phrase of phrases)
      assert.ok(currency.aliases.includes(phrase), phrase);
    assert.ok(currency.aliases.length <= 16);
  }
  assert.equal(JSON.stringify(parser.defaultSnapshot), before);
});

test("Arabic number words recognize the same currency phrases in both channels", () => {
  for (const channel of ["android_sms", "android_notification"]) {
    for (const [currency, phrases] of currencyPhrases) {
      for (const phrase of phrases) {
        const text = `تم دفع خمسين ${phrase}`;
        const result = parser.discoverNominalTrackingMessage(
          { text, channel, sender: "example.synthetic.source" },
          parser.defaultSnapshot,
          [],
          [],
          { sourceAdmissionPolicy: "financial_content_v1" },
        );
        assert.equal(result.sourceAmountDecimal, "50", text);
        assert.equal(result.classification.currency, currency, text);
        assert.equal(result.classification.amountMinor, 5000, text);
        assert.equal(
          result.classification.disposition,
          "capture_candidate",
          text,
        );
      }
    }
  }
});

test("native compilation retains configured aliases when the currency vocabulary is full", () => {
  const snapshot = structuredClone(parser.defaultSnapshot);
  const configured = snapshot.currencies.find(
    (currency) => currency.code === "EGP",
  );
  configured.aliases = Array.from(
    { length: 16 },
    (_, index) => `synthetic${index}`,
  );
  const policy = parser.compileFinancialDiscoveryPolicy(snapshot);
  assert.deepEqual(
    policy.currencies.find((currency) => currency.code === "EGP").aliases,
    configured.aliases,
  );
});

test("expanded currency phrases preserve lifecycle and amount disambiguation in both channels", () => {
  for (const channel of ["android_sms", "android_notification"]) {
    for (const text of [
      "Paid Dhs 12.50 OTP 123456",
      "Paid L.E. 12.50 offer",
      "Paid جنية 12.50 pending",
      "Paid دراهم إماراتية 12.50 failed",
      "Paid Dhs 12.50 and EGP 12.50",
      "Paid Dhs 12.501",
    ]) {
      const result = parser.discoverNominalTrackingMessage(
        { text, channel, sender: "example.synthetic.source" },
        parser.defaultSnapshot,
        [],
        [],
        { sourceAdmissionPolicy: "financial_content_v1" },
      );
      assert.notEqual(
        result.classification.disposition,
        "capture_candidate",
        text,
      );
    }
  }
});

for (const [text, currency, amountMinor] of [
  ["Paid 25 ريال عماني", "OMR", 25000],
  ["Paid ١٫٢٥٠ ريال عماني", "OMR", 1250],
  ["Paid ريال عُماني 1.250", "OMR", 1250],
  ["Paid 1.250 ر.ع", "OMR", 1250],
  ["Paid 1.250 دينار بحريني", "BHD", 1250],
  ["Paid 25 ريال قطري", "QAR", 2500],
  ["Paid 25 ريال سعودي", "SAR", 2500],
  ["Paid 25 ريال", "SAR", 2500],
  ["Paid 1.250 دينار كويتي", "KWD", 1250],
]) {
  test(`qualified currency preserves its identity and scale: ${text}`, () => {
    const result = classifyFinancialMessage({
      text,
      receivedAt: Date.parse("2026-10-18T10:00:00Z"),
    });
    assert.equal(result.currency, currency);
    assert.equal(result.amountMinor, amountMinor);
    assert.equal(result.disposition, "capture_candidate");
  });
}

test("conflicting explicit currencies are held for review", () => {
  const result = classifyFinancialMessage({
    text: "Paid 25 ريال عماني / SAR 25",
  });
  assert.equal(result.disposition, "review");
  assert.ok(result.reasonCodes.includes("amount_conflict"));
});
