export interface DonutSegment {
  id?: string;
  label: string;
  value: number;
  memberIds?: string[];
}

export function limitDonutSegments(data: DonutSegment[], otherLabel = 'Other'): DonutSegment[] {
  const sorted = [...data].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (sorted.length <= 5) return sorted;
  const visible = sorted.slice(0, 4);
  const hidden = sorted.slice(4);
  const other = hidden.reduce((sum, item) => sum + item.value, 0);
  const hasSemanticMembership = hidden.some(
    (item) => item.id || item.memberIds?.length
  );
  const otherSegment: DonutSegment = {
    label: otherLabel,
    value: other
  };
  if (hasSemanticMembership) {
    otherSegment.id = 'other';
    otherSegment.memberIds = hidden.flatMap((item) =>
      item.memberIds ?? (item.id ? [item.id] : [])
    );
  }
  return [
    ...visible,
    otherSegment
  ];
}

export function limitLineSeries<T>(series: T[]): T[] {
  return series.slice(0, 4);
}

export function normalizeLinePoints(values: readonly number[], width = 160, height = 80): string {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((value, index) => `${Math.round(index * step)},${Math.round(height - ((value - min) / span) * (height - 12) - 6)}`)
    .join(' ');
}
