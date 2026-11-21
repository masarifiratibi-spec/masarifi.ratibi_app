export function laterSmsId(left: string, right: string): string {
  const a = /^\d{1,19}$/.test(left) ? left.replace(/^0+(?=\d)/, '') : '0';
  const b = /^\d{1,19}$/.test(right) ? right.replace(/^0+(?=\d)/, '') : '0';
  return a.length > b.length || (a.length === b.length && a > b) ? a : b;
}
