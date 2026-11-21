import { randomUUID } from 'node:crypto';

import { ReportsRepository } from '../../../src/reports/reports.repository';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { resolveReportPeriod } from '../../../src/reports/reports.period';
import { createLivePool, describeLiveDatabase } from '../../live-database';

// Run against a freshly migrated disposable database, never shared development data.
describeLiveDatabase('account report summaries', () => {
  const owner = {
    userId: `report_scope_${randomUUID()}`,
    sessionId: 'session',
    factorAgeSeconds: 0,
  };
  const other = {
    userId: `report_scope_other_${randomUUID()}`,
    sessionId: 'session',
    factorAgeSeconds: 0,
  };
  const first = randomUUID(),
    second = randomUUID(),
    egp = randomUUID(),
    foreign = randomUUID();
  const category = randomUUID();
  const period = resolveReportPeriod('monthly', '2026-08-17', 'Asia/Riyadh');
  const pool = createLivePool();
  const repository = new ReportsRepository(pool);
  const ledger = new LedgerRepository(pool);
  let refundId: string;

  beforeAll(async () => {
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('masarifi.ledger_command','on',true)");
        await client.query(
          "insert into public.profiles(id,status,timezone) values($1,'active','Asia/Riyadh'),($2,'active','Asia/Riyadh')",
          [owner.userId, other.userId],
        );
        await client.query(
          `insert into public.accounts(id,user_id,name,type,currency_code) values
          ($1,$2,'First','bank','SAR'),($3,$2,'Second','bank','SAR'),($4,$2,'Egypt','bank','EGP'),($5,$6,'Foreign','bank','SAR')`,
          [first, owner.userId, second, egp, foreign, other.userId],
        );
        await client.query(
          "insert into public.categories(id,user_id,kind,label_ar,label_en) values($1,$2,'expense','Food','Food')",
          [category, owner.userId],
        );
        const add = async (
          kind: string,
          amount: number,
          currency: string,
          postings: Array<[string, number, string]>,
          options: { fee?: number; original?: string; status?: string } = {},
        ) => {
          const id = randomUUID();
          await client.query(
            `insert into public.transactions(id,user_id,kind,amount_minor,fee_minor,currency_code,category_id,title,occurred_at,reverses_transaction_id,status)
            values($1,$2,$3,$4,$5,$6,$7,'fixture','2026-08-02T10:00:00Z',$8,$9)`,
            [
              id,
              postings[0]?.[0] === foreign ? other.userId : owner.userId,
              kind,
              amount,
              options.fee ?? 0,
              currency,
              kind === 'expense' ? category : null,
              options.original ?? null,
              options.status ?? 'confirmed',
            ],
          );
          for (const [accountId, postingAmount, role] of postings) {
            await client.query(
              `insert into public.transaction_postings(transaction_id,account_id,amount_minor,posting_role,occurred_at)
              values($1,$2,$3,$4,'2026-08-02T10:00:00Z')`,
              [id, accountId, postingAmount, role],
            );
          }
          return id;
        };
        await add('income', 10000, 'SAR', [[first, 10000, 'destination']]);
        const expense = await add('expense', 4000, 'SAR', [[first, -4000, 'source']]);
        await add('income', 20000, 'SAR', [[second, 20000, 'destination']]);
        await add('expense', 7000, 'SAR', [[second, -7000, 'source']]);
        refundId = await add('refund', 1000, 'SAR', [[second, 1000, 'refund']], {
          original: expense,
        });
        await add(
          'transfer',
          3000,
          'SAR',
          [
            [first, -3000, 'source'],
            [second, 3000, 'destination'],
            [first, -200, 'fee'],
          ],
          { fee: 200 },
        );
        await add('transfer', 500, 'SAR', [
          [first, -500, 'source'],
          [second, 500, 'destination'],
        ]);
        // An edited expense moved between accounts: historical postings cancel.
        await add('expense', 500, 'SAR', [
          [first, -300, 'source'],
          [first, 300, 'adjustment'],
          [second, -500, 'adjustment'],
        ]);
        await add('expense', 9999, 'SAR', [[first, -9999, 'source']], { status: 'pending' });
        await add('expense', 9999, 'SAR', [[first, -9999, 'source']], { status: 'reversed' });
        await add('income', 50000, 'EGP', [[egp, 50000, 'destination']]);
        await add('expense', 12500, 'EGP', [[egp, -12500, 'source']]);
        await add('income', 99900, 'SAR', [[foreign, 99900, 'destination']]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
  });

  afterAll(() => pool.onModuleDestroy());

  const read = (accountIds?: string[], currency: string | null = 'SAR') =>
    repository.getSummary(
      owner,
      'financial_summary',
      period,
      currency,
      'account-scope-test',
      accountIds,
    );

  it('isolates same-currency accounts, receiving-account refunds, and source-only transfer fees', async () => {
    const a = await read([first]);
    expect(a.summaries).toEqual([
      {
        income: { amountMinor: 10000, currency: 'SAR' },
        expense: { amountMinor: 4200, currency: 'SAR' },
        netCashFlow: { amountMinor: 5800, currency: 'SAR' },
        savingsRateBasisPoints: 5800,
        transactionCount: 3,
      },
    ]);
    expect(a.breakdowns).toEqual([
      {
        categoryId: category,
        labelAr: 'Food',
        labelEn: 'Food',
        currencyCode: 'SAR',
        expenseMinor: 4000,
        transactionCount: 1,
      },
    ]);
    const b = await read([second]);
    expect(b.summaries).toEqual([
      {
        income: { amountMinor: 20000, currency: 'SAR' },
        expense: { amountMinor: 6500, currency: 'SAR' },
        netCashFlow: { amountMinor: 13500, currency: 'SAR' },
        savingsRateBasisPoints: 6750,
        transactionCount: 4,
      },
    ]);
    expect(b.breakdowns).toEqual([
      {
        categoryId: category,
        labelAr: 'Food',
        labelEn: 'Food',
        currencyCode: 'SAR',
        expenseMinor: 6500,
        transactionCount: 3,
      },
    ]);
    expect((await read([first, second])).summaries).toEqual((await read()).summaries);
  });

  it('returns native EGP amounts without mixing SAR or other owners', async () => {
    expect((await read([egp], 'EGP')).summaries).toEqual([
      {
        income: { amountMinor: 50000, currency: 'EGP' },
        expense: { amountMinor: 12500, currency: 'EGP' },
        netCashFlow: { amountMinor: 37500, currency: 'EGP' },
        savingsRateBasisPoints: 7500,
        transactionCount: 2,
      },
    ]);
    expect((await read([egp], 'SAR')).summaries).toEqual([]);
  });

  it('opens category records with the receiving-account refund and its original category', async () => {
    const page = await ledger.listTransactions(
      owner,
      { accountId: second, categoryId: category, status: 'confirmed' },
      'refund-drilldown',
    );
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: refundId,
          kind: 'refund',
          amountMinor: 1000,
          categoryId: category,
          accountIds: [second],
        }),
      ]),
    );
    const otherPage = await ledger.listTransactions(
      other,
      { categoryId: category },
      'other-category',
    );
    expect(otherPage.items).toEqual([]);
  });

  it('rejects missing, foreign, and mixed scopes without returning global data', async () => {
    for (const accountIds of [[foreign], [randomUUID()], [first, foreign], []]) {
      await expect(read(accountIds)).rejects.toMatchObject({ status: 404 });
    }
    await expect(
      repository.getSummary(other, 'financial_summary', period, 'SAR', 'other', [first]),
    ).rejects.toMatchObject({ status: 404 });
    expect((await read()).summaries[0]?.income.amountMinor).toBe(30000);
  });

  it.each([
    [owner, 'SAR'],
    [other, 'EGP'],
  ] as const)('supports a newly created empty account for %s', async (principal, currency) => {
    const accountId = randomUUID();
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Fresh report account','bank',$3)",
      [accountId, principal.userId, currency],
    );
    await expect(
      repository.getSummary(principal, 'financial_summary', period, currency, 'new-account', [
        accountId,
      ]),
    ).resolves.toMatchObject({ summaries: [], breakdowns: [], metadata: { dataState: 'empty' } });
  });

  it.each(['expense', 'income'] as const)(
    'keeps a moved %s in its effective account drill-down',
    async (kind) => {
      const created = (await ledger.mutate({
        operation: 'createTransaction',
        scope: 'ledger.transaction.create',
        principal: owner,
        idempotencyKey: randomUUID(),
        requestId: randomUUID(),
        status: 201,
        command: {
          kind,
          amountMinor: 300,
          currency: 'SAR',
          accountId: first,
          categoryId: kind === 'expense' ? category : null,
          title: 'Moved report row',
          merchant: null,
          paymentMethod: null,
          note: null,
          occurredAt: '2026-08-02T12:00:00Z',
          source: 'manual',
          externalRef: null,
        },
      })) as { transaction: { transaction: { id: string } } };
      const id = created.transaction.transaction.id;
      await ledger.mutate({
        operation: 'reviseTransaction',
        scope: 'ledger.transaction.revise',
        principal: owner,
        idempotencyKey: randomUUID(),
        requestId: randomUUID(),
        status: 200,
        command: {
          transactionId: id,
          expectedVersion: 1,
          reason: 'Move to current account',
          patch: { accountId: second },
        },
      });
      const current = await ledger.listTransactions(owner, { accountId: second }, 'moved-current');
      expect(current.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id,
            sourceAccountId: second,
            destinationAccountId: null,
            accountIds: [second],
          }),
        ]),
      );
      const previous = await ledger.listTransactions(owner, { accountId: first }, 'moved-previous');
      expect(previous.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
      const foreignPage = await ledger.listTransactions(
        other,
        { accountId: second },
        'foreign-moved',
      );
      expect(foreignPage.items).toEqual([]);
      const transfers = await ledger.listTransactions(
        owner,
        { accountId: second, kind: 'transfer' },
        'transfer-roles',
      );
      expect(transfers.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sourceAccountId: first, destinationAccountId: second }),
        ]),
      );
    },
  );

  it('preserves explicit transfer-reversal roles when posting order differs from account UUID order', async () => {
    const lowerAccount = first < second ? first : second;
    const higherAccount = lowerAccount === first ? second : first;
    const transferId = randomUUID(),
      reversalId = randomUUID();
    await pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query("select set_config('masarifi.ledger_command','on',true)");
        await client.query(
          `insert into public.transactions(id,user_id,kind,status,amount_minor,currency_code,title,occurred_at,reverses_transaction_id)
          values($1,$3,'transfer','reversed',900,'SAR','Reversed transfer fixture','2026-08-02T10:00:00Z',null),
            ($2,$3,'reversal','confirmed',900,'SAR','Transfer reversal fixture','2026-08-02T11:00:00Z',$1)`,
          [transferId, reversalId, owner.userId],
        );
        await client.query(
          `insert into public.transaction_postings(transaction_id,account_id,amount_minor,posting_role,occurred_at,created_at) values
          ($1,$3,-900,'source','2026-08-02T10:00:00Z','2026-08-02T10:00:00Z'),
          ($1,$4,900,'destination','2026-08-02T10:00:00Z','2026-08-02T10:00:00Z'),
          ($2,$3,900,'reversal','2026-08-02T11:00:00Z','2026-08-02T11:00:00Z'),
          ($2,$4,-900,'reversal','2026-08-02T11:00:00Z','2026-08-02T11:00:00.001Z')`,
          [transferId, reversalId, higherAccount, lowerAccount],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    });
    const page = await ledger.listTransactions(
      owner,
      { accountId: higherAccount, kind: 'reversal' },
      'reversal-roles',
    );
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: reversalId,
          sourceAccountId: higherAccount,
          destinationAccountId: null,
          accountIds: [lowerAccount, higherAccount],
        }),
      ]),
    );
    const detail = await ledger.getTransaction(owner, reversalId, 'reversal-detail-roles');
    expect(detail.transaction).toMatchObject({
      sourceAccountId: higherAccount,
      destinationAccountId: null,
    });
    const transfers = await ledger.listTransactions(
      owner,
      { kind: 'transfer' },
      'original-transfer-roles',
    );
    expect(transfers.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: transferId,
          sourceAccountId: higherAccount,
          destinationAccountId: lowerAccount,
        }),
      ]),
    );
  });
});
