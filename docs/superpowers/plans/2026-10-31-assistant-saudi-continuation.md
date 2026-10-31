# Saudi assistant continuation implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. The user requested continuation on the existing branch; do not create another checkout.

**Goal:** Apply the handoff's neutral Saudi/Gulf conversational style across the assistant without changing financial truth or authorization.

**Architecture:** Keep the existing structured agent and fact insertion. Strengthen its existing language policy, update server-owned notices and Arabic conversational catalog values in place. No output rewriting or new dependencies.

**Tech Stack:** TypeScript, NestJS, React Native, Jest.

**Spec:** [Authorized handoff](../../handoffs/2026-10-31-new-chat-assistant-saudi-ar.md).

## Global constraints

- Same branch, Redmi, owner, APK and Metro33696; preserve2026-13 and all data.
- No ZIP, PDF resend, Feedback cycle, original-source permissions, provider-window reuse, T20–T22, merge or Production.
- Preserve financial terms, signs, dates, names, currencies, owner boundaries, fact refs, English, and confirmation/idempotency rules.
- Provider quality requires real acceptance; mocked completions only prove the dispatch contract and rendering.

## Review focus

- Egyptian financial input must reach the semantic agent with Saudi output instructions.
- Quoted merchant names and financial values must remain unchanged.
- English output must remain English.
- Failure and offline must not claim empty data or successful completion.
- Unknown action outcomes must retain the original operation and require status checking.

### Task 1: Server policy and dispatch

- [x] Add failing tests for Saudi server notices and the policy sent at the gateway boundary for Arabic/Egyptian/English input.
- [x] Update `apps/api/src/ai/assistant-domain-policy.ts` and the existing prompt in `assistant-agent.ts`; do not alter query, grounding, or action logic.
- [x] Run AI unit/contract/security tests after inspecting runners for live database effects.

### Task 2: Mobile conversational copy

- [x] Add catalog regression assertions for suggestions, failure/offline/limit/unknown states, and separate financial labels.
- [x] Update only conversational Arabic `assistant.*` values in `apps/mobile/src/localization/messages/ar.ts`; preserve all keys, interpolation, labels and English.
- [x] Run localization and assistant rendering/functional/action/live-adapter tests, typecheck and lint.

### Task 3: Runtime and remaining acceptance

- [x] Read actual container commands/images/prompt and stored routing without provider dispatch; subsequently deploy only the qualified API/public-worker language overlay under the user’s explicit continuation authorization.
- [x] Prepare a bounded, read-only acceptance proposal and affected-consumer requirements in the evidence. Runtime bindings were subsequently qualified and the specifically authorized rollout committed; provider acceptance remains prepared and unapproved.
- [x] Run existing isolated acceptance tests for remaining pre-T20 domains as appropriate; retain completed evidence and name held live criteria explicitly.
- [x] Review the diff, record verification and residual blockers, and check current GitHub HEAD checks without status-only commits. Deployment and same-device preservation are verified; provider acceptance remains incomplete.

### Task 4: Approved live continuation and filled account data

- [x] Consume the newly approved eight-question scope once; identify legacy DEV routing without claiming provider quality.
- [x] After the user's explicit follow-up, create three labeled manual test transactions on the existing two accounts across two months, and verify server confirmation/local sync without changing original financial rows or2026-13.
- [x] Correct only the DEV assistant upstream3013→3001, preserving all37 container configurations/bindings and Admin; retain rollback evidence.
- [x] Verify the ordinary DEV client reaches the existing public semantic admission path in four focused local cases.
- [x] Capture the user's separate four-question approval; stop after the first real job fails with provider HTTP401, close the window, and preserve all new-baseline projections/APK/Metro.
- [ ] Restore a valid OpenRouter credential for the same account, then qualify a new bounded acceptance. No replay under either consumed/closed scope, and no claim of successful generated Saudi output yet.
