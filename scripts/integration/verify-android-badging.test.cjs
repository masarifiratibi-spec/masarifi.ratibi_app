const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verifyBadging } = require("./verify-android-badging.cjs");

const approved = {
  app: {
    expo: {
      name: "مصاريفي وراتبي",
      android: { package: "com.masarifi.mobile" },
    },
  },
};
const badging =
  "package: name='com.masarifi.mobile' versionCode='136' versionName='1.0.0'\napplication-label:'مصاريفي وراتبي'\napplication-label-ar:'مصاريفي وراتبي'\n";

test("accepts the compiled exact reviewed package and Unicode display name", () => {
  verifyBadging(badging, approved);
  verifyBadging(badging.replaceAll("\n", "\r\n"), approved);
});

for (const [name, transform] of Object.entries({
  oldLabel: (text) =>
    text.replace(
      "application-label:'مصاريفي وراتبي'",
      "application-label:'Masarifi Ratibi'",
    ),
  similarPackage: (text) =>
    text.replace(
      "name='com.masarifi.mobile'",
      "name='com.masarifi.mobile.other'",
    ),
  duplicatePackage: (text) => text + "package: name='com.other'\n",
  duplicateLabel: (text) => text + "application-label:'مصاريفي وراتبي'\n",
  missingDefaultLabel: (text) =>
    text.replace("application-label:'مصاريفي وراتبي'\n", ""),
  embeddedExpectedText: (text) =>
    text.replace("application-label:'", "ignored application-label:'"),
  changedLabel: (text) =>
    text.replace(
      "application-label:'مصاريفي وراتبي'",
      "application-label:'مصاريفي وراتبي preview'",
    ),
}))
  test(`rejects ${name} in compiled identity`, () => {
    assert.throws(() => verifyBadging(transform(badging), approved));
  });
