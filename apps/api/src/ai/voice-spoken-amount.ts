/** Interpret only complete number phrases. Unrecognized words and ambiguous separators veto posting. */
const words = new Map<string, number>();
function add(value: number, variants: string) {
  for (const word of variants.split('|')) words.set(word, value);
}
[
  'zero|صفر',
  'one|واحد|واحدة|واحدا|احد|احدى',
  'two|اثنان|اثنين|اثنتان|اثنتين|اتنين',
  'three|ثلاث|ثلاثة|تلات|تلاتة',
  'four|اربع|اربعة',
  'five|خمس|خمسة',
  'six|ست|ستة',
  'seven|سبع|سبعة',
  'eight|ثمان|ثماني|ثمانية|ثمانيه',
  'nine|تسع|تسعة',
  'ten|عشر|عشرة',
  'eleven|احد عشر|احدى عشرة|حدعش|حداشر',
  'twelve|اثنا عشر|اثني عشر|اثنتا عشرة|اثنتي عشرة|اثنعش|اتناشر',
  'thirteen|ثلاثتعش|تلاتاشر',
  'fourteen|اربعتعش|اربعتاشر',
  'fifteen|خمستعش|خمستاشر',
  'sixteen|ستعش|ستاشر',
  'seventeen|سبعتعش|سبعطعش|سبعتاشر|سبعطاشر|سبعتاعش|سبعطاش|سبعتاش|سبعطشر|سبعتشر|سبعتعشر',
  'eighteen|ثمنتعش|تمنتاشر',
  'nineteen|تسعتعش|تسعتاشر',
].forEach((variants, n) => {
  add(n, variants);
});
[
  'twenty|عشرون|عشرين',
  'thirty|ثلاثون|ثلاثين|تلاتين',
  'forty|اربعون|اربعين',
  'fifty|خمسون|خمسين',
  'sixty|ستون|ستين',
  'seventy|سبعون|سبعين',
  'eighty|ثمانون|ثمانين',
  'ninety|تسعون|تسعين',
].forEach((variants, i) => {
  add((i + 2) * 10, variants);
});
add(100, 'مية|مئة|مائة|ميه');
add(200, 'مئتان|مئتين|مائتان|مائتين|ميتين');
add(1000, 'الف');
add(2000, 'الفان|الفين');

for (const [units, stems] of [
  [3, 'ثلاث|تلات'],
  [4, 'اربع'],
  [5, 'خمس'],
  [6, 'ست'],
  [7, 'سبع'],
  [8, 'ثمان|ثمانى|تمن'],
  [9, 'تسع'],
] as const) {
  for (const stem of stems.split('|'))
    for (const hundred of ['مئة', 'مائة', 'مية', 'ميه']) add(units * 100, stem + hundred);
}

function underHundred(phrase: string): number | undefined {
  const exact = words.get(phrase);
  if (exact !== undefined && exact < 100) return exact;
  const teen = /^([^ ]+) عشر[ةه]?$/.exec(phrase);
  if (teen) {
    const unit = words.get(teen[1] ?? '');
    if (unit !== undefined && unit >= 3 && unit <= 9) return 10 + unit;
  }
  const arabic = /^([^ ]+) و ?([^ ]+)$/.exec(phrase);
  const english = /^([a-z]+)[ -]([a-z]+)$/.exec(phrase);
  const unit = words.get(arabic?.[1] ?? english?.[2] ?? '');
  const tens = words.get(arabic?.[2] ?? english?.[1] ?? '');
  if (unit && unit < 10 && tens && tens >= 20 && tens < 100 && tens % 10 === 0) return tens + unit;
  return undefined;
}

function underThousand(phrase: string): number | undefined {
  const arabic = /^([^ ]+)(?: و ?(.+))?$/.exec(phrase);
  const hundreds = words.get(arabic?.[1] ?? '');
  if (hundreds && hundreds >= 100 && hundreds < 1000) {
    const tail = arabic?.[2] ? underHundred(arabic[2]) : 0;
    return tail === undefined ? undefined : hundreds + tail;
  }
  const english = /^([a-z]+) hundred(?: (?:and )?(.+))?$/.exec(phrase);
  if (!english) return underHundred(phrase);
  const count = words.get(english[1] ?? '');
  const tail = english[2] ? underHundred(english[2]) : 0;
  return count && count < 10 && tail !== undefined ? count * 100 + tail : undefined;
}

function underMillion(phrase: string): number | undefined {
  const match =
    /^(?:(.+?) (?:thousand|الاف|الف)|(الف|الفين|الفان))(?:(?: (?:and )?| و ?)(.+))?$/.exec(phrase);
  if (!match) return underThousand(phrase);
  const scale = match[1] ? underThousand(match[1]) : (words.get(match[2] ?? '') ?? 0) / 1000;
  const rest = match[3] ? underThousand(match[3].replace(/^و ?/, '')) : 0;
  return scale && rest !== undefined ? scale * 1000 + rest : undefined;
}

function integerWords(phrase: string): number | undefined {
  const match =
    /^(?:(.+?) (?:million|ملايين|مليون)|(مليون|مليونين|مليونان))(?:(?: (?:and )?| و ?)(.+))?$/.exec(
      phrase,
    );
  if (!match) return underMillion(phrase);
  const count = match[1] ? underThousand(match[1]) : match[2] === 'مليون' ? 1 : 2;
  const rest = match[3] ? underMillion(match[3].replace(/^و ?/, '')) : 0;
  return count && rest !== undefined ? count * 1_000_000 + rest : undefined;
}

