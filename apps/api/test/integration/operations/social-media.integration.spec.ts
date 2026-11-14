import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('governed social media account links', () => {
  const pool = createLivePool();
  const admin = `social_admin_${randomUUID()}`;
  const user = `social_user_${randomUUID()}`;
  const empty = { instagram: '', tiktok: '', snapchat: '' };
  const links = {
    instagram: 'https://instagram.com/masarifi',
    tiktok: 'https://tiktok.com/@masarifi',
    snapchat: 'https://snapchat.com/add/masarifi',
  };
  const readSetting = async (client: PoolClient) => {
    const result = await client.query<{ value: typeof empty; version: number | string }>(
      "select value,version from private.system_settings where setting_key='mobile.social_links'",
    );
    const setting = result.rows[0];
    if (!setting) throw new Error('SOCIAL_MEDIA_SETTING_MISSING');
    return setting;
  };

  const actor = async (client: PoolClient, userId: string) => {
    await client.query('reset role');
    await client.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: userId, sid: 'social-regression' }),
    ]);
    await client.query('set local role masarifi_api');
  };
  const scenario = (run: (client: PoolClient) => Promise<void>) =>
    pool.withClient(async (client) => {
      await client.query('begin');
      try {
        await client.query(
          "insert into public.profiles(id,status) values($1,'active'),($2,'active')",
          [admin, user],
        );
        await client.query(
          "insert into public.admin_profiles(user_id,status) values($1,'active')",
          [admin],
        );
        await client.query(
          "insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason) select $1,id,$1,'Social media acceptance test' from public.roles where key='super-admin'",
          [admin],
        );
        await run(client);
      } finally {
        await client.query('rollback');
      }
    });
  const write = async (
    client: PoolClient,
    value: unknown,
    version: number,
    id = randomUUID(),
    actorId = admin,
  ) => {
    await actor(client, actorId);
    const result = await client.query<{ value: { version: number; replayed?: boolean } }>(
      'select private.execute_operations_command($1,$2,$3::jsonb,$4,$5,$6) value',
      [
        'updateSetting',
        'mobile.social_links',
        JSON.stringify({
          value,
          expectedVersion: version,
          reason: 'Update public social media accounts',
        }),
        actorId,
        id,
        `sha256:${id.replaceAll('-', '').padEnd(64, '0')}`,
      ],
    );
    const saved = result.rows[0]?.value;
    if (!saved) throw new Error('SOCIAL_MEDIA_WRITE_RESULT_MISSING');
    return saved;
  };
  afterAll(() => pool.onModuleDestroy());

  it('publishes saved links, replays writes safely and hides cleared accounts', async () => {
    await scenario(async (client) => {
      const version = Number((await readSetting(client)).version);
      const id = randomUUID();
      const saved = await write(client, links, version, id);
      expect(saved.version).toBe(version + 1);
      expect(await write(client, links, version, id)).toMatchObject({
        version: version + 1,
        replayed: true,
      });
      await actor(client, user);
      expect(
        (
          await client.query<{ value: typeof empty }>(
            'select private.read_social_media_links() value',
          )
        ).rows[0]?.value,
      ).toEqual(links);
      const cleared = await write(client, empty, saved.version);
      expect(cleared.version).toBe(version + 2);
      expect(
        (
          await client.query<{ value: typeof empty }>(
            'select private.read_social_media_links() value',
          )
        ).rows[0]?.value,
      ).toEqual(empty);
    });
  });
  it.each([
    { ...links, instagram: 'https://instagram.com.evil.test/masarifi' },
    { ...links, tiktok: 'javascript:alert(1)' },
    { ...links, snapchat: 'https://snapchat.com/' },
    { ...links, instagram: null },
    { ...links, unexpected: 'https://evil.test' },
  ])('rejects invalid links without changing the saved setting: %j', async (value) => {
    await scenario(async (client) => {
      const before = await readSetting(client);
      await client.query('savepoint invalid_link');
      await expect(write(client, value, Number(before.version))).rejects.toMatchObject({
        code: '22023',
      });
      await client.query('rollback to savepoint invalid_link');
      expect(await readSetting(client)).toEqual(before);
    });
  });
  it('rejects stale writes and ordinary users', async () => {
    await scenario(async (client) => {
      const version = Number((await readSetting(client)).version);
      await client.query('savepoint rejected_write');
      await expect(write(client, links, version + 1)).rejects.toMatchObject({ code: '40001' });
      await client.query('rollback to savepoint rejected_write');
      await expect(write(client, links, version, randomUUID(), user)).rejects.toMatchObject({
        code: '42501',
      });
    });
  });
});
