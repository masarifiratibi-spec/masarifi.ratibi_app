"use strict";

// Literal source exclusions precede even explicitly trusted source overrides.
const excludedPackages = [
  "com.whatsapp",
  "com.whatsapp.w4b",
  "org.telegram.messenger",
  "org.telegram.messenger.web",
  "com.facebook.orca",
  "com.facebook.mlite",
  "com.discord",
  "com.snapchat.android",
  "com.instagram.android",
  "com.google.android.apps.messaging",
  "com.samsung.android.messaging",
  "org.thoughtcrime.securesms",
  "com.viber.voip",
  "com.slack",
  "com.microsoft.teams",
  "com.skype.raider",
  "jp.naver.line.android",
  "com.tencent.mm",
  "com.kakao.talk",
  "im.vector.app",
  "io.element.android.x",
  "com.google.android.apps.dynamite",
];
const numberWords = {
  صفر: 0,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  اثنتان: 2,
  اثنتين: 2,
  اثني: 2,
  اثنا: 2,
  اثنتا: 2,
  ثلاثة: 3,
  ثلاث: 3,
  أربعة: 4,
  اربعة: 4,
  أربع: 4,
  اربع: 4,
  خمسة: 5,
  خمس: 5,
  ستة: 6,
  ست: 6,
  سبعة: 7,
  سبع: 7,
  ثمانية: 8,
  ثماني: 8,
  ثمان: 8,
  تسعة: 9,
  تسع: 9,
  عشرة: 10,
  عشر: 10,
  أحد: 1,
  احد: 1,
  إحدى: 1,
  احدى: 1,
  عشرون: 20,
  عشرين: 20,
  ثلاثون: 30,
  ثلاثين: 30,
  أربعون: 40,
  اربعون: 40,
  أربعين: 40,
  اربعين: 40,
  خمسون: 50,
  خمسين: 50,
  ستون: 60,
  ستين: 60,
  سبعون: 70,
  سبعين: 70,
  ثمانون: 80,
  ثمانين: 80,
  تسعون: 90,
  تسعين: 90,
  مئة: 100,
  مائة: 100,
  مئتان: 200,
  مئتين: 200,
  مائتان: 200,
  مائتين: 200,
  ثلاثمائة: 300,
  أربعمائة: 400,
  اربعمائة: 400,
  خمسمائة: 500,
  ستمائة: 600,
  سبعمائة: 700,
  ثمانمائة: 800,
  تسعمائة: 900,
  ألف: 1000,
  الف: 1000,
  ألفين: 2000,
  الفين: 2000,
};
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordToken = Object.keys(numberWords)
  .sort((a, b) => b.length - a.length)
  .map(escape)
  .join("|");
const wordPattern = new RegExp(
  `(?<![\\p{L}])(?:${wordToken})(?:\\s+(?:و\\s*)?(?:${wordToken})|و(?:${wordToken}))*(?![\\p{L}])`,
  "gu",
);
const unsupportedNumberWords =
  /(?<![\p{L}])و?(?:نصف|ربع|ثلث|مليار|مليون)(?![\p{L}])/u;
