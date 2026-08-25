export function replaceLocalDate(
  timestamp: number,
  selectedTimestamp: number
): number {
  const current = new Date(timestamp);
  const selected = new Date(selectedTimestamp);
  current.setFullYear(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate()
  );
  return current.getTime();
}
