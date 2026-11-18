const { defaultSnapshot, discoverFinancialMessage, normalizeFinancialText } = require('./parser');

const transferAliases = {
  'action.transfer.sent': ['outgoing external transfer', 'تحويل خارجي صادر', 'حوالة خارجية صادرة', 'حوالة صادرة'],
  'action.transfer.received': ['incoming external transfer', 'تحويل خارجي وارد', 'حوالة خارجية واردة', 'حوالة واردة']
};
const snapshot = {
  ...defaultSnapshot,
  rules: defaultSnapshot.rules.map(rule => transferAliases[rule.ruleKey]
    ? { ...rule, any: [...rule.any, ...transferAliases[rule.ruleKey]] } : rule)
};
const expenses = ['purchase', 'pos_purchase', 'online_purchase', 'card_purchase', 'bill_payment', 'fee'];
const evidenceRequired = {
  withdrawal: 'cash_destination_required',
  transfer_sent: 'transfer_counterparty_required',
  transfer_received: 'transfer_counterparty_required',
  refund: 'original_transaction_required',
  reversal: 'original_transaction_required'
};
const words = value => normalizeFinancialText(value).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ') || '';
const issuer = account => words(account.issuer || account.institution || '');
const merchantKey = value => normalizeFinancialText(value).toLowerCase();

function merchantCategory(merchant, categories) {
  if (!merchant || !categories) return undefined;
  const key = merchantKey(merchant);
  const matches = new Set(Object.entries(categories)
    .filter(([label]) => merchantKey(label) === key)
    .map(([, id]) => id));
  return matches.size === 1 ? matches.values().next().value : undefined;
}

function resolveHints(accounts, hints, selected) {
  if (!hints.length) return null;
  let account;
  for (const hint of hints) {
    const matches = accounts.filter(candidate => {
      const ending = hint.role === 'card' ? candidate.lastFour : candidate.accountEnding;
      return /^\d{4}$/.test(ending || '') && hint.suffix.endsWith(ending);
    });
    if (matches.length > 1 || (account && matches.length && account !== matches[0])) return null;
    if (matches.length) account = matches[0];
    else if (accounts.some(candidate => hint.role === 'card' ? candidate.lastFour : candidate.accountEnding)) return null;
    // Some bank messages name the linked account as well as the card. A hint
    // without any configured ending of its role cannot establish a match itself.
  }
  if (selected && account && selected !== account) return null;
  return account || null;
}

function categoryFor(c, kind, merchant, routing) {
  const preferences = routing.preferences;
  const explicit = kind === 'income' ? routing.incomeCategoryId || routing.categoryId : routing.categoryId;
  const configured = kind === 'income'
    ? [explicit, c.subtype === 'salary' && preferences?.salaryId, preferences?.incomeId]
    : [explicit, c.subtype === 'fee' && preferences?.feeId, merchantCategory(merchant, preferences?.merchants), preferences?.expenseId];
  return configured.find(id => id && routing.categories.some(category => category.id === id && category.kind === kind));
}

function matchedIssuers(text, accounts) {
  const body = words(text) + ' ';
  return new Set(accounts.map(issuer).filter(name => name && body.startsWith(name + ' ')));
}

