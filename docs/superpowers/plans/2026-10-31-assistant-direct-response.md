# Direct assistant response implementation plan

> Execute inline using superpowers:executing-plans; final independent review. Keep the existing checkout and branch.

**Goal:** A direct, question-sized answer with slightly larger inline numbers.

**Architecture:** Keep the canonical grounded text, preserve requested line breaks, tighten provider instructions and replace automatic presentation cards with inline numeric emphasis. Keep existing metadata/contracts and privacy behavior.

**Spec:** [Approved design](../specs/2026-10-31-assistant-direct-response-design.md).

**Constraints:** Same branch/Redmi/account/APK/Metro33696 and exact baseline07 records/2026-13. No financial writes, credentials/routes/quotas/schema changes, closed-provider replay, PDF/ZIP/Feedback/capture, merge or Production.

## Task 1: Direct answer and rendering

- [x] Write failing tests for canonical prose despite old card metadata, modest numeric font size, exact signed/huge/Arabic numbers, privacy and organized grounded lines.
- [x] Tighten prompt and preserve line breaks; render canonical blocks with inline number emphasis, remove automatic extra sections. Keep actions, evidence and privacy.
- [x] Run focused API/mobile tests and relevant type/lint/build checks; obtain one independent review.

## Task 2: Preserved runtime and native acceptance

- [x] Verify current runtime and phone preservation. Qualify and deploy only the assistant-agent overlay with exact original config/key and bounded rollback; keep other consumers unchanged.
- [x] Deliver mobile JavaScript through existing Metro; inspect an existing response without a new provider call. Prepare fresh limited provider acceptance only after the implementation is concrete, with no replay of01–06.
- [x] Verify question-sized generated answers under any new explicitly approved scope; otherwise record that limit accurately. Restore composer and run exact final preservation gates.

## Task 3: Publication

- [x] Record evidence/update handoff, commit and push the same branch, verify remote/current HEAD checks and report the actual result.
