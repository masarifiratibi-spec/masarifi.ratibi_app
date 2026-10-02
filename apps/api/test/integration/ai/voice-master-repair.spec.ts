import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import { AiRepository } from '../../../src/ai/ai.repository';
import { AiService } from '../../../src/ai/ai.service';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('Master Voice operation identity', () => {
  const pool = createLivePool();
  const repository = new AiRepository(pool);
  const userId = 'voice_master_' + randomUUID();
  const adminId = 'voice_master_admin_' + randomUUID();
  const principal = { userId, sessionId: 'local-session', factorAgeSeconds: 0 };
  const bytes = Buffer.from('fictional-local-audio');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const storage = {
    upload: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
  };
  const service = new AiService(
    repository,
    storage as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      getRequired: (key: string) =>
        key === 'MASARIFI_AI_PROVIDER_ENABLED'
          ? true
          : key === 'MASARIFI_REQUEST_TIMEOUT_MS'
            ? 30_000
            : 300,
    } as never,
  );
  const audioRequest = (body = bytes) =>
    Object.assign(Readable.from([body]), {
      headers: { 'content-type': 'audio/m4a', 'content-length': String(bytes.length) },
    }) as unknown as Request;
  const create = (key: string) =>
    service.createVoiceSession(
      principal,
      {
        locale: 'en',
        durationMs: 2832,
        contentType: 'audio/m4a',
        sizeBytes: bytes.length,
        contentHash: hash,
        recordedAt: new Date().toISOString(),
        timezoneOffsetMinutes: -180,
      },
      key,
    );
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [userId]);
    await pool.query("insert into public.profiles(id,status) values($1,'active')", [adminId]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      adminId,
    ]);
    await pool.query(
      "update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=clock_timestamp() where workload='voice_transcription'",
      [adminId],
    );
    await pool.query(
      "update private.ai_feature_routes set enabled=true where workload='voice_transcription'",
    );
  });
  afterAll(async () => {
    await pool.query(
      'delete from private.voice_provider_attempts where session_id in(select id from public.voice_sessions where user_id=$1)',
      [userId],
    );
    await pool.query('delete from private.ai_usage_events where user_id=$1', [userId]);
    await pool.query('delete from public.voice_sessions where user_id=$1', [userId]);
    await pool.query(
      "update private.ai_feature_routes set enabled=false where workload='voice_transcription'",
    );
    await pool.onModuleDestroy();
  });
  it('uses the reservation PROCESS identity in claimed Worker input', async () => {
    const created = await repository.createVoiceSession(
      principal,
      { locale: 'en', durationMs: 2832, contentType: 'audio/m4a', sizeBytes: 46885 },
      'voice-master-create-0001',
    );
    const session = Reflect.get(created, 'resource') as Record<string, unknown>;
    const key = 'voice-master-process-0001';
    await repository.processVoiceSession(
      principal,
      String(session.id),
      { expectedVersion: 1, contentHash: 'a'.repeat(64) },
      key,
    );
    const claims = await repository.claimWork(
      'voice.transcribe_extract',
      'master-local-worker',
      100,
      120,
    );
    const claim = claims.find((value) => value.id === session.id);
    if (!claim) throw new Error('missing SQL claim');
    const input = await repository.workInput(claim.kind, claim.id, claim.claim_token);
    expect(input.operationId).toBe(
      repository.operationId(principal, 'ai.voice-session.process.' + String(session.id), key),
    );
  });

  it('uploads identical bytes once and returns the same receipt on replay', async () => {
    const created = await create('voice-master-upload-0001');
    const id = String(created.session.id);
    expect(created.upload).toMatchObject({
      method: 'PUT',
      path: '/api/v1/voice/sessions/' + id + '/audio',
    });
    const first = await service.uploadVoiceAudio(principal, id, audioRequest());
    const replay = await service.uploadVoiceAudio(principal, id, audioRequest());
    expect(replay).toEqual(first);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(await service.getVoiceRecovery(principal, id)).toMatchObject({
      phase: 'uploaded',
      recordedAt: expect.any(String) as unknown,
      timezoneOffsetMinutes: -180,
      captureContextLegacy: false,
    });
  });

  it('rejects mismatched bytes before private Storage is written', async () => {
    storage.upload.mockClear();
    const created = await create('voice-master-upload-0002');
    await expect(
      service.uploadVoiceAudio(
        principal,
        String(created.session.id),
        audioRequest(Buffer.alloc(bytes.length)),
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('retains accepted media when the SQL upload acknowledgement is lost', async () => {
    storage.delete.mockClear();
    const created = await create('voice-upload-commit-lost');
    const original = repository.finishVoiceUpload.bind(repository);
    const finish = jest
      .spyOn(repository, 'finishVoiceUpload')
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new Error('SQL acknowledgement lost');
      });
    await expect(
      service.uploadVoiceAudio(principal, String(created.session.id), audioRequest()),
    ).rejects.toThrow('SQL acknowledgement lost');
    finish.mockRestore();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(
      await service.uploadVoiceAudio(principal, String(created.session.id), audioRequest()),
    ).toMatchObject({ id: created.session.id, contentHash: hash });
  });

  it('does not consume a request body before owner authorization', async () => {
    const created = await create('voice-master-upload-0003');
    const request = audioRequest();
    const read = jest.spyOn(request, Symbol.asyncIterator);
    await expect(
      service.uploadVoiceAudio(
        { ...principal, userId: adminId },
        String(created.session.id),
        request,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(read).not.toHaveBeenCalled();
    request.destroy();
  });

  it('keeps cancellation authoritative and rejects finalization without a reservation', async () => {
    const created = await create('voice-master-cancel-0001');
    const id = String(created.session.id);
    const uploaded = await service.uploadVoiceAudio(principal, id, audioRequest());
    expect(
      await service.cancelVoiceSession(principal, id, 'voice-master-cancel-key'),
    ).toMatchObject({ status: 'cancelled' });
    expect(await service.getVoiceRecovery(principal, id)).toMatchObject({
      phase: 'cancelled',
      proposal: null,
    });
    await expect(
      repository.processVoiceSession(
        principal,
        id,
        { expectedVersion: uploaded.version, contentHash: hash },
        'voice-master-cancel-process',
      ),
    ).rejects.toMatchObject({ status: 409 });
    const reserved = await pool.query(
      'select count(*)::integer count from private.ai_usage_events where request_id=$1',
      [
        repository.operationId(
          principal,
          'ai.voice-session.process.' + id,
          'voice-master-cancel-process',
        ),
      ],
    );
    expect(reserved.rows[0]?.count).toBe(0);
  });

  it('retains a cancelled media key until the late-upload window is closed', async () => {
    const created = await create('voice-master-purge-0001');
    const id = String(created.session.id);
    await service.cancelVoiceSession(principal, id, 'voice-master-purge-cancel');
    const claims = await repository.claimPurges('master-purge-worker', 100, 120);
    const purge = claims.find((claim) => claim.id === id);
    if (!purge) throw new Error('missing purge claim');
    expect(purge).toBeDefined();
    await repository.completePurge(id, purge.purge_token, true);
    const result = await pool.query('select storage_ref from public.voice_sessions where id=$1', [
      id,
    ]);
    expect(result.rows[0]?.storage_ref).toBe(purge.storage_ref);
  });

  it('does not claim or complete expired Voice work', async () => {
    const created = await create('voice-master-expiry-0001');
    const id = String(created.session.id);
    const uploaded = await service.uploadVoiceAudio(principal, id, audioRequest());
    await repository.processVoiceSession(
      principal,
      id,
      { expectedVersion: uploaded.version, contentHash: hash },
      'voice-master-expiry-process',
    );
    const claim = (
      await repository.claimWork('voice.transcribe_extract', 'expiry-worker', 100, 120)
    ).find((value) => value.id === id);
    if (!claim) throw new Error('missing SQL claim');
    await pool.query(
      "update public.voice_sessions set created_at=clock_timestamp()-interval '1 day',expires_at=clock_timestamp()-interval '1 second' where id=$1",
      [id],
    );
    expect(
      await repository.completeWork(
        claim.kind,
        id,
        claim.claim_token,
        'failed',
        'AI_PROCESSING_FAILED',
      ),
    ).toBe(false);
    await pool.query(
      "update public.voice_sessions set lease_until=clock_timestamp()-interval '1 second' where id=$1",
      [id],
    );
    expect(
      (await repository.claimWork('voice.transcribe_extract', 'expiry-worker-2', 100, 120)).some(
        (value) => value.id === id,
      ),
    ).toBe(false);
    expect(await service.getVoiceRecovery(principal, id)).toMatchObject({
      phase: 'expired',
      session: { status: 'expired', failureCode: null },
    });
    expect(await service.getVoiceSession(principal, id)).toMatchObject({ status: 'expired' });
  });

  async function dispatchFixture(key: string) {
    const created = await create(key);
    const id = String(created.session.id);
    const uploaded = await service.uploadVoiceAudio(principal, id, audioRequest());
    await repository.processVoiceSession(
      principal,
      id,
      { expectedVersion: uploaded.version, contentHash: hash },
      key + '-process',
    );
    const claim = (
      await repository.claimWork('voice.transcribe_extract', 'attempt-worker', 100, 120)
    ).find((value) => value.id === id);
    if (!claim) throw new Error('missing SQL claim');
    const route = await repository.getRoute('voice_transcription');
    if (!route) throw new Error('missing governed route');
    return { id, claim, route };
  }

  it('caps durable dispatches across reclaim and retains one quota event for both attempts', async () => {
    const { id, claim, route } = await dispatchFixture('voice-attempt-limit');
    const first = await repository.authorizeVoiceDispatch(
      id,
      claim.claim_token,
      route.primary.modelId,
      route.primary.provider,
      route,
    );
    expect(first.attemptNo).toBe(1);
    await repository.recordVoiceAttempt(String(first.operationId), 1, null, true);
    const filler = randomUUID();
    await pool.query(
      "insert into private.ai_usage_events(workload,model,provider,request_id,estimated_cost) select 'financial_assistant','offline-fixture','offline', $1, coalesce((select (value#>>'{}')::numeric from private.system_settings where setting_key='ai.global.monthly_budget'),200) - coalesce((select sum(estimated_cost) from private.ai_usage_events where budget_period=date_trunc('month',current_date)::date and reservation_status in ('reserved','completed','failed')),0)",
      [filler],
    );
    try {
      await expect(
        repository.authorizeVoiceDispatch(
          id,
          claim.claim_token,
          route.primary.modelId,
          route.primary.provider,
          route,
        ),
      ).rejects.toMatchObject({ response: { code: 'AI_BUDGET_EXHAUSTED' } });
    } finally {
      await pool.query('delete from private.ai_usage_events where request_id=$1', [filler]);
    }
    const second = await repository.authorizeVoiceDispatch(
      id,
      claim.claim_token,
      route.primary.modelId,
      route.primary.provider,
      route,
    );
    expect(second.attemptNo).toBe(2);
    await repository.recordVoiceAttempt(
      String(second.operationId),
      2,
      {
        usage: { inputTokens: 1, outputTokens: 2, cost: 0.000001 },
        generationId: 'fake-generation',
        latencyMs: 4,
        fallbackUsed: true,
      },
      true,
    );
    await expect(
      repository.authorizeVoiceDispatch(
        id,
        claim.claim_token,
        route.primary.modelId,
        route.primary.provider,
        route,
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_DISPATCH_LIMIT' } });
    const events = await pool.query(
      'select count(*)::integer count from private.ai_usage_events where request_id=$1',
      [first.operationId],
    );
    expect(events.rows[0]?.count).toBe(1);
    await pool.query(
      "update public.voice_sessions set lease_until=clock_timestamp()-interval '1 second' where id=$1",
      [id],
    );
    const reclaimed = (
      await repository.claimWork('voice.transcribe_extract', 'attempt-reclaim', 100, 120)
    ).find((value) => value.id === id);
    if (!reclaimed) throw new Error('missing SQL claim');
    await expect(
      repository.authorizeVoiceDispatch(
        id,
        reclaimed.claim_token,
        route.primary.modelId,
        route.primary.provider,
        route,
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_DISPATCH_LIMIT' } });
  });

  it('fences a cached request when governed route policy changes before dispatch', async () => {
    const { id, claim, route } = await dispatchFixture('voice-policy-fence');
    await pool.query(
      "update private.ai_feature_routes set version=version+1 where workload='voice_transcription'",
    );
    await expect(
      repository.authorizeVoiceDispatch(
        id,
        claim.claim_token,
        route.primary.modelId,
        route.primary.provider,
        route,
      ),
    ).rejects.toMatchObject({ response: { code: 'AI_ROUTE_POLICY_INVALID' } });
    expect(
      (
        await pool.query(
          'select count(*)::integer count from private.voice_provider_attempts where session_id=$1',
          [id],
        )
      ).rows[0]?.count,
    ).toBe(0);
  });

  it('does not redispatch or release a reservation after an unknown network outcome', async () => {
    const { id, claim, route } = await dispatchFixture('voice-attempt-unknown');
    const first = await repository.authorizeVoiceDispatch(
      id,
      claim.claim_token,
      route.primary.modelId,
      route.primary.provider,
      route,
    );
    await repository.recordVoiceAttempt(String(first.operationId), 1, null, false);
    await expect(
      repository.authorizeVoiceDispatch(
        id,
        claim.claim_token,
        route.primary.modelId,
        route.primary.provider,
        route,
      ),
    ).rejects.toThrow('AI_DISPATCH_OUTCOME_UNKNOWN');
    await pool.query(
      "update private.ai_usage_events set created_at=clock_timestamp()-interval '3 hours' where request_id=$1",
      [first.operationId],
    );
    await repository.rollup(100);
    const held = await pool.query(
      'select reservation_status from private.ai_usage_events where request_id=$1',
      [first.operationId],
    );
    expect(held.rows[0]?.reservation_status).toBe('reserved');
  });
});
