# T062-T067 review handoff

Scope:
- `apps/mobile/src/features/assistant/assistant-queries.test.ts`
- `apps/mobile/src/features/assistant/assistant-queries.ts`
- `apps/mobile/src/services/mocks/assistant-service.ts`

Implemented/fixed:
- Assistant query keys cover consent, conversation list filters, conversation detail pages, immutable response detail, and current context.
- Cursorless conversation detail key is a prefix (`['assistant','conversation',id]`) so invalidation catches cursor pages.
- Removed action-preview key from this slice; that belongs to T080.
- Added `useAssistantResponse()` backed by `assistantService.getResponse()` so immutable response keys are populated by a real hook.
- Query inputs use a named `AssistantConversationQuery` type instead of `Record<string, unknown>`.
- Mutations wire consent, ask, rename, delete, and feedback to the service with expected versions and operation IDs.
- Invalidation uses normal TanStack refetch behavior for active live queries; tests prove active conversation query refetches after mutation.
- Immutable response keys remain untouched by live invalidation.

Fresh verification:
- `npx jest --runInBand src/features/assistant/assistant-queries.test.ts src/features/assistant/assistant-context.test.ts src/services/mocks/assistant-service.test.ts` - PASS, 9/9.
- `npm run typecheck` - PASS.
