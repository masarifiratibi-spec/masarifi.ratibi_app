// Retain formatter configuration only, never formatted financial values.
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const capacity = 32;

function reuseFormatter<T>(
  cache: Map<string, T>,
  key: string,
  create: () => T
): T {
  const existing = cache.get(key);
  if (existing) return existing;
  const formatter = create();
  if (cache.size >= capacity) cache.delete(cache.keys().next().value!);
  cache.set(key, formatter);
  return formatter;
}

function configurationKey(locale: string, options: object): string {
  return JSON.stringify([
    locale,
    Object.entries(options)
      .filter(([, value]) => value !== undefined)
      .sort()
  ]);
}

export function getNumberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  return reuseFormatter(
    numberFormatters,
    configurationKey(locale, options),
    () => new Intl.NumberFormat(locale, options)
  );
}

export function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  // An implicit device timezone can change while the app remains mounted.
  if (!options.timeZone) return new Intl.DateTimeFormat(locale, options);
  return reuseFormatter(
    dateFormatters,
    configurationKey(locale, options),
    () => new Intl.DateTimeFormat(locale, options)
  );
}

// Machine-readable calendar fields only, for our en-US zoned calculations.
// iOS Hermes has format() but does not implement DateTimeFormat.formatToParts().
export function calendarDateTimeParts(
  formatter: Intl.DateTimeFormat,
  value: number | Date
): Intl.DateTimeFormatPart[] {
  if (typeof formatter.formatToParts === 'function')
    return formatter.formatToParts(value);
  const options = formatter.resolvedOptions();
  const fields = [
    'year',
    'month',
    'day',
    'hour',
    'minute',
    'second',
    'weekday'
  ] as const;
  return fields.flatMap((field): Intl.DateTimeFormatPart[] => {
    const style = options[field];
    if (!style) return [];
    const fieldOptions: Intl.DateTimeFormatOptions = {
      timeZone: options.timeZone,
      [field]: style
    };
    if (field === 'hour') {
      if (options.hourCycle) fieldOptions.hourCycle = options.hourCycle;
      else if (options.hour12 !== undefined)
        fieldOptions.hour12 = options.hour12;
    }
    return [
      {
        type: field,
        value: getDateFormatter('en-US', fieldOptions).format(value)
      }
    ];
  });
}
