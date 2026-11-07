import { randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { IdentityRepository } from '../../../src/identity/identity.repository';
import { IdentityService } from '../../../src/identity/identity.service';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { normalizeCreateAccount } from '../../../src/reference/reference.dto';
import { ReferenceRepository } from '../../../src/reference/reference.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('personal finance for every authenticated owner', () => {
  const pool = createLivePool();
  const identity = new IdentityRepository(pool);
  const reference = new ReferenceRepository(pool);
  const ledger = new LedgerRepository(pool);
  const assistant = new AiRepository(pool);
  afterAll(() => pool.onModuleDestroy());

  it.each([false, true])(
    'supports first use, replay and isolation with dashboard membership %s',
    async (staff) => {
      const principal = {
        userId: 'personal_' + randomUUID(),
        sessionId: randomUUID(),
        factorAgeSeconds: 0,
      };
      const service = new IdentityService(identity, {
        getIdentityUser: (id: string) =>
          Promise.resolve({
            id,
            primaryEmail: null,
            primaryPhone: null,
            displayName: 'New owner',
            banned: false,
            locked: false,
          }),
      } as never);
      await expect(service.getProfile(principal)).resolves.toMatchObject({ id: principal.userId });
      if (staff)
        await pool.query('insert into public.admin_profiles(user_id) values($1)', [
          principal.userId,
        ]);
      const base = { principal, requestId: randomUUID(), query: {}, params: {} };
      const account = {
        ...base,
        operation: 'createAccount',
        idempotencyKey: randomUUID(),
        body: normalizeCreateAccount({
          name: 'Pocket',
          type: 'cash',
          currency: 'SAR',
          openingBalanceMinor: 800,
        }),
      };
      const first = (await ledger.createAccount(account, reference)) as { account: { id: string } };
      expect(first.account.id).toBeTruthy();
      await expect(ledger.createAccount(account, reference)).resolves.toMatchObject({
        account: { id: first.account.id },
      });
      const category = {
        ...base,
        operation: 'createCategory',
        idempotencyKey: randomUUID(),
        body: {
          kind: 'expense',
          labelAr: 'قهوة',
          labelEn: 'Coffee',
          icon: null,
          color: null,
          parentId: null,
          sortOrder: 0,
        },
      };
      const saved = (await reference.execute(category)) as { id: string };
      expect(saved.id).toBeTruthy();
      await expect(reference.execute(category)).resolves.toMatchObject({ id: saved.id });
      const key = randomUUID();
      await expect(
        assistant.setConsent(principal, 'assistant-privacy-v1', true, 1, key),
      ).resolves.toMatchObject({ resource: { granted: true, version: 2 } });
      await expect(
        assistant.setConsent(principal, 'assistant-privacy-v1', true, 1, key),
      ).resolves.toMatchObject({ resource: { granted: true, version: 2 } });
      await expect(
        assistant.createConversation(principal, 'My spending', randomUUID()),
      ).resolves.toMatchObject({ resource: { status: 'active' } });
      const owned = await identity.withCustomerTransaction(principal, async (client) => {
        await client.query('select private.post_transaction($1,$2::jsonb)', [
          principal.userId,
          JSON.stringify({
            kind: 'expense',
            amountMinor: 100,
            currency: 'SAR',
            accountId: first.account.id,
            categoryId: saved.id,
            title: 'Coffee',
            occurredAt: new Date().toISOString(),
          }),
        ]);
        return client.query('select user_id from public.transactions');
      });
      expect(owned.rows).toEqual([{ user_id: principal.userId }, { user_id: principal.userId }]);
      const other = { ...principal, userId: 'foreign_' + randomUUID(), sessionId: randomUUID() };
      await service.getProfile(other);
      const read = await identity.withCustomerTransaction(other, (c) =>
        c.query('select id from public.transactions where user_id=$1', [principal.userId]),
      );
      expect(read.rows).toEqual([]);
      await expect(
        identity.withCustomerTransaction(other, (c) =>
          c.query("select private.claim_idempotency_key($1,$2,$3,$4,interval '2 minutes')", [
            principal.userId,
            'reference.account.create',
            'sha256:' + 'a'.repeat(64),
            'sha256:' + 'b'.repeat(64),
          ]),
        ),
      ).rejects.toThrow('AUTH_TOKEN_INVALID');
    },
  );
});
