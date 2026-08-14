# T031-T032-T035-T036 Re-review

## Verdict

- Finding 1 — canonical owner execution/replay: **ADDRESSED**
- Finding 2 — dotted-ID invalidation/query wiring: **ADDRESSED**
- Spec: **PASS**
- Quality: **APPROVED**

## Verification

- `apps/mobile/src/services/mocks/assistant-notifications-service.ts:35-56,147-165` defines a typed mutating-owner callback, passes notification ID, operation ID, action, validated target, and source version, and caches the in-flight execution promise before awaiting it. Concurrent replay shares that promise; failed execution is removed for retry. View actions do not invoke the owner.
- `apps/mobile/src/services/mocks/assistant-notifications-service.test.ts:130-161` proves concurrent same-operation undo invokes the owner exactly once with the complete validated input and proves view remains read-only.
- `apps/mobile/src/features/notifications/notification-queries.ts:56-63` preserves the entire ID suffix after recognized scope prefixes, including dots.
- `apps/mobile/src/features/notifications/notification-queries.test.ts:92-162` proves dotted-ID mapping and behaviorally exercises list/filter/page, detail, derived unread count, mark-read, filtered mark-all, delete, and exact notification-scope invalidation. Existing tests retain the finance/report/support non-invalidation proof.

## Checks

- Focused service/query suites: 10/10 tests passed.
- TypeScript typecheck passed.
- No blocking new breakage found.
