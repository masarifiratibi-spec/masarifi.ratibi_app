import { randomUUID } from 'node:crypto';

import { IdentityRepository } from '../../../src/identity/identity.repository';
import { IdentityService } from '../../../src/identity/identity.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('new authenticated owner bootstrap', () => {
  const pool = createLivePool();
  const repository = new IdentityRepository(pool);
  const owner = () => ({
    userId: `signup_${randomUUID()}`,
    sessionId: 'signup_session',
    factorAgeSeconds: 30,
  });
  const identity = (id: string) => ({
    id,
    primaryEmail: `${id}@example.test`,
    primaryEmailVerified: true,
    primaryPhone: null,
    displayName: 'Google Name',
    banned: false,
    locked: false,
  });
  afterAll(() => pool.onModuleDestroy());

  it('provisions a genuinely absent owner before a delayed webhook and leaves setup incomplete', async () => {
    const principal = owner();
    const clerk = { getIdentityUser: jest.fn(() => Promise.resolve(identity(principal.userId))) };
    const service = new IdentityService(repository, clerk as never);
    const profile = await service.getProfile(principal);
    expect(profile).toMatchObject({
      id: principal.userId,
      status: 'active',
    });
    await expect(service.getPreferences(principal)).resolves.toMatchObject({
      defaultCurrency: 'SAR',
    });
    await expect(service.getOnboarding(principal)).resolves.toMatchObject({
      step: 'welcome',
      completedSteps: [],
      completedAt: null,
    });
    await service.updateProfile(
      principal,
      { displayName: 'Chosen Name', expectedVersion: profile.version },
      'signup-profile',
    );
    await expect(
      service.replaceOnboarding(
        principal,
        {
          step: 'tracking_intro',
          completedSteps: ['welcome'],
          complete: false,
          expectedVersion: 1,
        },
        'signup-onboarding',
      ),
    ).resolves.toMatchObject({ completedSteps: ['welcome'] });
    // Delayed webhook must not reset the customer's completed setup or create duplicates.
    await repository.synchronizeClerkIdentity(identity(principal.userId), principal.userId);
    await expect(service.getProfile(principal)).resolves.toMatchObject({
      displayName: 'Chosen Name',
    });
    await expect(service.getOnboarding(principal)).resolves.toMatchObject({
      completedSteps: ['welcome'],
    });
    expect(clerk.getIdentityUser).toHaveBeenCalledTimes(1);
    const result = await pool.query(
      'select count(*)::int n from public.accounts where user_id=$1',
      [principal.userId],
    );
    expect(result.rows[0]?.n).toBe(0);
  });

  it('concurrent first reads create one owner and one profile event', async () => {
    const principal = owner();
    const service = new IdentityService(repository, {
      getIdentityUser: () => Promise.resolve(identity(principal.userId)),
    } as never);
    await expect(
      Promise.all([service.getProfile(principal), service.getProfile(principal)]),
    ).resolves.toHaveLength(2);
    const result = await pool.query(
      "select count(*)::int n from private.outbox_events where event_type='profile.created' and payload->>'profileId'=$1",
      [principal.userId],
    );
    expect(result.rows[0]?.n).toBe(1);
  });

  it.each(['suspended', 'deletion_pending', 'deleted'])(
    'does not reactivate an existing %s owner',
    async (status) => {
      const principal = owner();
      await repository.synchronizeClerkIdentity(identity(principal.userId), principal.userId);
      await pool.query(
        "update public.profiles set status=$2,deleted_at=case when $2='deleted' then now() else null end where id=$1",
        [principal.userId, status],
      );
      const clerk = { getIdentityUser: jest.fn(() => Promise.resolve(identity(principal.userId))) };
      const service = new IdentityService(repository, clerk as never);
      await expect(service.getProfile(principal)).rejects.toMatchObject({
        response: { code: 'PROFILE_INACTIVE' },
      });
      expect(clerk.getIdentityUser).not.toHaveBeenCalled();
      expect(
        (await pool.query('select status from public.profiles where id=$1', [principal.userId]))
          .rows[0]?.status,
      ).toBe(status);
    },
  );

  it.each(['outage', 'missing', 'mismatch', 'banned', 'locked', 'unverified'])(
    'does not provision on a provider %s',
    async (failure) => {
      const principal = owner();
      const service = new IdentityService(repository, {
        getIdentityUser: () => {
          if (failure === 'outage') return Promise.reject(new Error('CLERK_PROVIDER_UNAVAILABLE'));
          if (failure === 'missing') return Promise.resolve(null);
          return Promise.resolve({
            ...identity(failure === 'mismatch' ? 'another_owner' : principal.userId),
            banned: failure === 'banned',
            locked: failure === 'locked',
            primaryEmailVerified: failure !== 'unverified',
          });
        },
      } as never);
      await expect(service.getProfile(principal)).rejects.toMatchObject({
        response: { code: failure === 'outage' ? 'PROVIDER_UNAVAILABLE' : 'AUTH_TOKEN_INVALID' },
      });
      expect(
        (
          await pool.query('select count(*)::int n from public.profiles where id=$1', [
            principal.userId,
          ])
        ).rows[0]?.n,
      ).toBe(0);
    },
  );
  it('rejects bootstrap for another owner or without session claims and has no public entry point', async () => {
    for (const claims of [{}, { role: 'authenticated', sub: 'other_owner', sid: 'session' }]) {
      await expect(
        pool.withClient(async (client) => {
          await client.query('begin');
          try {
            await client.query("select set_config('request.jwt.claims',$1,true)", [
              JSON.stringify(claims),
            ]);
            await client.query('set local role masarifi_api');
            await client.query('select private.ensure_authenticated_profile($1,null)', [
              'target_owner',
            ]);
          } finally {
            await client.query('rollback');
          }
        }),
      ).rejects.toMatchObject({ code: '28000' });
    }
    const privileges = await pool.query(
      "select has_function_privilege(r,'private.ensure_authenticated_profile(text,jsonb)','EXECUTE') allowed from unnest(array['anon','authenticated','masarifi_worker']) r",
    );
    expect(privileges.rows.every((row) => row.allowed === false)).toBe(true);
  });
});
