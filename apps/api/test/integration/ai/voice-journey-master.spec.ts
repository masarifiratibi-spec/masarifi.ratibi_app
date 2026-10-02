import { randomUUID, createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import { AiRepository } from '../../../src/ai/ai.repository';
import { AiService } from '../../../src/ai/ai.service';
import { AiWorker } from '../../../src/ai/ai.worker';
import { AiGateway } from '../../../src/ai/ai.gateway';
import { LedgerService } from '../../../src/ledger/ledger.service';
import { LedgerRepository } from '../../../src/ledger/ledger.repository';
import { SecurityRepository } from '../../../src/security/security.repository';
import { createLivePool, describeLiveDatabase } from '../../live-database';
import {
  sessionSchema,
  uploadResponseSchema,
  uploadReceiptSchema,
  recoverySchema,
  executedActionSchema,
} from '../../../../mobile/src/services/live/voice-api-contract';

describeLiveDatabase('Voice offline journey through real boundaries', () => {
  const pool = createLivePool(),
    repository = new AiRepository(pool);
  const userId = 'voice_journey_' + randomUUID(),
    adminId = 'voice_journey_admin_' + randomUUID(),
    accountId = randomUUID(),
    categoryId = randomUUID();
  const principal = { userId, sessionId: 'fictional-offline-session', factorAgeSeconds: 0 };
  const media = new Map<string, Buffer>();
  const storage = {
    upload: (key: string, bytes: Buffer) => {
      media.set(key, bytes);
      return Promise.resolve();
    },
    download: (key: string) => {
      const bytes = media.get(key);
      if (!bytes) return Promise.reject(new Error('missing fixture'));
      return Promise.resolve(bytes);
    },
    delete: (key: string) => {
      media.delete(key);
      return Promise.resolve();
    },
  };
  const config = {
    getRequired: (name: string) =>
      (
        ({
          MASARIFI_AI_PROVIDER_ENABLED: true,
          MASARIFI_AI_SIGNED_UPLOAD_SECONDS: 300,
          MASARIFI_REQUEST_TIMEOUT_MS: 30_000,
          MASARIFI_AI_JOB_BATCH_SIZE: 4,
          MASARIFI_AI_MAX_CONCURRENCY: 4,
          MASARIFI_AI_LEASE_SECONDS: 120,
        }) as Record<string, unknown>
      )[name],
    get: () => undefined,
  };
  const ledger = new LedgerService(new LedgerRepository(pool), new SecurityRepository(pool), {
    get: () => undefined,
  } as never);
  const service = new AiService(
    repository,
    storage as never,
    ledger,
    {} as never,
    {} as never,
    {} as never,
    config as never,
  );
  beforeAll(async () => {
    await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
      userId,
      adminId,
    ]);
    await pool.query("insert into public.admin_profiles(user_id,status) values($1,'active')", [
      adminId,
    ]);
    await pool.query(
      "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Fictional journey account','bank','SAR')",
      [accountId, userId],
    );
    await pool.query(
      "insert into public.categories(id,user_id,kind,label_ar,label_en) values($1,$2,'expense','تجريبي','Fictional expense')",
      [categoryId, userId],
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
    await pool.query(
      "update private.ai_feature_routes set enabled=false where workload='voice_transcription'",
    );
    await pool.onModuleDestroy();
  });
  it.each([
    { language: 'ar', cancel: true },
    { language: 'ar', cancel: false },
    { language: 'en', cancel: false },
  ] as const)(
    '$language capture/upload/Worker/gateway/review (cancel=$cancel)',
    async ({ language, cancel }) => {
      const bytes = Buffer.alloc(44);
      bytes.write('ftyp', 4);
      bytes.write('M4A ', 8);
      const hash = createHash('sha256').update(bytes).digest('hex');
      const recordedAt = new Date().toISOString(),
        date = new Date(Date.now() + 180 * 60_000).toISOString().slice(0, 10);
      const created = uploadResponseSchema.parse(
        JSON.parse(
          JSON.stringify(
            await service.createVoiceSession(
              principal,
              {
                locale: language,
                durationMs: 3000,
                contentType: 'audio/m4a',
                sizeBytes: bytes.length,
                contentHash: hash,
                recordedAt,
                timezoneOffsetMinutes: -180,
              },
              randomUUID(),
            ),
          ),
        ),
      );
      const request = Object.assign(Readable.from([bytes]), {
        headers: { 'content-type': 'audio/m4a', 'content-length': String(bytes.length) },
      }) as unknown as Request;
      const uploaded = uploadReceiptSchema.parse(
        await service.uploadVoiceAudio(principal, created.session.id, request),
      );
      await service.processVoiceSession(
        principal,
        created.session.id,
        { uploadCompleted: true, expectedVersion: uploaded.version, contentHash: hash },
        randomUUID(),
      );
      // Select this test's actual SQL claim; other test fixtures share the isolated database.
      const originalClaim = repository.claimWork.bind(repository);
      jest
        .spyOn(repository, 'claimWork')
        .mockImplementation(async (kind, worker, _limit, lease) =>
          (await originalClaim(kind, worker, 100, lease)).filter(
            (item) => item.id === created.session.id,
          ),
        );
      const fetcher = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('expected JSON request');
        const body = JSON.parse(init.body) as {
          model: string;
          provider: unknown;
          response_format: unknown;
          max_tokens: number;
          messages: { content: { text: string }[] }[];
        };
        const route = await repository.getRoute('voice_transcription');
        if (!route) throw new Error('missing governed route');
        expect(body.model).toBe(route.primary.modelId);
        expect(body.provider).toMatchObject({
          only: [route.primary.provider],
          allow_fallbacks: false,
          require_parameters: true,
          zdr: true,
          data_collection: 'deny',
        });
        expect(body.response_format).toMatchObject({
          type: 'json_schema',
          json_schema: { strict: true },
        });
        expect(body.max_tokens).toBe(route.limits.outputTokens);
        const content = body.messages[1]?.content;
        if (!content?.[0]) throw new Error('missing multimodal context');
        expect(content[1]).toEqual({
          type: 'input_audio',
          input_audio: { data: bytes.toString('base64'), format: 'm4a' },
        });
        expect((JSON.parse(content[0].text) as { capture: unknown }).capture).toMatchObject({
          recordedAt,
          timezoneOffsetMinutes: -180,
          referenceLocalDate: date,
          legacyContext: false,
        });
        const context = JSON.parse(content[0].text) as {
          references: { alias: string; kind: string; data: { kind?: string } }[];
        };
        const category = context.references.find(
          (reference) => reference.kind === 'category' && reference.data.kind === 'expense',
        );
        if (!category) throw new Error('missing expense category alias');
        const output = {
          schemaVersion: 1,
          outcome: 'supported',
          language,
          confidence: 0.9,
          transcript:
            language === 'ar'
              ? 'مصروف تجريبي خمسة وعشرون ريالاً'
              : 'Fictional income twenty five riyals',
          proposal: {
            schemaVersion: 1,
            type: 'transaction.create',
            amountMinor: language === 'ar' ? '2500' : '-2500',
            currency: 'SAR',
            accountId: 'ACCOUNT-1',
            categoryId: language === 'ar' ? category.alias : null,
            date,
            merchant: null,
            note: null,
            confidence: 0.9,
          },
        };
        return new Response(
          JSON.stringify({
            id: 'offline-generation-' + randomUUID(),
            model: body.model,
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }],
            usage: { prompt_tokens: 100, completion_tokens: 100, cost: 0.000001 },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      });
      await new AiWorker(
        repository,
        storage as never,
        new AiGateway({ apiKey: 'offline-fixture', fetcher }),
        config as never,
      ).runJob('voice.transcribe_extract');
      const upstreamResults: PromiseSettledResult<Response>[] = await Promise.allSettled(
        fetcher.mock.results.map((result) => result.value as Promise<Response>),
      );
      expect(upstreamResults).toEqual([
        { status: 'fulfilled', value: expect.any(Response) as unknown },
      ]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      sessionSchema.parse(
        JSON.parse(JSON.stringify(await service.getVoiceSession(principal, created.session.id))),
      );
      const review = recoverySchema.parse(
        JSON.parse(JSON.stringify(await service.getVoiceRecovery(principal, created.session.id))),
      );
      expect(review).toMatchObject({ phase: 'proposed', transcriptLanguage: language });
      expect(review.proposal?.fields.every((field) => field.confidence === null)).toBe(true);
      expect(media.size).toBe(0);
      if (cancel) {
        await service.cancelVoiceSession(principal, created.session.id, randomUUID());
        expect(await service.getVoiceRecovery(principal, created.session.id)).toMatchObject({
          phase: 'cancelled',
          transactionId: null,
        });
        expect(
          (
            await pool.query(
              'select count(*)::integer count from public.transactions where user_id=$1',
              [userId],
            )
          ).rows[0]?.count,
        ).toBe(0);
      } else {
        const proposal = review.proposal;
        if (!proposal) throw new Error('expected review proposal');
        const previousBalance = await pool.query(
          'select confirmed_minor::text balance from public.account_balances where account_id=$1',
          [accountId],
        );
        const body = {
          expectedVersion: proposal.version,
          editedFields: {
            amountMinor: language === 'ar' ? '2500' : '-2500',
            currency: 'SAR',
            accountId,
            categoryId: language === 'ar' ? categoryId : null,
            date,
            merchant: null,
            note: language === 'ar' ? 'Reviewed fictional expense' : 'Reviewed fictional income',
          },
          occurredAt: new Date(Date.parse(date + 'T00:00:00Z') - 180 * 60_000).toISOString(),
          timezoneOffsetMinutes: -180,
          reason: null,
        };
        const key = randomUUID();
        const receipt = executedActionSchema.parse(
          await service.confirmVoice(principal, proposal.id, body, key),
        );
        expect(await service.confirmVoice(principal, proposal.id, body, key)).toMatchObject({
          resourceId: receipt.resourceId,
          replayed: true,
        });
        expect(
          (
            await pool.query(
              'select confirmed_minor::text balance from public.account_balances where account_id=$1',
              [accountId],
            )
          ).rows[0]?.balance,
        ).toBe(
          String(
            Number(previousBalance.rows[0]?.balance ?? 0) + (language === 'ar' ? -2500 : 2500),
          ),
        );
        expect(await service.getVoiceRecovery(principal, created.session.id)).toMatchObject({
          phase: 'confirmed',
          transactionId: receipt.resourceId,
        });
      }
      const accounting = await pool.query(
        'select count(*)::integer count from private.ai_usage_events where user_id=$1 and request_id in(select process_operation_id::text from public.voice_sessions where id=$2)',
        [userId, created.session.id],
      );
      expect(accounting.rows[0]?.count).toBe(1);
    },
  );
});
