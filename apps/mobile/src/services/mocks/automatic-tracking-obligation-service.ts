export interface ObligationEffectPreview {
  obligationId: string;
  paidBeforeMinor: number;
  paidAfterMinor: number;
  remainingAfterMinor: number;
}

export function previewMockObligationEffect({
  obligationId,
  amountMinor,
  paidBeforeMinor = 0,
  totalMinor
}: {
  obligationId: string;
  amountMinor: number;
  paidBeforeMinor?: number;
  totalMinor: number;
}): ObligationEffectPreview {
  const paidAfterMinor = Math.min(totalMinor, paidBeforeMinor + amountMinor);
  return {
    obligationId,
    paidBeforeMinor,
    paidAfterMinor,
    remainingAfterMinor: totalMinor - paidAfterMinor
  };
}
