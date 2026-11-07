// Offline mock request factory. No global installation, persistence, provider or network forwarding.
'use strict';
const SESSION='55555555-5555-4555-8555-555555555555';
const TRANSACTION='66666666-6666-4666-8666-666666666666';
const ORIGIN='https://api.example.invalid';
function createFixture(readAccounts, assertOwner, emit, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let account = null, reads = 0, admitted = false;
  let firstRead;
  const started = new Promise(resolve => { firstRead = resolve; });
  let accountResolved;
  const accountReady = new Promise(resolve => { accountResolved = resolve; });
  const boundedWait = async (pending, reason) => {
    let timer;
    try { await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(reason)), 10000); })]); }
    finally { clearTimeout(timer); }
  };
  const createdAt = new Date().toISOString();
  const result = () => ({ sessionId: SESSION, batchId: '77777777-7777-4777-8777-777777777777', status: 'completed', transactionIds: [TRANSACTION], addedCount: 1, ledgerVersion: 1 });
  const reply = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json', 'x-visibility-fixture': 'not-persisted' } });
  const row = () => ({ id: TRANSACTION, kind: 'expense', status: 'confirmed', amountMinor: 2500, currency: 'SAR', accountIds: [account], sourceAccountId: account, destinationAccountId: null, feeMinor: 0, categoryId: null, title: 'DIAGNOSTIC - not saved', merchant: null, paymentMethod: null, note: null, occurredAt: createdAt, source: 'voice', originalTransactionId: null, version: 1, deletedAt: null, undoExpiresAt: null });
  const request = async (input, init) => {
    const url = new URL(typeof input === 'object' && input && typeof input.url === 'string' ? input.url : String(input));
    if (url.origin !== ORIGIN) throw new Error('VISIBILITY_FIXTURE_NETWORK_DISABLED');
    const method = (init && init.method || typeof input === 'object' && input && input.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      emit({ stage: 'blocked-write', method, operation: url.pathname.startsWith('/api/v1/sync') ? 'sync' : 'other' });
      throw new Error('VISIBILITY_FIXTURE_WRITES_DISABLED');
    }
    if (/^\/api\/v1\/(voice|transactions|transfers|accounts|categories)(\/|$)/.test(url.pathname)) {
      assertOwner();
    }
    if (url.pathname === '/api/v1/accounts') {
      const response = await readAccounts(input, init);
      if (!response.ok) throw new Error('VISIBILITY_FIXTURE_ACCOUNT_READ_FAILED');
      const page = await response.clone().json();
      const cash = page.items.filter(item => item.isDefault && item.status === 'active' && item.currency === 'SAR');
      if (cash.length !== 1) throw new Error('VISIBILITY_FIXTURE_OWNED_ACCOUNT_REQUIRED');
      account = cash[0].id;
      accountResolved();
      return response;
    }
    if (url.pathname === '/api/v1/transactions') {
      await boundedWait(accountReady, 'VISIBILITY_FIXTURE_ACCOUNT_NOT_READY');
      assertOwner();
      const index = ++reads;
      emit({ stage: 'transaction-read', index, admitted, virtualTransactionId: TRANSACTION });
      if (index === 1) {
        firstRead();
        await wait(2500);
        emit({ stage: 'older-empty-read-completed', index });
        return reply({ items: [], nextCursor: null, ledgerVersion: 0, requestId: 'visibility-old-read' });
      }
      if (!admitted) throw new Error('VISIBILITY_FIXTURE_RECEIPT_REQUIRED');
      return reply({ items: [row()], nextCursor: null, ledgerVersion: 1, requestId: 'visibility-read-' + index });
    }
    if (url.pathname === '/api/v1/voice/batches/recovery') {
      await boundedWait(started, 'VISIBILITY_FIXTURE_NO_INITIAL_READ');
      await wait(100);
      assertOwner();
      admitted = true;
      emit({ stage: 'completed-fixture-receipt', virtualSessionId: SESSION, virtualTransactionId: TRANSACTION, persisted: false });
      return reply({ items: [{ ...result(), createdAt }] });
    }
    if (/^\/api\/v1\/voice\//.test(url.pathname)) throw new Error('VISIBILITY_FIXTURE_NO_REAL_VOICE_REQUEST');
    if (url.pathname === '/api/v1/transactions/' + TRANSACTION) throw new Error('VISIBILITY_FIXTURE_NO_EDIT_OR_DETAIL');
    throw new Error('VISIBILITY_FIXTURE_UNKNOWN_READ');
  };
  return { request, result, ids: { session: SESSION, transaction: TRANSACTION } };
}
module.exports={createFixture};
