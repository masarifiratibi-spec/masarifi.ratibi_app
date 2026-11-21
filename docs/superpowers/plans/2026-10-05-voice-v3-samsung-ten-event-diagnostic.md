# Samsung ten-event nonposting diagnostic implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Preserve the existing investigation workspace and its evidence. No full-branch review repetition is required for this diagnostic-only extension; request one scoped review before live use.

**Goal:** Verify exactly ten independent events from one human Samsung recording in each language without financial persistence.

**Architecture:** Reuse the exact 452 production worker/gateway/parser/decider and existing legacy-carrier interception. Preserve the initial canonical two-call limit. An explicitly versioned capacity phase requires reviewed successful English and Arabic receipts plus cleanup/accounting, allows two additional single dispatches, and checks a cumulative four-call limit across both phases. New controls reside in `accuracy-452/ten-events`; the parent evidence is immutable and counted, never bypassed by a new namespace.

**Tech stack:** Existing Node diagnostic operators, immutable backend image, ADB, AAC/M4A strict decoding.

**Spec:** User's English goal: real Arabic/English Samsung analysis, HTTP evidence and up to ten independent events; existing `docs/handoffs/2026-10-04-voice-v3-ten-event-nonposting-validation.md` supplies capacity context. This phase remains partial-path evidence.

## Global constraints

- Exact runtime `45212149cb798a4ad2c52fb4affee2119cba6efb` and scanned image; existing five environment fingerprints, model, output cap, budget and unknown-cost reservations unchanged.
- Automatic posting OFF; zero proposals, batches, transactions, postings or raw extraction persistence. No Production, merge, ordinary scheduler start, audio retry or fallback.
- Preserve initial results, failed attempts and timestamps; exclusive per-session dispatch latch. Count both phase directories under one wrapper lock.
- One consented recording per language, duration at most 60 seconds; validate exact ownership, current references, audio decode/hash and human fixture confirmation before dispatch.
- Restore repaired APK before provider dispatch; purge/reconcile afterward. Keep user login/data. Full v3 acceptance needs a separately approved financial canary.

## Review focus

Missing/forged prerequisite receipts; moving to a directory that resets the call allowance; stale references or late captures; duplicate legitimate occurrences collapsed by comparison; ten events exceeding the unchanged token envelope. Tests must reject each admission violation; actual truncation must remain a visible failed diagnostic with accounted cost and cleanup, never a prefix success.

## Task 1: Explicit capacity admission and fixture comparison

Files: ignored investigation operators `capacity-phase-452.cjs`, `capacity-phase-452.test.cjs`, `samsung-accuracy-452.cjs`, `prepare-samsung-452.cjs`, `confirmed-capture-452.cjs`, existing wrappers and fixture attestation. No application source edits.

- [ ] Write offline regressions for initial English/Arabic prerequisite binding, cumulative four-call limit, phase-local two-call limit, distinct session identities, unknown/failed prior evidence rejection, immutable initial limit and exactly ten expected occurrences including a repeated purchase.
- [ ] Run exact-image network-disabled tests and watch new cases fail before implementation.
- [ ] Add the smallest phase guard and common expected-fixture helper. Permit purpose `ten-events` only through the reviewed capacity phase. Reuse existing accounting, fencing, storage and safe metadata boundaries.
- [ ] Run all prior tests plus new cases; verify actual wrappers and shell syntax with no network/database/provider credentials.
- [ ] Request one fresh scoped review of the diagnostic delta and resolve Critical/Important findings before live use.

## Task 2: Human capture and partial-path runtime evidence

Consumes Task 1's reviewed admission, fixture and wrapper gates.

- [ ] Preserve both original receipts and write exact-hash review metadata. Copy only owner control into the phase; obtain a fresh installed-carrier proof and references when the user is ready.
- [ ] English fixture: nine expenses and one salary, with two independent breakfast purchases. Exactly one recording and one provider dispatch. Compare all fields/occurrence counts through actual parser/decider.
- [ ] Purge and reconcile English; review its receipt before Arabic preparation. Arabic uses the equivalent ten-event fixture and the same single-dispatch/cleanup sequence.
- [ ] Restore repaired APK, verify binary hash, first installation and available Voice UI; preserve any existing failed receipt instead of clearing it.
- [ ] Report HTTP/provider tokens, elapsed times, safe field-match flags, cleanup, budget/holds and zero financial counts. Label partial-path evidence and leave the full goal incomplete.

## Exact next dependency

No new recording is requested until offline admission tests and scoped review pass. Then the sole human dependency is availability to speak the fixed English ten-event sentence on the prepared temporary carrier. Ordinary v3 recordings while policy remains OFF cannot test extraction.
