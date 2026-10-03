import { createHash, randomUUID } from 'node:crypto';

import { AiRepository } from '../../../src/ai/ai.repository';
import { AiWorker } from '../../../src/ai/ai.worker';
import { normalizeVertexVoiceOutput } from '../../../src/ai/voice-provider-schema';
import { createLivePool, describeLiveDatabase } from '../../live-database';

describeLiveDatabase(
  'Voice category references through context, canonical parsing and persistence',
  () => {
    const pool = createLivePool(),
      repository = new AiRepository(pool);
    const owner = `category_owner_${randomUUID()}`,
      other = `category_other_${randomUUID()}`;
    const accountId = randomUUID(),
      categoryId = '04000000-0000-4000-8000-000000000002',
      staleId = randomUUID(),
      foreignId = randomUUID();
    const bytes = Buffer.alloc(44);
    bytes.write('ftyp', 4);
    const route = {
      workload: 'voice_transcription',
      primary: { modelId: 'google/gemini-3.5-flash-lite', provider: 'google-vertex' },
      fallbacks: [],
      providerAllowlist: ['google-vertex'],
      zdrRequired: true,
      maxPrice: { prompt: '0.000001', completion: '0.000003' },
      limits: { inputTokens: 128000, outputTokens: 1200, timeoutMs: 120000 },
      prompt: { template: 'Offline reference boundary fixture', schemaVersion: 1 },
      safetyRules: [],
    };
    const config = {
      getRequired: (key: string) =>
        (
          ({
            MASARIFI_AI_PROVIDER_ENABLED: true,
            MASARIFI_AI_JOB_BATCH_SIZE: 1,
            MASARIFI_AI_MAX_CONCURRENCY: 1,
            MASARIFI_AI_LEASE_SECONDS: 120,
          }) as Record<string, unknown>
        )[key],
      get: () => undefined,
    };
    beforeAll(async () => {
      await pool.query("insert into public.profiles(id,status) values($1,'active'),($2,'active')", [
        owner,
        other,
      ]);
      await pool.query(
        "insert into public.accounts(id,user_id,name,type,currency_code) values($1,$2,'Offline cash','cash','SAR')",
        [accountId, owner],
      );
      await pool.query(
        "insert into public.categories(id,user_id,kind,label_ar,label_en) values($1,$3,'expense','اختبار','Offline stale reference'),($2,$4,'expense','خاص','Foreign category')",
        [staleId, foreignId, owner, other],
      );
    });
    afterAll(async () => {
      // Isolated database owns these UUID fixtures; preserve immutable outbox evidence.
      await pool.onModuleDestroy();
    });
    it.each(['alias', 'uuid', 'missing', 'unknown', 'swapped', 'foreign', 'stale'] as const)(
      '%s category crosses only its permitted boundaries',
      async (mode) => {
        const id = randomUUID(),
          token = randomUUID();
        await pool.query(
          `insert into public.voice_sessions(id,user_id,locale,content_type,size_bytes,content_hash,status,duration_ms,expires_at,operation_id,claim_token,claimed_by,lease_until,capture_at,capture_timezone_offset)
      values($1,$2,'en','audio/m4a',44,$4,'processing',1000,clock_timestamp()+interval '15 minutes',$5,$3,'offline-category',clock_timestamp()+interval '120 seconds',clock_timestamp(),-180)`,
          [id, owner, token, createHash('sha256').update(bytes).digest('hex'), randomUUID()],
        );
        const input = await repository.workInput('voice.transcribe_extract', id, token);
        const aliases = input.aliases as {
          alias: string;
          kind: string;
          id: string;
          data: unknown;
        }[];
        const account = aliases.find((x) => x.id === accountId),
          category = aliases.find((x) => x.id === (mode === 'stale' ? staleId : categoryId));
        expect(account?.kind).toBe('account');
        expect(category?.kind).toBe('category');
        expect(aliases.some((x) => x.id === foreignId)).toBe(false);
        if (!account || !category) throw new Error('fixture references missing');
        jest.spyOn(repository, 'claimWork').mockResolvedValue([
          {
            kind: 'voice.transcribe_extract',
            id,
            user_id: owner,
            claim_token: token,
            attempt_count: 1,
          },
        ]);
        jest.spyOn(repository, 'getRoute').mockResolvedValue(route);
        // Only inference is fake. Context, normalization, parsing, resolution and SQL save are real.
        const gateway = {
          complete: jest.fn(
            async (request: {
              userContent: { text: string }[];
              parse: (value: unknown) => unknown;
            }) => {
              const firstContent = request.userContent[0];
              if (!firstContent) throw new Error('missing worker context');
              const context = JSON.parse(firstContent.text) as {
                references: unknown[];
                capture: { referenceLocalDate: string };
              };
              expect(context.references).toContainEqual({
                alias: category.alias,
                kind: 'category',
                version: expect.any(Number) as unknown,
                data: {
                  kind: 'expense',
                  labelAr: mode === 'stale' ? 'اختبار' : 'الطعام',
                  labelEn: mode === 'stale' ? 'Offline stale reference' : 'Food',
                },
              });
              expect(JSON.stringify(context.references)).not.toContain(foreignId);
              if (mode === 'stale')
                await pool.query(
                  'update public.categories set active=false,deleted_at=clock_timestamp() where id=$1',
                  [staleId],
                );
              const selected =
                mode === 'uuid'
                  ? categoryId
                  : mode === 'missing'
                    ? ''
                    : mode === 'unknown'
                      ? 'CATEGORY-999'
                      : mode === 'swapped'
                        ? account.alias
                        : mode === 'foreign'
                          ? foreignId
                          : category.alias;
              const normalized = normalizeVertexVoiceOutput({
                outcome: 'supported',
                transcript: 'Fictional groceries fifteen riyals',
                language: 'en',
                confidence: 0.9,
                unsupportedReason: '',
                amountMinor: '1500',
                currency: 'SAR',
                accountId: account.alias,
                categoryId: selected,
                date: context.capture.referenceLocalDate,
                merchant: '',
                note: '',
                proposalConfidence: 0.9,
              });
              return {
                value: request.parse(normalized),
                provider: 'google-vertex',
                model: route.primary.modelId,
              };
            },
          ),
        };
        const worker = new AiWorker(
          repository,
          { download: () => Promise.resolve(bytes), delete: () => Promise.resolve() } as never,
          gateway as never,
          config as never,
        );
        try {
          expect(await worker.runJob('voice.transcribe_extract')).toBe(1);
        } finally {
          await worker.stop();
        }
        expect(gateway.complete).toHaveBeenCalledTimes(1);
        const proposals = await pool.query(
          'select payload from public.voice_proposals where session_id=$1',
          [id],
        );
        if (['alias', 'uuid', 'missing'].includes(mode)) {
          expect(proposals.rows).toHaveLength(1);
          expect(proposals.rows[0]?.payload).toMatchObject({
            accountId,
            categoryId: mode === 'missing' ? null : categoryId,
            amountMinor: '1500',
            currency: 'SAR',
          });
        } else {
          expect(proposals.rows).toHaveLength(0);
          expect(
            (
              await pool.query(
                'select count(*) count from public.voice_transcripts where session_id=$1',
                [id],
              )
            ).rows[0]?.count,
          ).toBe('0');
        }
        expect(
          (
            await pool.query('select count(*) count from public.transactions where user_id=$1', [
              owner,
            ])
          ).rows[0]?.count,
        ).toBe('0');
      },
    );
  },
);