function integerWords(values) {
  const small = (parts) => {
    if (!parts.length) return 0;
    if (parts.length === 1 && parts[0] < 100) return parts[0];
    if (
      parts.length === 2 &&
      parts[0] >= 1 &&
      parts[0] <= 9 &&
      (parts[1] === 10 ||
        (parts[1] >= 20 && parts[1] <= 90 && parts[1] % 10 === 0))
    )
      return parts[0] + parts[1];
    return null;
  };
  const hundreds = (parts) => {
    let base = 0,
      rest = parts;
    if (parts[0] >= 100 && parts[0] < 1000) {
      base = parts[0];
      rest = parts.slice(1);
    } else if (parts[0] >= 1 && parts[0] <= 9 && parts[1] === 100) {
      base = parts[0] * 100;
      rest = parts.slice(2);
    }
    const tail = small(rest);
    return tail === null ? null : base + tail;
  };
  const scales = values
    .map((v, i) => (v >= 1000 ? i : -1))
    .filter((i) => i >= 0);
  if (!scales.length) return hundreds(values);
  if (scales.length !== 1) return null;
  const index = scales[0],
    factor = values.slice(0, index);
  if (
    factor.length > 1 ||
    (factor.length === 1 &&
      (factor[0] < 1 || factor[0] > 9 || values[index] !== 1000))
  )
    return null;
  const remainder = hundreds(values.slice(index + 1));
  return remainder === null
    ? null
    : (factor[0] ?? 1) * values[index] + remainder;
}
function normalizeNumberWords(text) {
  // Unsupported fractions/scales must never be partially read as a smaller amount.
  if (unsupportedNumberWords.test(text)) return text;
  return text.replace(wordPattern, (phrase, offset) => {
    const following = text.slice(offset + phrase.length).trimStart();
    if (
      /^[\p{L}]/u.test(following) &&
      !/^(?:ريال|ريالا|جنيه|دينار|درهم|دولار|SAR|EGP|USD|AED|KWD|BHD|OMR|QAR)(?![\p{L}])/iu.test(
        following,
      )
    )
      return phrase;
    const value = integerWords(
      (phrase.match(new RegExp(wordToken, "gu")) || []).map(
        (token) => numberWords[token],
      ),
    );
    return value === null ? phrase : String(value);
  });
}
const decimal = (raw) => {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.replace(/,/g, "").split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}${fraction.replace(/0+$/, "") ? "." + fraction.replace(/0+$/, "") : ""}`;
};
function decimalToMinor(value, scale) {
  if (
    typeof value !== "string" ||
    !Number.isInteger(scale) ||
    scale < 0 ||
    scale > 3
  )
    return null;
  const normalized = decimal(value);
  if (normalized === null) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > scale) return null;
  const amount = Number(whole + fraction.padEnd(scale, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

module.exports = (parser) => {
  function discoverNominalTrackingMessage(
    input,
    snapshot = parser.defaultSnapshot,
    overrides = [],
    sourceRules = [],
    policy = {},
  ) {
    const sender = (input.sender || "").replace(/\s+/g, "").toLowerCase();
    const notification = input.channel === "android_notification";
    const rows = sourceRules.filter(
      (r) =>
        (r.normalizedSender || "").replace(/\s+/g, "").toLowerCase() === sender,
    );
    const known = snapshot.providers?.some((p) =>
      (notification ? p.packages : p.senders).some(
        (s) => s.toLowerCase() === sender,
      ),
    );
    const eligibleSource =
      !excludedPackages.includes(sender) &&
      !rows.some((r) => !r.enabled) &&
      Boolean(
        known ||
        rows.some((r) => r.enabled && r.trusted) ||
        (policy.sourceAdmissionPolicy === "financial_content_v1" &&
          ["android_sms", "android_notification"].includes(input.channel)),
      );
    const text = normalizeNumberWords(
      parser.normalizeFinancialText(input.text),
    );
    const found = parser.discoverFinancialMessage(
      { ...input, text },
      snapshot,
      overrides,
    );
    const c = found.classification;
    const effective = parser.effectiveFinancialSnapshot(snapshot, overrides);
    const action = c.appliedRuleKeys.some((k) =>
      effective.rules.some((r) => r.ruleKey === k && r.family === "action"),
    );
    const amounts = [];
    // Clause boundaries stop balances, references and account IDs from consuming
    // a later movement. Bare numbers require an explicit movement/amount label.
    const aliases = effective.currencies.flatMap((currency) =>
      currency.aliases.map((a) => ({
        alias: parser.normalizeFinancialText(a).toLowerCase(),
        currency,
      })),
    );
    const currencyToken = aliases
      .sort((a, b) => b.alias.length - a.alias.length)
      .map((a) => escape(a.alias))
      .join("|");
    const pattern = new RegExp(
      `(?<![\\p{L}\\d.])(?:(${currencyToken})\\s*)?([+-]?\\d[\\d,]*(?:\\.\\d+)?)(?:\\s*(${currencyToken}))?(?![\\p{L}\\d.])`,
      "giu",
    );
    for (const clause of text.split(/[،;\n]|\.(?!\d)|,(?!\d{3}(?:\D|$))/u)) {
      for (const m of clause.matchAll(pattern)) {
        const before = clause.slice(0, m.index).toLowerCase();
        if (
          /(?:balance|avl\.?\s*bal|الرصيد|رصيد|reference|ref\.?|مرجع|الرقم المرجعي|card|account|بطاقة|حساب)\s*(?:is|number|رقم)?\s*[:#*x -]*$/iu.test(
            before,
          )
        )
          continue;
        if (
          /(?:fee|fees|commission|رسوم|عمولة)\s*[: ]*$/iu.test(before) &&
          c.subtype !== "fee"
        )
          continue;
        if (
          /(?:equivalent|exchange rate|converted|ما يعادل)\s*[: ]*$/iu.test(
            before,
          )
        )
          continue;
        if (
          !m[1] &&
          !m[3] &&
          !/(?:amount|مبلغ|بقيمة|بمبلغ|خصم|دفع|شراء|سحب|إيداع|ايداع|إضافة|اضافة|paid|payment|purchase|debit|credit|deposit|withdrawal)\s*[: ]*$/iu.test(
            before,
          )
        )
          continue;
        const value = decimal(m[2].replace(/^[+-]/, ""));
        if (value !== null && Number(value) > 0)
          amounts.push({
            value,
            currency:
              aliases.find(
                (a) => a.alias === (m[1] || m[3] || "").toLowerCase(),
              )?.currency.code || null,
            sign:
              m[2][0] === "-"
                ? "outgoing"
                : m[2][0] === "+"
                  ? "incoming"
                  : null,
          });
      }
    }
    const sourceAmountDecimal =
      amounts.length === 1 &&
      input.text.length <= 8000 &&
      !text.includes("[tracking_input_too_large]") &&
      !unsupportedNumberWords.test(text)
        ? amounts[0].value
        : null;
    if (input.text.length > 8000 || text.includes("[tracking_input_too_large]"))
      c.reasonCodes.push("input_too_large");
    if (amounts.length > 1) {
      c.amountMinor = null;
      c.reasonCodes.push("amount_conflict");
    }
    if (sourceAmountDecimal !== null) {
      c.reasonCodes = c.reasonCodes.filter(
        (r) => !["amount_missing", "amount_invalid"].includes(r),
      );
      if (
        amounts[0].sign &&
        c.direction !== "unknown" &&
        amounts[0].sign !== c.direction
      )
        c.reasonCodes.push("conflicting_direction");
      if (c.currency === null && amounts[0].currency)
        c.currency = amounts[0].currency;
      if (c.currency)
        c.amountMinor = decimalToMinor(
          sourceAmountDecimal,
          effective.currencies.find((x) => x.code === c.currency)?.scale ?? 2,
        );
    }
    const ignoredPolicyReasons = new Set([
      "credit_origin_required",
      "cash_destination_required",
      "transfer_counterparty_required",
      "original_transaction_required",
      "unsupported_currency",
    ]);
    const blocking = c.reasonCodes.filter((r) => !ignoredPolicyReasons.has(r));
    c.disposition =
      c.disposition === "ignore"
        ? "ignore"
        : action &&
            c.status === "completed" &&
            ["incoming", "outgoing"].includes(c.direction) &&
            sourceAmountDecimal !== null &&
            !blocking.length &&
            !c.reasonCodes.length &&
            c.currency &&
            c.amountMinor !== null
          ? "capture_candidate"
          : "review";
    const result = {
      ...found,
      classification: c,
      sourceAmountDecimal,
      eligibleSource,
      strong:
        eligibleSource &&
        c.disposition !== "ignore" &&
        (action || found.customRuleKeys.length > 0),
    };
    // Only an explicitly additional, separately labelled fee establishes two
    // movements. A total/included fee or ambiguous second amount stays unresolved.
    const clauses = text
      .split(/[،;\n]/u)
      .map((x) => x.trim())
      .filter(Boolean);
    if (
      eligibleSource &&
      c.status === "completed" &&
      c.disposition !== "ignore" &&
      clauses.length === 2 &&
      !/(?:including|included|total|شامل|إجمالي|اجمالي|يتضمن)/iu.test(text) &&
      /^(?:(?:additional|separate)\s+(?:fee|fees)|(?:رسوم|عمولة)\s+(?:إضافية|اضافية|منفصلة))/iu.test(
        clauses[1],
      )
    ) {
      const principal = discoverNominalTrackingMessage(
        { ...input, text: clauses[0] },
        snapshot,
        overrides,
        sourceRules,
        policy,
      );
      const fee = discoverNominalTrackingMessage(
        { ...input, text: clauses[1] },
        snapshot,
        overrides,
        sourceRules,
        policy,
      );
      if (
        principal.classification.direction === "outgoing" &&
        principal.classification.subtype !== "fee" &&
        principal.sourceAmountDecimal &&
        fee.sourceAmountDecimal &&
        fee.classification.subtype === "fee" &&
        principal.classification.status === "completed" &&
        fee.classification.status === "completed" &&
        !principal.classification.reasonCodes.length &&
        !fee.classification.reasonCodes.length
      ) {
        result.movements = [
          {
            component: "principal",
            sourceAmountDecimal: principal.sourceAmountDecimal,
            classification: principal.classification,
          },
          {
            component: "fee",
            sourceAmountDecimal: fee.sourceAmountDecimal,
            classification: fee.classification,
          },
        ];
      }
    }
    return result;
  }
  return {
    discoverNominalTrackingMessage,
    decimalToMinor,
    normalizeNumberWords,
    excludedFinancialPackages: excludedPackages,
    financialNumberWords: numberWords,
  };
};