// Denominations are matched against the already resolved account currency.
// Each listed minor denomination means exactly one minor unit for that currency.
const denominations: Record<string, [string, string]> = {
  SAR: [
    '(?:saudi )?riyals?|(?:ريال|ريالا|ريالات)(?: سعودي(?:ا|ة)?)?',
    'halala|halalas|halalah|halalahs|هللة|هلله|هللات',
  ],
  USD: ['dollar|dollars|دولار|دولارات', 'cent|cents|سنت|سنتات'],
  EUR: ['euro|euros|يورو', 'cent|cents|سنت|سنتات'],
  GBP: ['pound|pounds|جنيه|جنيهات', 'penny|pennies|pence|بنس|بنسات'],
  EGP: ['pound|pounds|جنيه|جنيهات', 'piastre|piastres|قرش|قروش|قرشا'],
  AED: ['dirham|dirhams|درهم|دراهم', 'fils|فلس|فلوس|فلسا'],
  QAR: ['riyal|riyals|ريال|ريالات', 'dirham|dirhams|درهم|دراهم'],
  KWD: ['dinar|dinars|دينار|دنانير', 'fils|فلس|فلوس|فلسا'],
  BHD: ['dinar|dinars|دينار|دنانير', 'fils|فلس|فلوس|فلسا'],
  JOD: ['dinar|dinars|دينار|دنانير', 'fils|فلس|فلوس|فلسا'],
  OMR: ['rial|rials|ريال|ريالات', 'baisa|baisas|بيسة|بيسات'],
  JPY: ['yen|ين', ''],
};

function inDenominations(phrase: string, exponent: number, currency: string): string | null {
  const units = denominations[currency];
  if (!Object.hasOwn(denominations, currency) || !units) return null;
  const minor = units[1] && new RegExp('^(.+) (' + units[1] + ')$').exec(phrase);
  const major = new RegExp('^(.+?) (' + units[0] + ')(?: (?:and |و ?)(.+))?$').exec(phrase);
  if (major) {
    const amount = unsignedMajor(major[1] ?? '', exponent);
    if (amount === null || !major[3]) return amount;
    const fraction = /^(?:a )?(half|quarter|نصف|نص|ربع)$/.exec(major[3]);
    if (fraction) {
      const part = unsignedMajor(
        ['half', 'نصف', 'نص'].includes(fraction[1] ?? '') ? '0.5' : '0.25',
        exponent,
      );
      return part === null ? null : String(BigInt(amount) + BigInt(part));
    }
    if (!units[1]) return null;
    const remainder = new RegExp('^(.+) (' + units[1] + ')$').exec(major[3]);
    const part = remainder && unsignedMajor(remainder[1] ?? '', 0);
    if (part === null || BigInt(part) >= 10n ** BigInt(exponent)) return null;
    return String(BigInt(amount) + BigInt(part));
  }
  if (minor) return unsignedMajor(minor[1] ?? '', 0);
  const leading = new RegExp('^(?:' + units[0] + ') (.+)$').exec(phrase);
  return leading ? unsignedMajor(leading[1] ?? '', exponent) : null;
}

export function spokenAmountMinor(
  evidence: unknown,
  exponent: unknown,
  currency: unknown,
): string | null {
  if (
    typeof evidence !== 'string' ||
    evidence.length > 96 ||
    typeof exponent !== 'number' ||
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > 4
  )
    return null;
  const phrase = evidence
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\u064b-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, '.')
    .trim()
    .replace(/ +/g, ' ');
  return (
    unsignedMajor(phrase, exponent) ??
    (typeof currency === 'string' ? inDenominations(phrase, exponent, currency) : null)
  );
}

function unsignedMajor(phrase: string, exponent: number): string | null {
  // A named fractional part must be exact at the selected currency precision as well.
  const mixedFraction = /^(.*?) (?:and a (half|quarter)|و ?(نصف|نص|ربع))$/.exec(phrase);
  if (mixedFraction) {
    const major = integerWords(mixedFraction[1] ?? '');
    if (major === undefined) return null;
    const hundredths = ['half', 'نصف', 'نص'].includes(mixedFraction[2] ?? mixedFraction[3] ?? '')
      ? 50
      : 25;
    return unsignedMajor(String(major) + '.' + String(hundredths), exponent);
  }
  const decimal = /^(\d{1,16})(?:\.(\d+))?$/.exec(phrase);
  let whole: string;
  let fraction: string;
  if (decimal) {
    whole = decimal[1] ?? '';
    fraction = decimal[2] ?? '';
  } else {
    const parts = phrase.split(/ (?:point|فاصلة|فاصله) /);
    if (parts.length > 2) return null;
    const integer = integerWords(parts[0] ?? '');
    if (integer === undefined) return null;
    whole = String(integer);
    fraction = '';
    if (parts.length === 2) {
      for (const token of (parts[1] ?? '').split(' ')) {
        const digit = words.get(token);
        if (digit === undefined || digit > 9) return null;
        fraction += String(digit);
      }
    }
  }
  if (fraction.replace(/0+$/, '').length > exponent) return null;
  return BigInt(whole + fraction.slice(0, exponent).padEnd(exponent, '0')).toString();
}
