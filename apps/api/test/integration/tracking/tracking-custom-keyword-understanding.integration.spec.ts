import { randomUUID } from 'node:crypto';
import {
  compileFinancialDiscoveryPolicy,
  discoverNominalTrackingMessage,
  validateRuleSnapshot,
} from '@masarifi/transaction-parser';
import { TrackingRepository } from '../../../src/tracking/tracking.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('customer keyword persistence and financial understanding', () => {
  const pool = createLivePool();
  const repository = new TrackingRepository(pool);
  let owner: string;
  const principal = () => ({ userId: owner, sessionId: 'keyword-audit', factorAgeSeconds: 0 });
  const command = {
    id: null,
    keyword: 'تنبيه محفظتي',
    groupKey: 'financial',
    languageCode: 'ar',
    matchType: 'contains',
    categoryId: null,
    priority: 100,
    enabled: true,
    expectedVersion: null,
  };
  beforeEach(async () => {
    owner = `keyword_understanding_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [owner]);
  });
  afterAll(async () => pool.onModuleDestroy());

  async function effective() {
    const configuration = await repository.ruleSnapshot(principal());
    const keywords = (configuration.keywords as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      value: String(row.keyword),
      enabled: row.enabled === true,
      origin: String(row.origin),
    }));
    return { snapshot: validateRuleSnapshot(configuration.snapshot), keywords };
  }
  function understand(text: string, configuration: Awaited<ReturnType<typeof effective>>) {
    return discoverNominalTrackingMessage(
      { text, channel: 'android_sms', sender: '+966500000001', receivedAt: 1792362000000 },
      configuration.snapshot,
      configuration.keywords,
      [],
      { sourceAdmissionPolicy: 'financial_content_v1' },
    );
  }
  async function createKeyword() {
    const key = randomUUID();
    const created = await repository.keyword(principal(), command, key, randomUUID());
    const replay = await repository.keyword(principal(), command, key, randomUUID());
    expect(replay).toMatchObject({ replayed: true, resource: created.resource });
    return created.resource as { id: string; version: number };
  }

  it('persists new wording once, reloads it into discovery/native policy, and honors edits, disable and delete', async () => {
    let saved = await createKeyword();
    let configuration = await effective();
    expect(configuration.keywords.filter((row) => row.origin === 'custom')).toHaveLength(1);
    const clear = understand('تنبيه محفظتي تم إيداع 5 ريال سعودي', configuration);
    expect(clear.customRuleKeys).toContain(`custom.${saved.id}`);
    expect(clear.classification).toMatchObject({
      direction: 'incoming',
      amountMinor: 500,
      disposition: 'capture_candidate',
    });
    expect(understand('تنبيه محفظتي معاملة 5 ريال', configuration).classification).toMatchObject({
      direction: 'unknown',
      disposition: 'review',
    });
    expect(
      compileFinancialDiscoveryPolicy(configuration.snapshot, configuration.keywords).custom,
    ).toContainEqual({
      ruleKey: `custom.${saved.id}`,
      phrase: 'تنبيه محفظتي',
    });

    const renamed = {
      ...command,
      id: saved.id,
      keyword: 'شعار محفظتي',
      expectedVersion: saved.version,
    };
    saved = (await repository.keyword(principal(), renamed, randomUUID(), randomUUID()))
      .resource as typeof saved;
    configuration = await effective();
    expect(understand('تنبيه محفظتي معاملة 5 ريال', configuration).customRuleKeys).toEqual([]);
    expect(understand('شعار محفظتي معاملة 5 ريال', configuration).customRuleKeys).toContain(
      `custom.${saved.id}`,
    );

    saved = (
      await repository.keyword(
        principal(),
        { ...renamed, enabled: false, expectedVersion: saved.version },
        randomUUID(),
        randomUUID(),
      )
    ).resource as typeof saved;
    configuration = await effective();
    expect(understand('شعار محفظتي معاملة 5 ريال', configuration).customRuleKeys).toEqual([]);
    expect(
      compileFinancialDiscoveryPolicy(configuration.snapshot, configuration.keywords).custom,
    ).toEqual([]);
    expect(understand('تم إيداع 5 ريال سعودي', configuration).classification.disposition).toBe(
      'capture_candidate',
    );
    await repository.removeRule(
      principal(),
      'keyword',
      saved.id,
      saved.version,
      randomUUID(),
      randomUUID(),
    );
    expect((await effective()).keywords.some((row) => row.id === saved.id)).toBe(false);
    expect(
      (
        await pool.query('select count(*)::int total from public.transactions where user_id=$1', [
          owner,
        ])
      ).rows[0]?.total,
    ).toBe(0);
  });

  it('rejects another owner editing a saved keyword and leaves its meaning unchanged', async () => {
    const saved = await createKeyword();
    const other = `keyword_other_${randomUUID()}`;
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [other]);
    await expect(
      repository.keyword(
        { ...principal(), userId: other },
        {
          ...command,
          id: saved.id,
          keyword: 'different wording',
          expectedVersion: saved.version,
        },
        randomUUID(),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'TRACKING_RULE_CONFLICT' } });
    expect(
      understand('تنبيه محفظتي تم إيداع 5 ريال سعودي', await effective()).customRuleKeys,
    ).toContain(`custom.${saved.id}`);
  });
});
