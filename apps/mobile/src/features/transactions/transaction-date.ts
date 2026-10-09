export function replaceLocalDate(
  timestamp: number,
  selectedTimestamp: number,
  maximumTimestamp?: number
): number {
  const current = new Date(timestamp);
  const selected = new Date(selectedTimestamp);
  current.setFullYear(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate()
  );
  return maximumTimestamp === undefined
    ? current.getTime()
    : Math.min(current.getTime(), maximumTimestamp);
}
