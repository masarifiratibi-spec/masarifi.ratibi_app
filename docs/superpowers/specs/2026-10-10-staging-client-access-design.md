# Staging client access and worker recovery

The authorized outcome is normal authenticated-user acceptance on isolated Staging within two days. The user authorizes implementation and verification now; actual Staging deployment, provider activation and financial acceptance remain separate consequential approvals. Production and main are excluded.

## Design

Reuse the existing Voice contracts, extraction, owner-bound context, quota reservation, lease fencing and financial ledger. Extend the private analysis policy with an explicit audience (`owner` or `authenticated`), retaining the current audience until an approved release changes it. Both admission and analysis claims must consult that audience; active customer eligibility, authentication and owner equality remain mandatory. No owner/device is hardcoded in application code.

The existing operating financial epoch already admits eligible owners without per-user configuration. Retain its fresh-capture membership and financial kill switch. Do not disable runtime enforcement, reopen an old epoch, claim historical captures, or enable SMS/Notification automatic posting. A separately approved operating epoch and a standalone client bundle selecting contract 3 are needed for automatic Voice saving. The old failed Redmi recording remains evidence.

Use separately scoped Analysis, Voice and Assistant workers; never start the broad scheduler to recover these features. Align API and scoped workers to a tested immutable artifact. Preserve reviewed provider routes, budget/usage limits and account/category/recent-auth validation. Provider route eligibility alone is not proof of paid capacity or successful provider execution.

Add bounded exception diagnostics at runtime/closure/bootstrap boundaries. Record actual safe error names, SQLSTATE/Node/domain codes, allowlisted fixed messages and source locations, following nested causes. Never emit arbitrary exception messages, SQL, transcript, audio, credentials, owner/session identifiers or financial content. Keep fail-closed lifecycle behavior.

## Acceptance

Disposable database tests must cover two normal customer identities, inactive/admin rejection, cross-owner access, review admission/claim fencing, unchanged financial history with Posting disabled, valid Voice ledger posting and idempotent retry, and malformed/ambiguous events. Focused unit regressions precede fixes; full exact-commit CI validates migrations, security, workers, mobile and Android. Assistant and Manual Add are separate investigations with no financial/provider writes during preparation.

Release readiness requires exact source SHA and image digest, verified backups and financial baselines, queue/monitor checks, rollback instructions and human deployment approval. Physical acceptance follows approval, one phone action at a time, with Redmi and an independent identity. iOS build/signing readiness is reported separately.
