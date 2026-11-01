# Customer administration recovery — local verification

Task4 is implemented at `f669ce3a` plus self-review fixes `6740b8fc`, on `codex/voice-promoted-operating-2026-10-13`.
The main agent performed all implementation, testing and review, following the user's instruction to stop delegation. This is author self-review, not an independent review. Tasks1–3 were preserved.

## Delivered behavior

- Eight live customer list/detail/device/session/lifecycle endpoints with canonical permissions and recent primary login on mutations.
- Masked contacts, real lifecycle and device counts, web/no-device support, nullable unknown diagnostics and financial aggregates. Multi-platform customers have no invented primary platform.
- Atomic local suspension, audit and durable revocation request. Only suspended customers can reactivate; Admin and deleted accounts use their existing protected lifecycle.
- Worker-only provider execution with retry, original session snapshots, opaque target-specific public session references and truthful pending/failed/completed state. API-only database connections do not assume the worker role.
- Device revocation removes push access and retains the original session target even if the device is registered again. An older command cannot clear a later session link.
- Strict customer read boundary excludes Admin targets. Detail wire projections match the client contract. Historical session counts remain null because the provider list covers active sessions only.
- Unsupported manual verification, bulk actions, export and unmeasured filters are disabled. Live suspension remains until manual reactivation.
- Customer command payloads are removed during the existing account-erasure workflow; existing immutable audit policy remains intact.

## Verification

| Gate | Result |
|---|---|
| Full Admin, direct Node/single worker | 96 files, 978 tests passed |
| Focused API unit/contract/integration/security gate | 19 suites, 106 tests passed; 5 legacy local-database tests skipped |
| Actual-source fresh database | 162 migrations, 10/10 recovery tests passed |
| Historical-upgrade database | 162 migrations, 10/10 recovery tests passed |
| API/Admin TypeScript | Passed |
| Changed-file lint and migration checksums | Passed |

The live recovery suite includes actual HTTP→service→SQL projections, an API-only database session, permission and recent-login rejection, bounded pages beyond25, replay/mismatch, suspension authority, deleted/Admin safeguards, provider failure/retry, device re-registration, push revocation and erasure cleanup. Clerk is mocked at the external boundary; persistence is real PostgreSQL18 on the owned isolated cluster. No hosted/provider/customer/phone mutation or deployment was performed.

Meaningful RED/GREEN receipts and complete reports remain in the preserved ignored plan workspace `.superpowers/sdd/2026-10-23-admin-dashboard-recovery/`. Raw provider identifiers and secrets are not published in this report.

## Limits and remaining plan work

Native PostgreSQL18 and mocked Clerk do not establish target Supabase17, real-provider, physical-device or deployed-browser acceptance. A legacy privacy suite requires its own named disposable database and was not pointed at an unintended database or bypassed. Provider sessions/devices have explicit bounded adapter limits. Sessions with ambiguous command-boundary millisecond timestamps are conservatively excluded from an older revocation command; no external exactly-once guarantee is claimed.

Tasks5–6 and final whole-plan integration remain outstanding. Task6 also reconciles confirmation/audit display labels with the actual new `customer.*` audit actions.
