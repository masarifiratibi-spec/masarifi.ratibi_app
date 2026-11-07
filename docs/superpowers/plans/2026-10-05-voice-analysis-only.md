# Voice analysis-only Staging implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task. User already authorized autonomous nonfinancial execution; stop before the first financial canary.

**Goal:** Real Samsung English/Arabic capture completes analysis and shows unsaved results with Posting OFF.
**Architecture:** Separate admission and immutable analysis session mode; reuse capture/upload/provider/parser; no financial command creation. Scoped extraction/purge worker and explicit unsaved Mobile result section.
**Tech Stack:** NestJS, PostgreSQL private capabilities, Expo/React Native, TanStack Query.
**Spec:** `docs/superpowers/specs/2026-10-05-voice-analysis-only-design.md`.

## Global constraints

Staging only; Posting OFF; no real financial records/Production/merge. Preserve v3 10 events/60seconds/1200tokens and current provider/budget. No Review/Confirm/Save. Preserve Samsung data/login. Ten-event testing paused.

## Review focus

- Mode mismatch on replay must never convert analysis to financial execution.
- Cancellation/lease loss must prevent late publication.
- Owner changes and expired analysis must not leak previous results.
- Worker must not claim unrelated old sessions or queues.
- Audio purge must complete on terminal error/cancellation as well as success.

### 1. Database admission and terminal result

Files: new `supabase/migrations/*_voice_analysis_only.sql`; `apps/api/src/ai/ai.repository.ts`; `apps/api/test/integration/ai/voice-analysis-only.spec.ts`.
- [ ] RED: ordinary OFF rejection plus authorized nonposting admission/replay, eligible extraction returned, zero events/commands/transactions.
- [ ] Add private default-OFF owner policy, immutable context mode, bounded expiring results, fenced analysis acceptance and owner-scoped extended receipt.
- [ ] GREEN: real local PG capability/ownership/replay/cancel/expiry/financial-fence cases; regenerate migration checksums.

### 2. API selection and isolated worker

Files: API environment schema/types, `ai.service.ts`, `ai.repository.ts`, `ai.worker.ts`, `worker.ts`, focused unit tests.
- [ ] RED: Staging-only config and analysis selection; scoped extraction and purge claim no unrelated work.
- [ ] Implement default-disabled `MASARIFI_VOICE_ANALYSIS_ONLY`, restricted to exact Staging origin; select named admission capability. Worker bootstrap selects analysis-only AI loop instead of OperationsWorker.
- [ ] GREEN: config/service/worker tests and full API checks.

### 3. Mobile receipt and honest result UI

Files: `voice-batch-api-service.ts`; new `VoiceAnalysisResults.tsx`; Home/Transactions; `VoiceBatchStatus.tsx`; EN/AR catalogs; regression tests.
- [ ] RED: strict extended receipt accepted, impossible saved+analysis rejected; both screens display unsaved results without refresh.
- [ ] Add validated optional analysis receipt, bilingual unsaved results on real screens, and completed analysis status without false “Added” claim.
- [ ] GREEN: targeted and full Mobile checks, retained cache-race cases, owner/expiry scenarios.

### 4. Delivery and device verification

- [ ] Independent security/runtime review; exact-SHA full CI and immutable image.
- [ ] Deploy migration/API/isolated worker only to Staging. Verify OFF and empty financial counts; prove cancellation/purge before fresh provider audio.
- [ ] Build clean exact-SHA preview APK, verify payload/signature, install in place and independently pull/hash.
- [ ] Controlled human English, then Arabic capture; verify all boundaries, visible unsaved results on both screens, no duplicates/endless Processing, no financial writes and exact audio purge.
- [ ] Record evidence/provenance and remaining first-financial-canary boundary; no broader success claim before actual Samsung receipts.
