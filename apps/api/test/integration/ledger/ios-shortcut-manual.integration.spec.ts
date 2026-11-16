import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { normalizeCreateTransaction } from '../../../src/ledger/ledger.dto';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { ledgerDetailSchema } from '../../../../mobile/src/services/live/ledger-api-contract';
import { createLivePool, describeLiveDatabase, withFixtureOwner } from '../../live-database';

describeLiveDatabase('iOS confirmed manual ledger with automatic tracking opted out', () => {
  const pool = createLivePool();
  const repository = new LedgerRepository(pool);
  const owner = {
    userId: `ios_shortcut_${randomUUID()}`,
    sessionId: 'ios-qa',
    factorAgeSeconds: 0,
  };
  const other = {
    userId: `ios_shortcut_other_${randomUUID()}`,
    sessionId: 'ios-qa-other',
    factorAgeSeconds: 0,
  };
  const accounts = { income: randomUUID(), expense: randomUUID() };
  const categories = { income: randomUUID(), expense: randomUUID() };

  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      !['54322', '54522'].includes(target.port) ||
      target.pathname !== '/postgres'
    )
      throw Error('EXPLICIT_LOCAL_DISPOSABLE_DATABASE_REQUIRED');
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      owner.userId,
      other.userId,
    ]);
    await pool.query(
      'insert into public.tracking_preferences(user_id,enabled,review_required) values($1,false,true)',
      [owner.userId],
    );
    for (const kind of ['income', 'expense'] as const) {
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code,automatic_tracking_enabled) values($1,$2,'iOS QA','bank','SAR',false)",
        [accounts[kind], owner.userId],
      );
      await pool.query(
        'insert into public.categories(id,user_id,kind,label_ar,label_en) values($1,$2,$3,$4,$5)',
        [categories[kind], owner.userId, kind, 'تصنيف اختبار', 'QA category'],
      );
    }
  });
  afterAll(() => pool.onModuleDestroy());

  it('demonstrates the real legacy tracking-account gate with global opt-out', async () => {
    await expect(
      withFixtureOwner(pool, owner.userId, (client) =>
        client.query('select private.assert_automatic_tracking_account($1,$2)', [
          owner.userId,
          accounts.expense,
        ]),
      ),
    ).rejects.toMatchObject({ message: 'TRACKING_ACCOUNT_BLOCKED' });
  });

  it.each([
    { kind: 'expense', amount: 1234, sign: -1 },
    { kind: 'income', amount: 550000, sign: 1 },
  ] as const)(
    'commits the confirmed $kind, replays once, and preserves two distinct message identities',
    async ({ kind, amount, sign }) => {
      const key = randomUUID();
      const command = normalizeCreateTransaction({
        kind,
        amountMinor: amount,
        currency: 'SAR',
        accountId: accounts[kind],
        categoryId: categories[kind],
        title: 'Message transaction',
        merchant: null,
        note: null,
        occurredAt: new Date().toISOString(),
        source: 'platform_assisted',
      });
      const input = (operationId = key, body = command, principal = owner) => ({
        operation: 'createTransaction',
        scope: 'ledger.transaction.create',
        principal,
        command: body,
        idempotencyKey: operationId,
        requestId: randomUUID(),
        status: 201,
      });
      const first = await repository.mutate(input());
      const detail = ledgerDetailSchema.parse(Reflect.get(first as object, 'transaction'));
      expect(detail.postings).toHaveLength(1);
      expect(detail.postings[0]).toMatchObject({
        accountId: accounts[kind],
        amountMinor: sign * amount,
        postingRole: kind === 'income' ? 'destination' : 'source',
      });
      const replay = await repository.mutate(input());
      expect(replay).toEqual(first);
      const beforeSecond = await pool.query<{ count: number; balance: string }>(
        `select (select count(*)::int from public.transactions t where t.user_id=$1 and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id and p.account_id=$2)) count,(select confirmed_minor::text from public.account_balances where account_id=$2) balance`,
        [owner.userId, accounts[kind]],
      );
      expect(beforeSecond.rows[0]).toEqual({ count: 1, balance: String(sign * amount) });
      const second = await repository.mutate(input(randomUUID()));
      const secondDetail = ledgerDetailSchema.parse(Reflect.get(second as object, 'transaction'));
      expect(secondDetail.transaction.id).not.toBe(detail.transaction.id);
      await expect(
        repository.mutate(input(key, { ...command, amountMinor: amount + 1 })),
      ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
      await expect(repository.mutate(input(randomUUID(), command, other))).rejects.toBeInstanceOf(
        HttpException,
      );
      const state = await pool.query<{
        count: number;
        balance: string;
        enabled: boolean;
        accountEnabled: boolean;
      }>(
        `select (select count(*)::int from public.transactions t where t.user_id=$1 and exists(select 1 from public.transaction_postings p where p.transaction_id=t.id and p.account_id=$2)) count,(select confirmed_minor::text from public.account_balances where account_id=$2) balance,(select enabled from public.tracking_preferences where user_id=$1) enabled,(select automatic_tracking_enabled from public.accounts where id=$2) "accountEnabled"`,
        [owner.userId, accounts[kind]],
      );
      expect(state.rows[0]).toEqual({
        count: 2,
        balance: String(sign * amount * 2),
        enabled: false,
        accountEnabled: false,
      });
    },
  );
});
