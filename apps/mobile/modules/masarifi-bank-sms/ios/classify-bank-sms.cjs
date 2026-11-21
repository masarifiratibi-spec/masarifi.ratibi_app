const { defaultSnapshot, discoverFinancialMessage, normalizeFinancialText } = require('./parser');

const smsAliases = {
  'lifecycle.failed': ['not completed', 'not processed', 'never processed', 'not successful', 'not approved', 'not been approved', 'not yet approved', 'لم يكتمل', 'لم تكتمل', 'لم يتم تنفيذ', 'لم يتم اتمام', 'لم تتم الموافقة', 'لم يتم قبول'],
  'lifecycle.pending': ['awaiting approval', 'awaiting authorization', 'بانتظار الموافقة', 'في انتظار الموافقة'],
  'action.transfer.sent': ['outgoing external transfer', 'تحويل خارجي صادر', 'حوالة خارجية صادرة', 'حوالة صادرة'],
  'action.transfer.received': ['incoming external transfer', 'تحويل خارجي وارد', 'حوالة خارجية واردة', 'حوالة واردة']
};
const snapshot = {
  ...defaultSnapshot,
  rules: defaultSnapshot.rules.map(rule => smsAliases[rule.ruleKey]
    ? { ...rule, any: [...rule.any, ...smsAliases[rule.ruleKey]] } : rule)
};
const expenses = ['purchase', 'pos_purchase', 'online_purchase', 'card_purchase', 'bill_payment', 'fee'];
const evidenceRequired = {
  card_repayment: 'card_repayment_requires_transfer',
  withdrawal: 'cash_destination_required',
  transfer_sent: 'transfer_counterparty_required',
  transfer_received: 'transfer_counterparty_required',
  refund: 'original_transaction_required',
  reversal: 'original_transaction_required'
};
const words = value => normalizeFinancialText(value).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ') || '';
const issuer = account => words(account.issuer || account.institution || '');
const merchantKey = value => normalizeFinancialText(value).toLowerCase();
// Match a statement about the payment itself. A bank can waive a fee on a completed purchase.
const noDebit = /\b(?:(?:card|account)\s+(?:was\s+not|has\s+not\s+been)\s+charged|no\s+amount\s+was\s+(?:deducted|debited|charged)|(?:payment|purchase|transaction)\s+could\s+not\s+be\s+processed)\s*(?=$|[.!;,،])/iu;

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
  const allowed = id => id && routing.categories.some(category => category.id === id && category.kind === kind);
  if (explicit) return allowed(explicit) ? explicit : undefined;
  const configured = kind === 'income'
    ? [c.subtype === 'salary' && preferences?.salaryId, preferences?.incomeId]
    : [c.subtype === 'fee' && preferences?.feeId, merchantCategory(merchant, preferences?.merchants), preferences?.expenseId];
  return configured.find(allowed);
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
  const message = words(text).slice(bank ? bank.length : 0).trim();
  // A bank may describe the debit simply as a bill payment to the user's
  // enrolled credit card. Treat it as a transfer or leave it unrecorded.
  const creditBill = c.subtype === 'bill_payment' && (
    /\bto (?:your |the )?credit[ -]card\b/u.test(message) ||
    c.instruments.some(hint => hint.side === 'destination' && hint.role === 'card' &&
      routing.accounts.some(target => target.type === 'credit_card' && target.lastFour &&
        hint.suffix.endsWith(target.lastFour)))
  );
  if (c.subtype === 'card_repayment' || creditBill) {
    if (!c.providerReference || c.instruments.some(hint => !hint.side)) return null;
    const from = c.instruments.filter(hint => hint.side === 'source');
    const to = c.instruments.filter(hint => hint.side === 'destination');
    const source = resolveHints(accounts, from, selected);
    const destination = resolveHints(accounts, to);
    if (!source?.automaticRouting || !destination?.automaticRouting || source === destination ||
        !['bank', 'debit_card', 'savings', 'wallet'].includes(source.type) || destination.type !== 'credit_card' ||
        (bank && issuer(source) !== bank && issuer(destination) !== bank)) return null;
    if (routing.accountEnding) {
      const ending = normalizeFinancialText(routing.accountEnding);
      if (!selected || !/^\d{4}$/.test(ending) || source.accountEnding !== ending ||
          !from.some(hint => hint.role === 'account' && hint.suffix.endsWith(ending))) return null;
    }
    return { kind: 'transfer', account: source, destination };
  }
  const bankAccounts = bank ? accounts.filter(account => issuer(account) === bank) : accounts;
  const externalTransfer = /^(?:outgoing external transfer|incoming external transfer|تحويل خارجي صادر|حوالة خارجية صادرة|حواله خارجيه صادره|تحويل خارجي وارد|حوالة خارجية واردة|حواله خارجيه وارده)(?: |$)/u.test(message);
  if (selected && !bankAccounts.includes(selected)) return null;
  const subtype = c.subtype;
  const paired = ['transfer_sent', 'transfer_received'].includes(subtype);
  const affectedSide = c.direction === 'incoming' ? 'destination' : 'source';
  const needsSide = paired || subtype === 'bill_payment';
  const hints = c.instruments.filter(hint => hint.side ? hint.side === affectedSide : !needsSide);
  if (!hints.length && (needsSide || c.instruments.length)) return null;
  if (subtype === 'withdrawal' && c.instruments.some(hint => hint.side === 'destination')) return null;
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
    if (!account && selected && accounts.length === 1 &&
        (!hints.length ? Boolean(routing.categoryId || routing.incomeCategoryId) :
          !routing.preferences && hints.every(hint => !(hint.role === 'card' ? selected.lastFour : selected.accountEnding)))) {
      account = selected;
    }
  }
  if (!account || !eligible.includes(account)) return null;

  if (expenses.includes(subtype) && c.direction === 'outgoing') return { kind: 'expense', account };
  if (subtype === 'salary' && c.direction === 'incoming') return { kind: 'income', account };
  if (subtype === 'withdrawal' || subtype === 'deposit') {
    if (subtype === 'deposit' && /^(?:(?:third party|external) deposit|(?:تم )?ايداع من طرف خارجي)(?: |$)/u.test(message)) {
      if (c.instruments.some(hint => hint.side === 'source' && accounts.some(candidate => {
        const ending = hint.role === 'card' ? candidate.lastFour : candidate.accountEnding;
        return ending && hint.suffix.endsWith(ending);
      }))) return null;
      return { kind: 'income', account };
    }
    const cashDeposit = /^(?:cash deposit|cash deposited|(?:تم )?ايداع نقدي)(?: |$)/u.test(message);
    if (subtype === 'deposit') {
      if (!cashDeposit) return null;
      // Only the cash movement, currency, destination and reference establish the
      // user's linked cash as the source. Unknown narrative may identify a depositor.
      const currency = defaultSnapshot.currencies.find(entry => entry.code === c.currency);
      const allowed = new Set(words([
        c.currency, ...(currency?.aliases ?? []), 'cash deposit deposited atm amount of via to into your bank account number acct acc ending in on at ref reference',
        'تم ايداع نقدي الصراف الالي مبلغ بمبلغ الي في علي حساب الحساب رقم الرقم المرجعي مرجع'
      ].join(' ')).split(' '));
      const reference = c.providerReference && words(c.providerReference);
      const fields = reference && message.endsWith(' ' + reference)
        ? message.slice(0, -reference.length).trim() : message;
      if (fields.split(' ').some(field => !allowed.has(field) && !/^x*\d+$/.test(field))) return null;
    }
    const cash = accounts.find(candidate => candidate.id === account.cashAccountId && candidate.type === 'cash');
    if (!cash || cash.id === account.id) return null;
    return subtype === 'withdrawal'
      ? { kind: 'transfer', account, destination: cash }
      : { kind: 'transfer', account: cash, destination: account };
  }
  if (paired) {
    if (!c.providerReference || c.instruments.some(hint => !hint.side)) return null;
    const otherHints = c.instruments.filter(hint => hint.side !== affectedSide);
    const other = resolveHints(accounts, otherHints);
    if (other && other !== account) {
      if (externalTransfer || !other.automaticRouting) return null;
      return c.direction === 'incoming'
        ? { kind: 'transfer', account: other, destination: account }
        : { kind: 'transfer', account, destination: other };
    }
    if (other || otherHints.some(hint => accounts.some(candidate =>
      [candidate.lastFour, candidate.accountEnding].some(ending => ending && hint.suffix.endsWith(ending))
    )) || !externalTransfer) return null;
    return { kind: c.direction === 'incoming' ? 'income' : 'expense', account };
  }
  if (['refund', 'reversal'].includes(subtype) && c.originalProviderReference && c.providerReference)
    return { kind: subtype, account };
  return null;
}

