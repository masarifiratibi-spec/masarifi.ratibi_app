const { discoverFinancialMessage, normalizeFinancialText } = require('./parser');

module.exports = function classifyBankSms(text, receivedAt, timeZone) {
  if (typeof text !== 'string' || text.length > 2000 || !text.trim()) return null;
  const result = discoverFinancialMessage({
    text, receivedAt, timeZone, channel: 'ios_app_intent'
  });
  const c = result.classification;
  if (!result.strong || c.status !== 'completed' || c.disposition !== 'capture_candidate' ||
      c.reasonCodes.length || !Number.isSafeInteger(c.amountMinor) || c.amountMinor <= 0 ||
      !/^[A-Z]{3}$/.test(c.currency ?? '')) return null;
  const kind = c.direction === 'incoming' && c.subtype === 'salary' ? 'income' :
    c.direction === 'outgoing' && ['purchase', 'pos_purchase', 'online_purchase', 'card_purchase', 'fee'].includes(c.subtype) ? 'expense' : null;
  if (!kind) return null;
  return {
    kind,
    amountMinor: c.amountMinor,
    currency: c.currency,
    occurredAt: c.occurredAt ?? new Date(receivedAt).toISOString(),
    // The transient identity is hashed by the Swift caller before storage.
    textIdentity: normalizeFinancialText(text).toLowerCase(),
    referenceIdentity: c.providerReference ? JSON.stringify([
      c.providerReference, c.direction, c.amountMinor, c.currency,
      c.instruments.map(({ role, suffix }) => `${role}:${suffix}`).sort()
    ]) : null
  };
};
