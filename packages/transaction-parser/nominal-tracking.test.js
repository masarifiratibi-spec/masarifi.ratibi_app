"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const p = require("./index");

test("a balance clause cannot hide a later movement", () => {
  const r = p.classifyFinancialMessage({
    text: "تم خصم 50 ريال، الرصيد 950 ريال، دفع 20 ريال",
  });
  assert.equal(r.amountMinor, null);
  assert.ok(r.reasonCodes.includes("amount_conflict"));
});

test("nominal extraction reads Arabic words and separates currency-free balances", () => {
  assert.equal(typeof p.discoverNominalTrackingMessage, "function");
  for (const [text, want] of [
    ["تم دفع خمسين ريال", "50"],
    ["تم خصم 50، الرصيد 950", "50"],
    ["تم دفع خمسة وعشرين ريال", "25"],
    ["تم دفع واحد وعشرين ريال", "21"],
    ["تم دفع أربعين ريال", "40"],
    ["Paid 12.50 EGP. Available balance EGP950", "12.5"],
  ]) {
    const r = p.discoverNominalTrackingMessage(
      { text, sender: "BANK", channel: "android_sms" },
      p.defaultSnapshot,
      [],
    );
    assert.equal(r.sourceAmountDecimal, want, text);
    assert.equal(r.classification.direction, "outgoing", text);
    assert.equal(r.classification.status, "completed", text);
  }
});

test("nominal discovery excludes chat packages regardless of financial wording", () => {
  assert.equal(typeof p.discoverNominalTrackingMessage, "function");
  const r = p.discoverNominalTrackingMessage(
    {
      text: "تم دفع خمسين ريال",
      sender: "com.whatsapp",
      channel: "android_notification",
    },
    p.defaultSnapshot,
    [],
  );
  assert.equal(r.eligibleSource, false);
  assert.equal(r.strong, false);
});
test("Arabic dual forms are complete amounts and unsupported fragments never become money", () => {
  for (const text of ["تم دفع اثنا عشر ريال", "تم دفع اثنتا عشرة ريال"]) {
    assert.equal(
      p.discoverNominalTrackingMessage(
        { text, sender: "BANK", channel: "android_sms" },
        p.defaultSnapshot,
        [],
      ).sourceAmountDecimal,
      "12",
    );
  }
  for (const text of [
    "تم دفع خمسين ونصف ريال",
    "تم دفع واحد مليار ريال",
    "تم دفع خمسين خمسين ريال",
    "تم دفع واحد واحد ريال",
    "تم دفع 50 ونصف ريال",
    `Paid SAR50 ${" ".repeat(8001)} failed`,
  ]) {
    assert.equal(
      p.discoverNominalTrackingMessage(
        { text, sender: "BANK", channel: "android_sms" },
        p.defaultSnapshot,
        [],
      ).sourceAmountDecimal,
      null,
    );
  }
});

test("nominal extraction keeps lifecycle, conflicting amounts and missing action unresolved", () => {
  assert.equal(typeof p.discoverNominalTrackingMessage, "function");
  for (const text of [
    "Payment 50 EGP pending",
    "Payment 50 EGP failed",
    "Please pay 50 EGP",
    "OTP 1234 purchase 50 EGP",
    "Purchase 50 EGP and payment 20 EGP",
  ]) {
    const r = p.discoverNominalTrackingMessage(
      { text, sender: "BANK", channel: "android_sms" },
      p.defaultSnapshot,
      [],
    );
    assert.notEqual(r.classification.disposition, "capture_candidate", text);
  }
  assert.equal(
    p.discoverNominalTrackingMessage(
      {
        text: "تم خصم 50، الرصيد 950، دفع 20",
        sender: "BANK",
        channel: "android_sms",
      },
      p.defaultSnapshot,
      [],
    ).sourceAmountDecimal,
    null,
  );
});

test("separates only an explicitly additional fee from a completed principal", () => {
  const source = [{ normalizedSender: "BANK", enabled: true, trusted: true }];
  for (const text of [
    "Paid EGP50; additional fee EGP2",
    "تم دفع 50 ريال، رسوم إضافية 2 ريال",
  ]) {
    const r = p.discoverNominalTrackingMessage(
      { text, sender: "BANK" },
      p.defaultSnapshot,
      [],
      source,
    );
    assert.deepEqual(
      r.movements?.map((x) => [x.component, x.sourceAmountDecimal]),
      [
        ["principal", "50"],
        ["fee", "2"],
      ],
    );
  }
  for (const text of [
    "Paid EGP50; fee EGP2",
    "Paid EGP50 including additional fee EGP2",
    "Payment EGP50 pending; additional fee EGP2",
  ]) {
    assert.equal(
      p.discoverNominalTrackingMessage(
        { text, sender: "BANK" },
        p.defaultSnapshot,
        [],
        source,
      ).movements,
      undefined,
    );
  }
});
