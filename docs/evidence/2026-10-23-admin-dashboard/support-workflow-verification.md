# Support recovery verification — Task 5

Branch: `codex/voice-promoted-operating-2026-10-13`. Main-agent implementation and author self-review only, as requested. Tasks1–4 were preserved. No agents or Astra were invoked for this task.

## Delivered behavior

- Server-filtered support tickets: subject/ID search, status, priority, assigned Admin/unassigned, category and explicit UTC creation dates. Bounded cursor pages preserve PostgreSQL timestamp precision and return an exact matching count. Admin identity projection contains a customer pseudonym and assignment reference, with no raw customer identity.
- Actual aggregate workload endpoint with its own `support.overview.read` permission. Overview-only staff can read counts and cannot retrieve ticket bodies.
- Ticket conversation with paginated messages, assignment/unassignment, priority, reply, private staff notes and resolve/close/reopen. Version conflicts keep the draft and offer refresh. Multiline content is preserved with safe text rendering.
- Admin attachment access requires ticket-detail permission, a message/attachment linkage to that ticket and a clean scan. Authorization is audited before existing short-lived Storage signing. Unsafe metadata cannot produce a download link; signed links are not persisted in client cache.
- Mobile support routes use actual service availability. Live ticket creation consumes the real owner-detail response. Replies preserve drafts on failure, can refresh the version, and are unavailable on resolved/closed tickets. Unsupported live rating and advanced campaign creation remain unavailable.
- Engagement receipts use narrow actor-bound functions and the existing owner-erased receipt store. Financial idempotency functions and the financial Admin prohibition remain unchanged.

## Verification

| Gate | Result |
| --- | --- |
| Full Admin suite | 97 files / 983 tests passed |
| API engagement, OpenAPI, integration and security | 53 suites / 179 tests passed |
| Source-fresh isolated database | 165 migrations; 9 recovery tests passed |
| Historical-upgrade isolated database | 165 migrations; 9 recovery tests passed |
| Mobile support, draft, context and live service compatibility | 8 suites / 57 tests passed |
| API/Admin/mobile TypeScript | Passed |
| Scoped lint | No errors; mobile retains existing require-import warnings in test modules |
| Migration checksums | Verified |

Tests cover the actual HTTP controller → service → PostgreSQL path with authentication mocked at the identity boundary, plus real limited database roles. They cover customer creation, Admin reply/assignment/lifecycle, owner replies, private-note exclusion, stale versions, pagination beyond25, scan/ownership download denial, receipt replay/hash conflict, UTC boundaries and overview-only permissions. Storage is mocked at its external boundary. The source-fresh gate reproduced and corrected an extension-schema permission assumption without widening grants.

Detailed RED/GREEN receipts and the author review are retained under `.superpowers/sdd/2026-10-23-admin-dashboard-recovery/task-5-*`. Final task-done receipt and commit are recorded in the ledger.

## Limits and remaining gates

Native PostgreSQL18 proves local SQL/roles/RLS behavior; it does not replace deployed Supabase17, Clerk or Storage HTTP acceptance. No hosted mutation, deployment, real provider call or phone installation was performed. Existing internal-note reads remain bounded to100. Task6 still owns navigation exposure, responsive/accessibility checks, final rebuild/RLS/build and whole-plan review. These changes have not been pushed to GitHub.
