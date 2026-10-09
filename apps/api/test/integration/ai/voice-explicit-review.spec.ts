import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import { AiRepository } from '../../../src/ai/ai.repository';
import { AiService } from '../../../src/ai/ai.service';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { SecurityRepository } from '../../../src/security/security.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('Scoped Voice extraction with explicit financial review', () => {
  const pool = createLivePool();
  const repository = new AiRepository(pool);
  const user = 'voice_review_' + randomUUID();
  const other = 'voice_review_other_' + randomUUID();
  const admin = 'voice_review_admin_' + randomUUID();
  const account = randomUUID(),
    category = randomUUID();
  const principal = { userId: user, sessionId: 'disposable-review-session', factorAgeSeconds: 0 };
  const bytes = Buffer.alloc(44);
  bytes.write('ftyp', 4);
  bytes.write('M4A ', 8);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const config = {
    get: (key: string) => (key === 'MASARIFI_VOICE_ANALYSIS_ONLY' ? true : undefined),
    getRequired: (key: string) => (key === 'MASARIFI_AI_PROVIDER_ENABLED' ? true : 300),
  };
  const ledger = new LedgerService(new LedgerRepository(pool), new SecurityRepository(pool), {
    get: () => undefined,
  } as never);
  const service = new AiService(
    repository,
    {
      upload: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    } as never,
    ledger,
    {} as never,
    {} as never,
    {} as never,
    config as never,
  );
  let previousPolicy: { enabled: boolean; owner_id: string | null } | undefined;
  let previousPosting: boolean;
  let previousRoute: boolean;
  let previousBudget: unknown;

  beforeAll(async () => {
    const db = (
      await pool.query<{ name: string; address: string }>(
        'select current_database() name,host(inet_server_addr()) address',
      )
    ).rows[0];
    const expectedDatabase =
      process.env.CROSS_FEATURE_DISPOSABLE_DATABASE_NAME ?? 'voice_review_20261007';
    const connection = new URL(process.env.DATABASE_URL ?? '');
    if (db?.name !== expectedDatabase || !['127.0.0.1', 'localhost'].includes(connection.hostname))
      throw new Error('DISPOSABLE_DATABASE_REQUIRED');
    previousPolicy = (
      await pool.query<{ enabled: boolean; owner_id: string | null }>(
        'select enabled,owner_id from private.voice_analysis_policy',
      )
    ).rows[0];
    previousPosting =
      (await pool.query<{ enabled: boolean }>('select enabled from private.voice_automatic_policy'))
        .rows[0]?.enabled ?? false;
    previousRoute =
      (
        await pool.query<{ enabled: boolean }>(
          "select enabled from private.ai_feature_routes where workload='voice_transcription'",
        )
      ).rows[0]?.enabled ?? false;
    previousBudget = (
      await pool.query<{ value: unknown }>(
        "select value from private.system_settings where setting_key='ai.global.monthly_budget'",
      )
    ).rows[0]?.value;
    // This disposable clone contains historical test reservations; allocate a test budget only here.
    await pool.query(
      "update private.system_settings set value='10000'::jsonb where setting_key='ai.global.monthly_budget'",
    );
    await pool.query(
      "insert into public.profiles(id,status) values($1,'active'),($2,'active'),($3,'active')",
      [user, other, admin],
    );
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      admin,
    ]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code,is_default) values($1,$2,'Voice Staging Test','bank','SAR',true)",
      [account, user],
    );
    await pool.query(
      "insert into public.categories(id,user_id,kind,label_ar,label_en) values($1,$2,'expense','طعام','Food')",
      [category, user],
    );
    await pool.query(
      "update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=clock_timestamp() where workload='voice_transcription'",
      [admin],
    );
    await pool.query(
      "update private.ai_feature_routes set enabled=true where workload='voice_transcription'",
    );
    await pool.query('update private.voice_automatic_policy set enabled=false');
    await pool.query('update private.voice_analysis_policy set enabled=true,owner_id=$1', [user]);
  });
  afterAll(async () => {
    if (previousPolicy) {
      await pool.query('update private.voice_analysis_policy set enabled=$1,owner_id=$2', [
        previousPolicy.enabled,
        previousPolicy.owner_id,
      ]);
      await pool.query('update private.voice_automatic_policy set enabled=$1', [previousPosting]);
      await pool.query(
        "update private.ai_feature_routes set enabled=$1 where workload='voice_transcription'",
        [previousRoute],
      );
      await pool.query(
        "update private.system_settings set value=$1::jsonb where setting_key='ai.global.monthly_budget'",
        [JSON.stringify(previousBudget)],
      );
    }
    await pool.onModuleDestroy();
  });

  const input = () => ({
    locale: 'en',
    durationMs: 3000,
    contentType: 'audio/m4a',
    sizeBytes: bytes.length,
    contentHash: hash,
    recordedAt: new Date().toISOString(),
    timezoneOffsetMinutes: -180,
  });

  it('rejects non-owner review admission while retaining the automatic Posting gate', async () => {
    await expect(
      service.createVoiceSession({ ...principal, userId: other }, input(), randomUUID()),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      repository.createVoiceSession(principal, input(), randomUUID(), 300, {
        maxAuthAge: 300,
        thresholds: {},
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('claims review and immutable analysis extraction without claiming ordinary financial work', async () => {
    const review = await repository.createVoiceReviewSession(principal, input(), randomUUID());
    const ordinary = await repository.createVoiceSession(principal, input(), randomUUID());
    const analysis = await repository.createVoiceSession(principal, input(), randomUUID(), 300, {
      maxAuthAge: 300,
      thresholds: {},
      analysisOnly: true,
    });
    const id = (created: unknown) => (created as { resource: { id: string } }).resource.id;
    const ids = [review, ordinary, analysis].map(id);
    await pool.query(
      "update public.voice_sessions set status='uploaded',uploaded_at=clock_timestamp(),finalized_at=clock_timestamp() where id=any($1::uuid[])",
      [ids],
    );
    const claims = await repository.claimAnalysisWork('scoped-extraction-test', 25, 120);
    expect(new Set(claims.map((c) => c.id))).toEqual(new Set([id(review), id(analysis)]));
    await pool.query(
      "update public.voice_sessions set status='failed',claim_token=null,claimed_by=null,lease_until=null where id=any($1::uuid[])",
      [ids],
    );
    const immutable = (
      await pool.query<{ contract_version: number; analysis_only: boolean }>(
        'select s.contract_version,c.analysis_only from public.voice_sessions s join private.voice_batch_context c on c.session_id=s.id where s.id=$1',
        [id(analysis)],
      )
    ).rows[0];
    expect(immutable).toEqual({ contract_version: 3, analysis_only: true });
    const privileges = (
      await pool.query<{ api: boolean; worker: boolean; public: boolean }>(
        "select has_function_privilege('masarifi_api','private.create_voice_review_session(text,jsonb,uuid,integer)','EXECUTE') api,has_function_privilege('masarifi_worker','private.create_voice_review_session(text,jsonb,uuid,integer)','EXECUTE') worker,has_function_privilege('authenticated','private.create_voice_review_session(text,jsonb,uuid,integer)','EXECUTE') public",
      )
    ).rows[0];
    expect(privileges).toEqual({ api: true, worker: false, public: false });
  });

  it.each([
    ['en', 'I spent 25 Saudi riyals on food from Voice Staging Test today', '2500'],
    ['ar', 'صرفت ٢٥ ريال سعودي على الطعام من حساب Voice Staging Test اليوم', '2500'],
    ['en', 'I received 50 Saudi riyals in Voice Staging Test today', '-5000'],
  ])(
    'extracts %s proposal, requires confirmation, and replays one ledger effect (%s)',
    async (language, transcript, amountMinor) => {
      const capture = { ...input(), locale: language };
      const before =
        (
          await pool.query<{ count: number }>(
            'select count(*)::integer count from public.transactions where user_id=$1',
            [user],
          )
        ).rows[0]?.count ?? 0;
      const key = randomUUID();
      const created = await service.createVoiceSession(principal, capture, key);
      expect((await service.createVoiceSession(principal, capture, key)).session.id).toBe(
        created.session.id,
      );
      const request = Object.assign(Readable.from([bytes]), {
        headers: { 'content-type': 'audio/m4a', 'content-length': String(bytes.length) },
      }) as unknown as Request;
      const uploaded = await service.uploadVoiceAudio(
        principal,
        String(created.session.id),
        request,
      );
      await service.processVoiceSession(
        principal,
        String(created.session.id),
        { uploadCompleted: true, expectedVersion: uploaded.version, contentHash: hash },
        randomUUID(),
      );
      const claims = await repository.claimAnalysisWork('disposable-review-worker', 25, 120);
      const claim = claims.find((c) => c.id === created.session.id);
      if (!claim) throw new Error('REVIEW_CAPTURE_NOT_CLAIMED');
      const work = await repository.workInput(claim.kind, claim.id, claim.claim_token);
      expect(work.contractVersion).not.toBe(3);
      expect(work.aliases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: account,
            data: expect.objectContaining({
              name: 'Voice Staging Test',
              currency: 'SAR',
              minorUnit: 2,
            }) as unknown,
          }),
        ]),
      );
      const date = new Date(Date.parse(capture.recordedAt) + 180 * 60000)
        .toISOString()
        .slice(0, 10);
      // The provider response is simulated here; real speech/provider recognition requires Samsung.
      await repository.saveVoiceResult(claim.id, claim.claim_token, {
        provider: 'fixture',
        model: 'fixture',
        transcript,
        language,
        confidence: 0.95,
        payload: {
          schemaVersion: 1,
          type: 'transaction.create',
          amountMinor,
          currency: 'SAR',
          accountId: account,
          categoryId: amountMinor.startsWith('-') ? null : category,
          date,
          merchant: null,
          note: null,
          confidence: 0.95,
        },
      });
      await repository.recordUsage(
        user,
        'voice_transcription',
        {
          provider: 'fixture',
          model: 'fixture',
          usage: { inputTokens: 1, outputTokens: 1, cost: 0.000001 },
          latencyMs: 1,
          fallbackUsed: false,
          generationId: randomUUID(),
        },
        String(work.operationId),
      );
      const recovery = await service.getVoiceRecovery(principal, claim.id);
      expect(recovery).toMatchObject({ phase: 'proposed', transcriptLanguage: language });
      expect(
        (await pool.query('select * from public.transactions where user_id=$1', [user])).rows,
      ).toHaveLength(before);
      const proposal = recovery.proposal as { id: string; version: number };
      const decision = {
        expectedVersion: proposal.version,
        editedFields: {
          amountMinor,
          currency: 'SAR',
          accountId: account,
          categoryId: amountMinor.startsWith('-') ? null : category,
          date,
          merchant: null,
          note: null,
        },
        occurredAt: new Date(Date.parse(date + 'T00:00:00Z') - 180 * 60000).toISOString(),
        timezoneOffsetMinutes: -180,
        reason: null,
      };
      const confirmKey = randomUUID();
      const lost = jest
        .spyOn(repository, 'completeVoiceAction')
        .mockRejectedValueOnce(new Error('lost confirmation bookkeeping'));
      const receipt = await service.confirmVoice(principal, proposal.id, decision, confirmKey);
      lost.mockRestore();
      expect(
        await service.confirmVoice(principal, proposal.id, decision, confirmKey),
      ).toMatchObject({ resourceId: receipt.resourceId, replayed: true });
      expect(
        (
          await pool.query(
            'select amount_minor::text amount,currency_code,category_id,occurred_at from public.transactions where id=$1',
            [receipt.resourceId],
          )
        ).rows,
      ).toEqual([
        expect.objectContaining({
          amount: String(Math.abs(Number(amountMinor))),
          currency_code: 'SAR',
          category_id: amountMinor.startsWith('-') ? null : category,
          occurred_at: new Date(decision.occurredAt),
        }),
      ]);
      expect(
        (
          await pool.query(
            'select account_id,amount_minor::text amount from public.transaction_postings where transaction_id=$1',
            [receipt.resourceId],
          )
        ).rows,
      ).toEqual([{ account_id: account, amount: String(-Number(amountMinor)) }]);
      expect(await service.getVoiceRecovery(principal, claim.id)).toMatchObject({
        phase: 'confirmed',
        transactionId: receipt.resourceId,
      });
      expect(
        (
          await pool.query<{ enabled: boolean }>(
            'select enabled from private.voice_automatic_policy',
          )
        ).rows[0]?.enabled,
      ).toBe(false);
    },
  );
});
