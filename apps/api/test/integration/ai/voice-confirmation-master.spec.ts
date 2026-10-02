import { randomUUID } from 'node:crypto';
import { AiRepository } from '../../../src/ai/ai.repository';
import { AiService } from '../../../src/ai/ai.service';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { SecurityRepository } from '../../../src/security/security.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase('Voice explicit financial confirmation', () => {
  const pool = createLivePool();
  const repository = new AiRepository(pool);
  const ledger = new LedgerService(new LedgerRepository(pool), new SecurityRepository(pool), {
    get: () => undefined,
  } as never);
  const service = new AiService(
    repository,
    {} as never,
    ledger,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const userId = 'voice_financial_' + randomUUID(),
    adminId = 'voice_financial_admin_' + randomUUID(),
    accountId = randomUUID();
  const principal = { userId, sessionId: 'local-voice-confirm', factorAgeSeconds: 0 };
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      userId,
      adminId,
    ]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      adminId,
    ]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Fictional account','bank','SAR')",
      [accountId, userId],
    );
    await pool.query(
      "update private.ai_prompt_versions set status='approved',evaluation_passed=true,approved_by=$1,published_at=clock_timestamp() where workload='voice_transcription'",
      [adminId],
    );
    await pool.query(
      "update private.ai_feature_routes set enabled=true where workload='voice_transcription'",
    );
  });
  afterAll(async () => {
    await pool.query('delete from private.ai_usage_events where user_id=$1', [userId]);
    await pool.query(
      "update private.ai_feature_routes set enabled=false where workload='voice_transcription'",
    );
    await pool.onModuleDestroy();
  });
  async function fixture() {
    const key = randomUUID();
    const created = await repository.createVoiceSession(
      principal,
      { locale: 'en', durationMs: 3000, contentType: 'audio/wav', sizeBytes: 44 },
      key,
    );
    const sessionId = String((Reflect.get(created, 'resource') as Record<string, unknown>).id);
    await repository.processVoiceSession(
      principal,
      sessionId,
      { expectedVersion: 1, contentHash: 'a'.repeat(64) },
      randomUUID(),
    );
    const claim = (
      await repository.claimWork('voice.transcribe_extract', 'financial-worker', 100, 120)
    ).find((value) => value.id === sessionId);
    if (!claim) throw new Error('missing SQL claim');
    const date = new Date(Date.now() + 180 * 60_000).toISOString().slice(0, 10);
    const editedFields = {
      amountMinor: '-1250',
      currency: 'SAR',
      categoryId: null,
      accountId,
      date,
      merchant: null,
      note: null,
    };
    const saved = await repository.saveVoiceResult(sessionId, claim.claim_token, {
      provider: 'google-vertex',
      model: 'google/gemini-3.1-flash-lite',
      transcript: 'Fictional income',
      confidence: 0.9,
      language: 'en',
      payload: { schemaVersion: 1, type: 'transaction.create', ...editedFields, confidence: 0.9 },
    });
    const body = {
      expectedVersion: Number(saved.version),
      editedFields,
      reason: null,
      occurredAt: new Date(Date.parse(date + 'T00:00:00Z') - 180 * 60_000).toISOString(),
      timezoneOffsetMinutes: -180,
    };
    return { sessionId, proposalId: String(saved.proposalId), body };
  }

  it('does not steal an active decision lease on identical retry', async () => {
    const { proposalId, body } = await fixture();
    const key = randomUUID(),
      operation = repository.operationId(principal, `ai.action.confirm:${proposalId}`, key);
    const { voiceDecision } = await import('../../../src/ai/ai.dto');
    const claim = await repository.claimVoiceAction(
      principal,
      proposalId,
      operation,
      voiceDecision(body, operation),
    );
    await expect(service.confirmVoice(principal, proposalId, body, key)).rejects.toMatchObject({
      response: { code: 'VOICE_CONFIRMATION_IN_PROGRESS' },
    });
    expect(
      (
        await pool.query(
          'select decision_token::text token from public.voice_proposals where id=$1',
          [proposalId],
        )
      ).rows[0]?.token,
    ).toBe(claim.decisionToken);
  });

  it('recovers a committed ledger receipt when Voice completion failed', async () => {
    const { sessionId, proposalId, body } = await fixture(),
      key = randomUUID();
    const completion = jest
      .spyOn(repository, 'completeVoiceAction')
      .mockRejectedValueOnce(new Error('completion unavailable'));
    const first = await service.confirmVoice(principal, proposalId, body, key);
    completion.mockRestore();
    const replay = await service.confirmVoice(principal, proposalId, body, key);
    expect(replay).toMatchObject({ resourceId: first.resourceId, status: 'executed' });
    expect(await service.getVoiceSession(principal, sessionId)).toMatchObject({
      status: 'confirmed',
    });
  });

  it('executes the actual ledger once and replays the same receipt without another balance effect', async () => {
    const { sessionId, proposalId, body } = await fixture();
    const key = randomUUID();
    const before = Number(
      (
        await pool.query(
          'select count(*)::integer count from public.transactions where user_id=$1',
          [userId],
        )
      ).rows[0]?.count,
    );
    const first = await service.confirmVoice(principal, proposalId, body, key);
    const replay = await service.confirmVoice(principal, proposalId, body, key);
    expect(replay).toMatchObject({
      resourceId: first.resourceId,
      status: 'executed',
      replayed: true,
    });
    expect(await service.getVoiceSession(principal, sessionId)).toMatchObject({
      status: 'confirmed',
    });
    const evidence = await pool.query(
      'select (select count(*)::integer from public.transactions where user_id=$1) count,confirmed_minor::text balance from public.account_balances where account_id=$2',
      [userId, accountId],
    );
    expect(evidence.rows[0]).toEqual({ count: before + 1, balance: String((before + 1) * 1250) });
    await expect(
      service.confirmVoice(
        principal,
        proposalId,
        { ...body, editedFields: { ...body.editedFields, amountMinor: '-1251' } },
        key,
      ),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } });
  });

  it('reconciles a legacy confirmed proposal from its real ledger receipt without another command', async () => {
    const { sessionId, proposalId, body } = await fixture();
    const legacyDate = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
    body.editedFields.date = legacyDate;
    body.occurredAt = legacyDate + 'T12:00:00.000Z';
    body.timezoneOffsetMinutes = 0;
    const receipt = await service.confirmVoice(principal, proposalId, body, randomUUID());
    await pool.query(
      "update public.voice_proposals set status='confirmed',executed_transaction_id=null,decision_request=null,normalized_command=null,ledger_command_key=null where id=$1",
      [proposalId],
    );
    await pool.query(
      "update public.voice_sessions set status='proposed',confirmed_at=null where id=$1",
      [sessionId],
    );
    const before = await pool.query(
      'select count(*)::integer count from public.transactions where user_id=$1',
      [userId],
    );
    expect(await service.getVoiceRecovery(principal, sessionId)).toMatchObject({
      phase: 'confirmed',
      transactionId: receipt.resourceId,
    });
    expect(
      await pool.query('select count(*)::integer count from public.transactions where user_id=$1', [
        userId,
      ]),
    ).toMatchObject({ rows: before.rows });
  });

  it('rejects an expense with no category at the SQL decision boundary before changing proposal state', async () => {
    const { proposalId, body } = await fixture();
    const operation = randomUUID();
    const { voiceDecision } = await import('../../../src/ai/ai.dto');
    const normalized = voiceDecision(body, operation);
    const expense = {
      ...normalized,
      editedFields: { ...body.editedFields, amountMinor: '1250' },
      command: { ...normalized.command, kind: 'expense' as const },
    };
    await expect(
      repository.claimVoiceAction(principal, proposalId, operation, expense),
    ).rejects.toMatchObject({ response: { code: 'AI_CATEGORY_INVALID' } });
    expect(
      (
        await pool.query(
          'select status,confirmation_operation_id from public.voice_proposals where id=$1',
          [proposalId],
        )
      ).rows[0],
    ).toEqual({ status: 'validated', confirmation_operation_id: null });
  });
});
