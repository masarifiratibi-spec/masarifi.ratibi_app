# SMS Tracking Classification Implementation Plan

**Goal:** Improve deterministic Arabic/English SMS transaction classification, preserve keyword customization, and release the verified exact SHA to Staging with a fresh signed APK.

**Scope:** Reuse the existing local parser, keyword-rule model, live API, and migration/deployment paths. No AI classification, UI redesign, credential rotation, Production change, or destructive device action.

## Task 1: Lock classification behavior with sanitized tests

**Files:**
- Modify: `apps/mobile/src/features/tracking/sms-import.test.ts`

1. Add table-driven fixtures for English/Arabic purchase and debit, credit/deposit, directional transfers, ATM withdrawal, fees, mixed/abbreviated messages, and capitalization/punctuation.
2. Add exclusion fixtures for failed, declined, rejected, cancelled, unsuccessful, PIN-attempt, and balance-only messages.
3. Add keyword-control fixtures proving disabled defaults and enabled custom keywords are respected.
4. Run the focused Jest file and confirm the new assertions fail for the intended missing behavior.

## Task 2: Implement the minimum parser/default-library change

**Files:**
- Modify: `apps/mobile/src/features/tracking/sms-import.ts`
- Modify: `apps/mobile/src/services/mocks/default-keywords.ts`
- Modify: `apps/mobile/src/services/mocks/default-keywords.test.ts`

1. Give negative/exclusion patterns precedence over positive transaction patterns.
2. Extend conservative normalized Arabic/English patterns for the proved fixture corpus, including directional transfers and fees.
3. Expand the existing grouped default keyword library with stable default IDs; do not introduce a new rule engine or dependency.
4. Keep context-only balance wording non-triggering and retain redaction/fingerprint/account-selection behavior.
5. Run focused tests to green.

## Task 3: Preserve defaults and custom rules across restore/sync

**Files:**
- Modify: `apps/mobile/src/services/mocks/automatic-tracking-service.test.ts`
- Modify: `apps/mobile/src/services/mocks/automatic-tracking-service.ts`
- Add: `supabase/migrations/20260929090000_expand_tracking_keyword_defaults.sql`
- Modify: `supabase/tests/035_tracking_commands.test.sql`

1. Add a failing mock-service test proving restore replaces default-origin rules with current defaults while retaining custom rules.
2. Implement the minimal origin-aware merge for local/mock restore.
3. Add a forward-only database migration replacing the Staging restore function with the expanded bilingual defaults while retaining custom rows.
4. Update pgTAP expectations and verify migration/RLS/API contracts remain unchanged.

## Task 4: Run local release gates and review

1. Run focused SMS/default/restore Jest tests.
2. Run the complete mobile tests, typecheck, lint, runtime/config checks, and relevant backend/database migration tests.
3. Review privacy/redaction, duplicate/idempotency, keyword UI behavior, and the final diff for unrelated changes.
4. Commit only implementation/plan files, preserving `docs/handoffs/` untouched.

## Task 5: Exact-SHA Staging release

1. Push the existing Staging branch and wait for required exact-SHA CI/security/database/mobile gates.
2. Publish/use only the immutable backend artifact for that green SHA.
3. Retain the current rollback point, run the forward migration job, deploy API/worker/Admin as required by the existing Staging process, and verify health/readiness, TLS/CORS, queue, and tracking APIs.
4. Do not touch Production, Gmail SMTP, OpenRouter, or unrelated credentials.

## Task 6: APK and device verification

1. Build a new EAS preview/internal Staging APK from the final exact SHA and verify public runtime variables, package, version, architecture, signer, and SHA-256.
2. If needed, build a separately labelled signer-compatible device APK; verify signer compatibility before an in-place install and preserve app data.
3. Revisit the staged Clerk Native API switch. If approval is still absent, stop at the prepared Save action for explicit owner approval.
4. After authentication initializes, run the safe Staging mobile E2E matrix, including SMS keyword customization/persistence and sanitized classification cases, and report every pass/fail/blocker without overstating readiness.