function route(text, c, routing) {
  const accounts = routing.accounts.filter(account => account.currency === c.currency);
  const eligible = accounts.filter(account => account.automaticRouting || account.id === routing.accountId);
  const selected = eligible.find(account => account.id === routing.accountId);
  if (routing.accountId && !selected) return null;
  const banks = matchedIssuers(text, routing.accounts);
  if (banks.size > 1) return null;
  const bank = banks.values().next().value;
  const bankAccounts = bank ? accounts.filter(account => issuer(account) === bank) : accounts;
  if (selected && !bankAccounts.includes(selected)) return null;
  const subtype = c.subtype;
  const paired = ['transfer_sent', 'transfer_received'].includes(subtype);
  const affectedSide = c.direction === 'incoming' ? 'destination' : 'source';
  const hints = paired ? c.instruments.filter(hint => hint.side === affectedSide) : c.instruments;
  if (subtype === 'withdrawal' && hints.some(hint => hint.side === 'destination')) return null;
  const legacyEnding = routing.accountEnding && normalizeFinancialText(routing.accountEnding);
  let account;
  if (legacyEnding) {
    if (!selected || !/^\d{4}$/.test(legacyEnding) || !hints.length ||
        !hints.every(hint => hint.role === 'account' && hint.suffix.endsWith(legacyEnding))) return null;
    if (selected.accountEnding && selected.accountEnding !== legacyEnding ||
        bankAccounts.some(candidate => candidate !== selected && candidate.accountEnding === legacyEnding)) return null;
    account = selected;
  } else {
    account = resolveHints(bankAccounts, hints, selected);
    // An explicitly scoped v1 shortcut may lack instrument metadata. Restrict
    // that fallback to the only eligible account in the relevant currency.
    if (!account && selected && !routing.preferences && accounts.length === 1 &&
        hints.every(hint => !(hint.role === 'card' ? selected.lastFour : selected.accountEnding))) account = selected;
  }
  if (!account || !eligible.includes(account)) return null;

  if (expenses.includes(subtype) && c.direction === 'outgoing') return { kind: 'expense', account };
  if (subtype === 'salary' && c.direction === 'incoming') return { kind: 'income', account };
  if (subtype === 'withdrawal' || subtype === 'deposit') {
    const cash = accounts.find(candidate => candidate.id === account.cashAccountId && candidate.type === 'cash');
    if (subtype === 'withdrawal' || /\b(?:cash deposit|cash deposited)\b|ايداع نقدي/iu.test(text)) {
      if (!cash || cash.id === account.id) return null;
      return subtype === 'withdrawal'
        ? { kind: 'transfer', account, destination: cash }
        : { kind: 'transfer', account: cash, destination: account };
    }
    // A generic credit or bare deposit can be one side of an owned transfer.
    return /\b(?:third.party deposit|external deposit)\b|ايداع من طرف خارجي/iu.test(text)
      ? { kind: 'income', account } : null;
  }
  if (paired) {
    if (!c.providerReference || c.instruments.some(hint => !hint.side)) return null;
    const otherHints = c.instruments.filter(hint => hint.side !== affectedSide);
    const other = resolveHints(accounts, otherHints);
    if (other && other !== account) {
      if (!other.automaticRouting) return null;
      return c.direction === 'incoming'
        ? { kind: 'transfer', account: other, destination: account }
        : { kind: 'transfer', account, destination: other };
    }
    if (other || otherHints.some(hint => accounts.some(candidate =>
      [candidate.lastFour, candidate.accountEnding].some(ending => ending && hint.suffix.endsWith(ending))
    )) || !/\bexternal transfer\b|حوالة خارجية|تحويل خارجي/iu.test(text)) return null;
    return { kind: c.direction === 'incoming' ? 'income' : 'expense', account };
  }
  if (['refund', 'reversal'].includes(subtype) && c.originalProviderReference && c.providerReference)
    return { kind: subtype, account };
  return null;
}

module.exports = function classifyBankSms(text, receivedAt, timeZone, routing) {
  if (typeof text !== 'string' || text.length > 2000 || !text.trim()) return null;
  const parserText = routing
    ? text.replace(/(?<![\p{L}\p{N}])مرجع(?=\s*[:#])/gu, 'الرقم المرجعي')
    : text;
  const input = { text: parserText, receivedAt, timeZone, channel: 'ios_app_intent' };
  let result = discoverFinancialMessage(input, snapshot);
  if (routing && result.strong && result.classification.reasonCodes.includes('currency_ambiguous')) {
    const banks = matchedIssuers(text, routing.accounts);
    if (banks.size === 1) {
      const account = resolveHints(routing.accounts.filter(target => banks.has(issuer(target))), result.classification.instruments);
      if (account?.currency && account.automaticRouting) {
        result = discoverFinancialMessage({ ...input, verifiedAccountCurrency: account.currency }, snapshot);
      }
    }
  }
  const c = result.classification;
  if (!result.strong || c.status !== 'completed' || !Number.isSafeInteger(c.amountMinor) ||
      c.amountMinor <= 0 || !/^[A-Z]{3}$/.test(c.currency ?? '') ||
      c.reasonCodes.some(code => code !== evidenceRequired[c.subtype])) return null;

  const movement = routing && route(normalizeFinancialText(text), c, routing);
  // Keep parser-only qualification independent of any enrolled user's data.
  const kind = routing ? movement?.kind :
    c.subtype === 'salary' ? 'income' : expenses.filter(subtype => subtype !== 'bill_payment').includes(c.subtype) ? 'expense' : null;
  if (!kind) return null;
  const merchant = expenses.includes(c.subtype) && c.subtype !== 'fee'
    ? c.merchant?.split(/\s+(?:ref\.?|reference|الرقم المرجعي)(?=\s|[:#]|$)|\s+(?:ب?بطاقة|حساب)\s*[:#-]?\s*[x*•]*\d{4,12}/iu)[0].trim() || null : null;
  const categoryId = routing?.categories && ['expense', 'income'].includes(kind)
    ? categoryFor(c, kind, merchant, routing) : null;
  if (routing?.categories && ['expense', 'income'].includes(kind) && !categoryId) return null;

  return {
    ...(movement ? { accountId: movement.account.id, destinationAccountId: movement.destination?.id ?? null, categoryId } : {}),
    kind,
    amountMinor: c.amountMinor,
    currency: c.currency,
    occurredAt: c.occurredAt ?? new Date(receivedAt).toISOString(),
    // Swift hashes all identities before persisting them.
    textIdentity: normalizeFinancialText(text).toLowerCase(),
    referenceIdentity: c.providerReference ? JSON.stringify(movement?.destination
      ? [movement.account.id, movement.destination.id, c.providerReference, c.amountMinor, c.currency]
      : [c.providerReference, c.direction, c.amountMinor, c.currency,
        c.instruments.map(({ role, suffix }) => role + ':' + suffix).sort()]) : null,
    bankReference: kind === 'expense' ? c.providerReference : null,
    originalReference: c.originalProviderReference ?? null
  };
};
