# Project audit and outstanding decisions, 26 November 2026

Use `codex/voice-promoted-operating-2026-10-13` as the primary source for shared architecture, features, API, Admin, data and agent rules. Use `codex/google-play-release-2026-11-24` for Google Play differences and `iOS` for Apple differences.

## Release evidence

- Android source dd6dd687 matches the local build 166 review. Google Play accepted 1.0.1 (166) on the internal track. The Redmi review records an in-place upgrade with source preferences retained and Arabic/English guide checks. The installed copy was sideloaded. A fresh Play-mediated installation remains unverified. Receipts: local `Masarifi-android-166-20261124/play-internal-166.json` and `redmi/review.json`.
- Apple processed and selected 1.0.0 (27). The local TestFlight install receipt supersedes the earlier ledger checkpoint for installation. Reviewer sign-in, complete physical acceptance and public App Review submission are still unverified. Sources: iOS `docs/operations/2026-11-22-production-release-ledger.md` and the local November 22 build-27 TestFlight receipt. Keep private artifacts at their original locations.
- The Nov 19 dashboard acceptance used local simulated identities. The Nov 22 release ledger recorded qualified loopback services. Use a current authenticated production receipt before claiming public Admin operation.

## Priority findings and next verification

| Priority / affected surface | Observation and consequence | Remediation and acceptance |
|---|---|---|
| High · Android assistant privacy | iOS Gate B added originating-owner binding for delayed questions. The Play assistant screen and query path omit that argument. Compare `apps/mobile/src/features/assistant/AssistantHomeScreen.tsx` and `assistant-queries.ts` between the pins. Exposure is a source-level risk. | Port or demonstrate equivalent owner binding. Test switching owners while a request is pending with synthetic identities and verify the prior request is discarded. |
| High · savings, both platforms | `SavingsGoalDetailScreen.tsx` exposes a movement. `apps/mobile/src/features/savings/SavingsMovementForm.tsx` calls preview with goal, kind, amount and date. `apps/mobile/src/services/live/financial-planning-service.ts` requires a linked transaction ID. Ordinary contributions and withdrawals cannot reach confirmation on the live adapter. | Connect an eligible owner/currency-scoped transaction to the preview, preserving the ledger contract. Verify preview, confirm, retry and reopen against the live adapter using a disposable owner. |
| Medium · iOS access and Android tracking | An installed app does not establish reviewer account access, automatic bank ingestion, or Play installation. | Qualify each through its normal user journey and record environment, release and result. |
| Medium · release qualification | Job filters and runtime provenance checks use explicit repo/ref identities. Operating qualification and iOS native signing each check their own source. | Verify the applicable workflow, artifact SHA, build profile and environment for each release. |
| Medium · marketing | The three source trees contain a marketing placeholder README and public legal generation tools. | Obtain an independently identified release artifact before treating a marketing site as reproducible from these sources. |
