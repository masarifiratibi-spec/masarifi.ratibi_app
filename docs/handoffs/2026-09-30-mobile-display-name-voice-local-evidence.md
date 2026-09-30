# Mobile display name and Voice — local implementation evidence, 2026-09-30

## Authority and status

The owner approved local steps 1–5 of the dependency-ordered plan after read-only baseline verification. This permits the code corrections, local tests, review and local commits. It does not approve Voice activation, provider/configuration changes, CI dispatch, builds, deployment, APK installation or physical testing. The final candidate SHA is recorded in the accompanying chat and Git history.

Scope remains the incorrect public account name and unavailable Staging Voice flow. Local source corrections are implemented; this report does **not** establish Staging Voice or Samsung acceptance.

Reference: [approved handoff](2026-09-30-mobile-display-name-ai-voice-handoff.md).

## Baseline verified read-only

At approximately 16:42 Asia/Riyadh:

- Git branch `codex/ratibi-staging-security`, source `150dfd6bc08a599ec90df37b4369db94ac2e252d`, upstream/queried remote equal, ahead/behind 0/0; no tracked changes. Existing untracked handoffs preserved.
- Exact-source [CI run 36715191964](https://github.com/masarifiratibi-spec/masarifi.ratibi_app/actions/runs/36715191964) completed successfully. Required jobs succeeded; signed-release evidence skipped under the existing Staging workflow contract. No workflow dispatched here.
- Retained API/Worker artifact `ghcr.io/masarifiratibi-spec/masarifi-backend@sha256:8a814a89397cd599ad7c76ac592b69e1b9c0e9086654584650ab28cd7f92f97a`; both running as `65532:65532`. API version `33e6c60611730cdf94fcf009932e3f1c368df483`; internal live/ready 200, database/queue up.
- API environment SHA256 `abdb3bec68ec0489a06e3f5eaac682bf76679f6c1730210a7c7b49cde7085bef`; Worker `968bd7f73bd3936cdd40aad8c099479df8bb40c668d27cc148d6f6bb244afb29`; both match handoff. Admin release symlink still `39a7b1bf77762d78212ed76abaa10365520abfb9`; no broader Admin audit performed.
- API AI flag unset, validated default false; Worker false. Provider-key presence verified by booleans: API absent, Worker present. No key value read or copied.
- Local and installed APK digest both `2C0752665BE3D099AFD62364BFB5F7FA6DEEE2FAB7F2483BBFCAF42E4369DE10`; Samsung install/update timestamps match 14:31:23/16:00:09. Microphone permission granted. No app navigation, launch, update, uninstall, clear-data or private-file extraction occurred.

## Source changes and regression proof

### Public identity

- More now reads the existing settings profile query. Trimmed saved name wins, then the matching authenticated Clerk owner's name, then the existing localized generic name.
- Subtitle uses masked `googleAccount` or localized generic account copy. Editable contact email and auth subject are not used as login identity copy.
- Shared header initials use the resolved public name, with no email/subject fallback. Cached profile initials are not displayed without an authenticated owner.
- Clerk name access verifies SDK owner equality. Existing full-name/first-name/last-name resolution remains.
- Profile Setup prefers a saved name over provider prefill; delayed saved data does not overwrite actively typed text, including a deliberately emptied field. Existing save/load owner guards remain.
- More's single initial uses `Array.from` so supplementary Unicode characters are not split.

Initial RED: 10 failures in 55 tests, reproducing More ID copy, saved-name priority, blank typing and incorrect-owner provider fallback. Additional signed-out header RED: 1 failure in 29 tests. Unicode initial RED: 1 failure in 20 tests; GREEN 20/20 afterward.

Existing suites now cover saved/provider/missing names, masked/generic subtitle, no internal ID in rendered/accessibility output, AR/EN, Unicode, delayed/error profiles, real query invalidation after a versioned editor save, late previous-owner results and setup typing. Existing live identity/storage/bootstrap/auth/security regressions are retained.

### Voice code

- Real restricted **local** PostgreSQL reproduced availability attempting `SET ROLE masarifi_worker`: 3 eligibility tests failed with `42501`; the direct Worker-role denial assertion passed.
- `AiRepository.workloadAvailable()` now calls the existing `private.ai_workload_available(text)` through `PoolService.query`, using the configured process role and existing function grants. Worker claim/process/route execution remains unchanged. Shared Assistant callers use the same corrected read.
- Role GREEN: 4/4 tests. Combined role/service GREEN: 11/11 tests.
- Added service checks prove false global flag or unavailable route denies creation before session, upload or financial effects. Eligible creation returns only a private upload/session response and does not call the ledger.
- Mobile preserves 401/session-expiry behavior and maps known AI denial, known Clerk-provider 503 and unknown 503 to distinct safe localized states. Error-mapping RED: 2 failures/16 tests; GREEN afterward.

The isolated role fixture uses the canonical availability-function definition and grants, with a fabricated effective-route function. It proves the privilege boundary, **not** full route-compliance SQL, published prompts, actual Staging rows, provider execution or real audio processing. Fixtures use fabricated identities/content only.

## Verification

Final local verification:

| Check | Result |
| --- | --- |
| Full Mobile serial Jest | 451 passing suites / 2,477 passing tests |
| Mobile typecheck | Pass |
| Mobile lint | Pass; 0 errors, 78 existing warnings |
| Frontend boundaries | Pass |
| API typecheck/lint | Pass |
| Full API unit/contract | Unit: 124 suites / 964 tests; contract: 79 suites / 233 tests; all pass |
| API AI checks, separate projects | 28 passing suites / 121 passing tests; 10 live-database suites / 16 tests skipped by existing infrastructure gate |
| Restricted local API-role test | 4 passing tests, real PostgreSQL 18 |
| Fresh independent source review | No Critical/Important findings |

Commands from `apps/mobile`: canonical `node ./node_modules/jest/bin/jest.js --runInBand --forceExit`; `npm.cmd run typecheck`; `npm.cmd run lint`; `npm.cmd run check:frontend-quality`.

API checks use direct serial Jest, one project per process, with a 3072 MB heap. AI projects: unit, contract, integration, security, e2e, `--testPathPatterns=ai`. Full unit/contract are also run. The role-test URL is explicitly loopback-only; normal test `DATABASE_URL` is the nonfunctional local fixture URL, never hosted.

Invalid runs were not counted as success: an initial test-only `MASARIFI_ROLE_DATABASE_URL` name was rejected by strict application configuration, so the test input was renamed `TEST_AI_ROLE_DATABASE_URL` without relaxing validation. A subsequent five-project API Jest process exhausted its default heap. Separate-project processes passed. Canonical Mobile `--forceExit` remains the established SDK open-handle workaround; no open-handle cleanup was attempted.

Docker Desktop's Linux engine remained unavailable after an ordinary hidden launch. No Docker configuration or existing PostgreSQL service credentials were changed. Full migrated Supabase DB, webhook name-preservation, budget/quota/confirmation and live recovery gates remain **unverified**, not passed through skips. They must run against an isolated canonical local Supabase stack before later release actions.

## Reproducing the restricted-role regression

The test at `apps/api/test/integration/ai/ai-availability-role.spec.ts` requires an isolated local fixture. Do not point these commands at any existing database or hosted service. Use a new temporary PostgreSQL cluster, bound only to `127.0.0.1`; preserve any directory already present.

```powershell
$roleData = 'D:/Temp/masarifi-voice-role-check'
if (Test-Path -LiteralPath $roleData) { throw 'Preserve the existing directory; choose a fresh test directory' }
& 'C:/Program Files/PostgreSQL/18/bin/initdb.exe' -D $roleData --auth=trust --username=postgres --encoding=UTF8
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D $roleData -l "$roleData/server.log" -o '-p 55432 -h 127.0.0.1' -w start
```

Run the following SQL via `psql -X -w -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1`, only on that new cluster:

```sql
create role masarifi_api nologin;
create role masarifi_worker nologin;
create role masarifi_migration nologin;
create role role_test_api login nosuperuser nocreatedb nocreaterole noinherit;
grant masarifi_api to role_test_api with inherit false, set true;
create schema private authorization masarifi_migration;
grant usage on schema private to masarifi_api;
set role masarifi_migration;
create table private.role_test_routes (workload text primary key, enabled boolean not null);
insert into private.role_test_routes values
  ('voice_transcription',true),('financial_assistant',true),('disabled_workload',false);
create function private.get_effective_ai_route(p_workload text)
returns jsonb language sql stable security definer set search_path='' as $$
  select '{}'::jsonb from private.role_test_routes where workload=p_workload and enabled;
$$;
reset role;
```

Apply the exact `create function private.ai_workload_available(p_workload text)` block, its owner assignment and PUBLIC revocation from `supabase/migrations/20260903090200_phase09_ai_functions.sql` to this fixture, then:

```sql
grant execute on function private.ai_workload_available(text) to masarifi_api;
```

From `apps/api`:

```powershell
$env:TEST_AI_ROLE_DATABASE_URL = 'postgresql://role_test_api@127.0.0.1:55432/postgres'
node --max-old-space-size=3072 ./node_modules/jest/bin/jest.js --selectProjects integration --runInBand --runTestsByPath test/integration/ai/ai-availability-role.spec.ts
```

Expected: 4 passing tests. Before the repository correction, eligibility rejects with `42501` while the direct Worker-role denial still passes. After testing, stop **this temporary cluster only** with `pg_ctl.exe -D $roleData -m fast -w stop`. No existing server role or credential needs alteration.

## Voice activation review packet — not authorized or executed

Public, unauthenticated metadata was read on 2026-09-30; no paid request or account/key inspection occurred.

- Both existing Gemini 2.5 Flash models list audio input and `structured_outputs`/`response_format` support. Public ZDR metadata lists Vertex endpoints; AI Studio endpoints are absent. Listing capabilities individually does not establish combined AAC/M4A + strict output + pinning + ZDR acceptance.
- The public provider catalog lists `Google` as slug `google-vertex`, and `Google AI Studio` as `google-ai-studio`. Historical Voice migration rows use key/allowlist `google`; do not assume that legacy value resolves to a current eligible Vertex endpoint. This is an activation risk, not the measured physical 503 cause.
- References: [audio contract](https://openrouter.ai/docs/guides/overview/multimodal/audio), [provider slug matching](https://openrouter.ai/docs/guides/routing/provider-selection), [ZDR enforcement](https://openrouter.ai/docs/guides/features/zdr), [provider catalog](https://openrouter.ai/api/v1/providers), [primary endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash/endpoints), [fallback endpoints](https://openrouter.ai/api/v1/models/google/gemini-2.5-flash-lite/endpoints), [ZDR endpoint catalog](https://openrouter.ai/api/v1/endpoints/zdr).

Proposed operational sequence, requiring a **separate concrete approval** once missing state is verified:

1. Finish canonical local DB/recovery checks; obtain current Voice route/model/prompt versions through permitted governed access. Prior denied table reads/role operations must not be retried. Request the precise authorized-human metadata/policy check if access remains unavailable.
2. Confirm the existing key is valid and its approved account/guardrail policy covers the two Voice models and a ZDR Vertex endpoint. Preserve its USD 2 total/no-reset cap and Auto Top-Up disabled. No key/account/guardrail change is authorized; if incompatible, stop and present a separate proposal.
3. If governed rows still match the historical `google` pin, propose associating the **same two Voice models** with the existing approved `google-vertex` provider and Voice allowlist `['google-vertex']`. Check all consumers of shared model rows before approval; preserve the Luna/Azure → Gemini 3.1/Vertex Assistant route and all other disabled routes. This provider association/route change has **not** been applied.
4. Through governed Admin controls only, approve/evaluate the existing Voice prompt and enable the Voice route at its verified expected version, with recent MFA, reason and idempotency. Capture exact before/after values for final approval. No direct SQL bypass.
5. Proposed nonsecret runtime delta: API `MASARIFI_AI_PROVIDER_ENABLED` unset → `true`; Worker `false` → `true`. A changed backend immutable artifact is required because this iteration changes API code. No rollout has occurred. The global flags may also expose already-enabled Assistant workloads: enumerate and explicitly review that effect; Voice approval must not silently authorize unrelated paid traffic. Keep existing configuration intact if this cannot meet approved scope.
6. Preserve ZDR, `data_collection: deny`, provider pinning, no implicit fallback, at most two governed attempts, existing quota/reservations and every spending cap. Voice's historical USD 25 route ceiling and USD 200 global ceiling do not override the tighter USD 2 key cap. Verify remaining budget before any canary; do not raise caps.
7. After release/activation/device authorization, run one safe Arabic and one safe English clip, with at most the existing primary+approved-fallback attempts each. Stop on the first failure; do not repeatedly replay paid work. Record only sanitized status/count/routing/usage/cost/latency. Cancel proposals and verify no ledger change. No real financial transaction is authorized.
8. Approved rollback: disable the Voice route through the governed control and restore captured artifact/nonsecret flag values as needed. Global flag rollback must account for other approved workloads. Do not delete rows, media history, credentials or phone data.

Current missing evidence prevents an unconditional activation-ready verdict: live governed row versions/publication, actual account policy/remaining cap, combined provider capability and canonical DB/recovery acceptance. No approval for provider/configuration changes is inferred from local code approval.

## Preservation and remaining acceptance

Auth, stable bootstrap, native callback sanitization and `/` completion, mounted root routing, fresh-connection SQLCipher keying, Android database URI handling, owner/session restoration, disabled App Lock enforcement and existing biometric/PIN/privacy safeguards remain unchanged. Full Mobile includes their retained regressions.

Exact physical callback activation remains uncaptured; the original 503 body was not retained. Successful prior `/me` and the supplied screenshots remain separate historical evidence. This iteration did not extract audio/transcripts or device private data and did not perform fresh physical acceptance.

Production, credentials, Gmail, OpenRouter configuration, hosted server data and Samsung app data remain untouched. No CI dispatch, push/merge, build, deployment, provider call, APK install, uninstall or clear-data occurred. Only the explicitly selected source/tests and this new evidence file may be committed; preserve every existing untracked handoff.
