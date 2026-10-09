/** Compare a replay against the ledger effect actually saved, including reviewed edits. */
export function captureEffectsAgree(
  existing: Record<string, unknown>,
  values: Record<string, unknown>,
): boolean {
  const classification = (values.classification ?? {}) as Record<string, unknown>;
  const incoming = classification.direction === 'incoming';
  const expectedKind =
    classification.subtype === 'reversal'
      ? 'reversal'
      : values.kind === 'fee'
        ? 'expense'
        : values.kind;
  return (
    existing.kind === expectedKind &&
    Math.abs(Number(existing.amountMinor)) === Math.abs(Number(values.amountMinor)) &&
    existing.currency === values.currency &&
    (!['refund', 'reversal'].includes(String(expectedKind)) ||
      (typeof values.originalTransactionId === 'string' &&
        existing.originalTransactionId === values.originalTransactionId)) &&
    (existing.kind === 'transfer'
      ? existing.sourceAccountId === (incoming ? values.destinationAccountId : values.accountId) &&
        existing.destinationAccountId ===
          (incoming ? values.accountId : values.destinationAccountId)
      : existing.sourceAccountId === values.accountId)
  );
}