module.exports = function classifyBankSms(text, receivedAt, timeZone, routing) {
  if (typeof text !== 'string' || text.length > 2000 || !text.trim()) return null;
  if (noDebit.test(text)) return null;
  if (/\b(?:not|never)(?:\s+(?:yet|been|successfully))*\s+(?:approved|authori[sz]ed|processed|completed|executed|debited|credited|successful)\b/i.test(text)) return null;
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
      c.reasonCodes.some(code => code !== evidenceRequired[c.subtype] &&
        !(c.subtype === 'card_repayment' && code === 'action_unknown'))) return null;

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
    stableReferenceIdentity: movement && c.providerReference ? JSON.stringify([
      kind, c.currency, c.providerReference.toLowerCase(),
      movement.account.id, movement.destination?.id ?? null
    ]) : null,
    referenceIdentity: c.providerReference ? JSON.stringify(movement?.destination
      ? [movement.account.id, movement.destination.id, c.providerReference, c.amountMinor, c.currency]
      : [c.providerReference, c.direction, c.amountMinor, c.currency,
        c.instruments.map(({ role, suffix }) => role + ':' + suffix).sort()]) : null,
    bankReference: kind === 'expense' ? c.providerReference : null,
    originalReference: c.originalProviderReference ?? null
  };
};
