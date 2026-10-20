"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const parser = require("./index");
const policy = { sourceAdmissionPolicy: "financial_content_v1" };
test("receipt wording identifies completed incoming money in content-policy SMS and notifications", () => {
  const input = {
    text: "You have received  1.00 EGP from example@wallet",
    channel: "android_notification",
  };
  for (const sender of ["com.egyptianbanks.instapay", "example.new.wallet"]) {
    const result = parser.discoverNominalTrackingMessage(
      { ...input, sender },
      parser.defaultSnapshot,
      [],
      [],
      policy,
    );
    assert.equal(result.strong, true);
    assert.equal(result.classification.direction, "incoming");
    assert.equal(result.classification.status, "completed");
    assert.equal(result.classification.amountMinor, 100);
    assert.equal(result.classification.currency, "EGP");
  }
  const sms = parser.discoverNominalTrackingMessage(
    { ...input, sender: "TESTBANK", channel: "android_sms" },
    parser.defaultSnapshot,
    [],
    [],
    policy,
  );
  assert.equal(sms.strong, true);
  assert.equal(sms.classification.direction, "incoming");
  assert.equal(sms.classification.amountMinor, 100);
  const legacySms = parser.discoverNominalTrackingMessage(
    { ...input, sender: "TESTBANK", channel: "android_sms" },
    parser.defaultSnapshot,
    [],
    [{ normalizedSender: "TESTBANK", enabled: true, trusted: true }],
  );
  assert.equal(legacySms.strong, false);
  assert.ok(legacySms.classification.reasonCodes.includes("action_unknown"));
});

test("receipt notification wording never bypasses OTP, marketing or failed state", () => {
  for (const channel of ["android_sms", "android_notification"]) {
    for (const suffix of [" OTP 123456", " offer", " failed"]) {
      const result = parser.discoverNominalTrackingMessage(
        {
          text: "You have received 1.00 EGP from example@wallet" + suffix,
          sender: "example.new.wallet",
          channel,
        },
        parser.defaultSnapshot,
        [],
        [],
        policy,
      );
      assert.equal(result.strong, false, suffix);
    }
  }
});

test("a pending receipt remains unresolved instead of becoming a completed transaction", () => {
  for (const channel of ["android_sms", "android_notification"]) {
    const result = parser.discoverNominalTrackingMessage(
      {
        text: "You have received 1.00 EGP from example@wallet pending",
        sender: "example.new.wallet",
        channel,
      },
      parser.defaultSnapshot,
      [],
      [],
      policy,
    );
    assert.equal(result.classification.status, "pending");
    assert.notEqual(result.classification.disposition, "capture_candidate");
  }
});
test("content admission excludes Signal, Viber, Slack and Teams", () => {
  for (const sender of [
    "org.thoughtcrime.securesms",
    "com.viber.voip",
    "com.Slack",
    "com.microsoft.teams",
  ]) {
    const result = parser.discoverNominalTrackingMessage(
      { text: "Paid SAR2", sender, channel: "android_notification" },
      parser.defaultSnapshot,
      [],
      [],
      policy,
    );
    assert.equal(result.eligibleSource, false, sender);
  }
});
const discover = (
  text,
  sender,
  channel,
  overrides = [],
  sources = [],
  options = policy,
) =>
  parser.discoverNominalTrackingMessage(
    {
      text,
      sender,
      channel,
      country: "SA",
      receivedAt: Date.parse("2026-10-14T13:00:00Z"),
    },
    parser.defaultSnapshot,
    overrides,
    sources,
    options,
  );

test("content policy admits personal SMS with extracted debit without granting legacy eligibility", () => {
  const result = discover(
    "تم خصم 2 ريال، الرصيد 950 ريال",
    "+966500000001",
    "android_sms",
  );
  assert.equal(result.eligibleSource, true);
  assert.equal(result.strong, true);
  assert.equal(result.sourceAmountDecimal, "2");
  assert.equal(result.classification.amountMinor, 200);
  assert.equal(result.classification.direction, "outgoing");
  assert.equal(result.classification.disposition, "capture_candidate");
  assert.equal(
    discover("تم خصم 2 ريال", "+966500000001", "android_sms", [], [], {})
      .eligibleSource,
    false,
  );
});

test("content policy admits an unknown non-chat application and extracts income", () => {
  const result = discover(
    "تم إيداع خمسة ريال",
    "example.new.wallet",
    "android_notification",
  );
  assert.equal(result.eligibleSource, true);
  assert.equal(result.strong, true);
  assert.equal(result.sourceAmountDecimal, "5");
  assert.equal(result.classification.direction, "incoming");
  assert.equal(result.classification.status, "completed");
});

test("content policy excludes chat applications even when explicitly trusted", () => {
  for (const sender of parser.excludedFinancialPackages) {
    const result = discover(
      "تم دفع 2 ريال",
      sender,
      "android_notification",
      [],
      [{ normalizedSender: sender, enabled: true, trusted: true }],
    );
    assert.equal(result.eligibleSource, false, sender);
    assert.equal(result.strong, false, sender);
  }
});

test("an explicit source block wins over content admission", () => {
  const result = discover(
    "تم دفع 2 ريال",
    "example.new.wallet",
    "android_notification",
    [],
    [{ normalizedSender: "example.new.wallet", enabled: false, trusted: true }],
  );
  assert.equal(result.eligibleSource, false);
  assert.equal(result.strong, false);
});

test("content admission preserves OTP, request, failed and pending exclusions", () => {
  for (const text of [
    "OTP 1234 purchase SAR2",
    "Please pay SAR2",
    "Payment SAR2 failed",
    "Payment SAR2 pending",
    "عرض خاص دفع 2 ريال",
  ]) {
    const result = discover(text, "example.new.wallet", "android_notification");
    assert.notEqual(
      result.classification.disposition,
      "capture_candidate",
      text,
    );
    assert.notEqual(result.classification.status, "completed", text);
  }
});

test("disabled action keywords do not regain financial candidacy through content policy", () => {
  const result = discover("تم دفع 2 ريال", "+966500000001", "android_sms", [
    { value: "دفع", enabled: false },
  ]);
  assert.equal(result.strong, false);
  assert.equal(result.classification.direction, "unknown");
});

test("content admission never assigns a direction to a bare amount or ambiguous transfer", () => {
  for (const text of [
    "مبلغ 2 ريال",
    "حوالة من: حساب 1111 إلى: حساب 2222 مبلغ 2 ريال",
  ]) {
    const result = discover(text, "+966500000001", "android_sms");
    assert.equal(result.classification.direction, "unknown");
    assert.notEqual(result.classification.disposition, "capture_candidate");
  }
});
