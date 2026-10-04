# Voice v3 ten-event non-posting validation — 2026-10-04

This continuation starts at frozen `397677423b9336722bc9af2405f1a5b1d7b3a623` on `codex/voice-auto-batches`. The latest user instruction authorizes controlled non-posting Gemini/Vertex tests and the minimum ten-event changes after evidence. It supersedes the earlier stop-before-provider protocol. Automatic financial posting, the first real financial v3 canary, Production and final branch integration remain prohibited.

## Real provider evidence

Nine single-dispatch shadow operations used normal authenticated contract-v2 create/upload/process, the normal reservation and fenced Worker capability, and the frozen candidate gateway. They did not invoke batch acceptance, proposal persistence, financial APIs or finalization. The ordinary Staging Worker was stopped during each probe and restored after cancellation and financial checks; the accepted API/image/onboarding were not deployed or changed.

Fictional speech was synthesized locally, encoded as mono AAC M4A, and processed over the accepted `google/gemini-3.5-flash-lite` / `google-vertex/global` route. No fallback, temperature override, token increase, quota increase or budget increase was used. Provider metadata calls the pinned Vertex endpoint **Google**; the outgoing provider allowlist was checked explicitly. ZDR and data collection denial remained mandatory. Raw extraction/transcripts were not saved. Fixture hashes, envelope/output fingerprints, safe field agreement flags and accounted usage are retained separately from customer data.

| Probe | Output tokens | Latency ms | Actual USD | Result |
| --- | ---: | ---: | ---: | --- |
| English original flat ten | 1,184 | 5,281 | 0.0035609 | `length`; whole response rejected |
| Arabic original flat ten | 1,183 | 4,538 | 0.0036391 | `length`; whole response rejected |
| English twelve compact fields | 1,185 | 4,800 | 0.0036213 | `length`; whole response rejected |
| English nine fields, initial speech | 1,012 | 3,641 | 0.0031828 | Ten items; amount agreement failed |
| Arabic nine fields, undiacritized speech | 853 | 6,896 | 0.0028660 | Ten items; amount/account agreement failed |
| English nine fields, explicit minor-unit instruction | 1,012 | 4,483 | 0.0032191 | Nine exact items; one amount disagreement |
| Arabic nine fields, explicit minor-unit instruction | 1,006 | 3,366 | 0.0032848 | Amount/account disagreements; not accepted as proof |
| English clearer speech, same nine-field contract | 1,012 | 3,615 | 0.0033589 | Complete ten; all financial checks pass |
| Arabic diacritized speech, same nine-field contract | 1,045 | 4,787 | 0.0034777 | Complete ten; all financial checks pass |

The clearer recordings are 41.814 seconds English and 46.695 seconds Arabic. Every expected occurrence remained separate, including nine expenses and one income. The checks compared amount, kind, account, category, SAR and capture-local date. The fixture comparison itself was verified offline against the frozen image. Earlier failures remain evidence, not successful acceptance runs. Synthetic speech is capacity evidence; human Samsung speech/noise acceptance remains required. The final exact candidate must repeat bilingual non-posting checks, including explicit language agreement, using its own adapter and image.

All nine provider receipts are durably accounted: **USD 0.0302106 total**. The initial USD 1.1844 reservations reconciled to actual receipts through the established accounting function. Four pre-existing unknown-cost reservations remain held at USD 0.5264. Read-only Staging inspection afterward found zero transactions, zero postings, zero transaction revisions and zero pending Voice work. Full financial row fingerprints matched within each probe. Normal Worker balance reconciliation changed row timestamps between some probes; this was not a financial addition, and must not be presented as a globally unchanged timestamp snapshot across the entire day.

## Capacity decision and minimum change

The existing thirteen-field representation does not safely deliver ten under 1,200 tokens. Short names alone were also insufficient. The nine-field basic representation preserves kind, signed minor-unit amount, currency/account/date evidence, taxonomy reference, merchant, independence and confidence. Currency/account/date each encode a deterministic source prefix with their value. The always-empty note is reconstructed locally. The adapter expands those fields into the unchanged canonical representation before existing per-item validation. No skipped content is persisted.

Ten is implemented across the canonical envelope bound, database ordinals and accepted decision count, OpenAPI and Mobile receipt counts. `20261004093000_voice_ten_event_capacity.sql` is additive; the frozen migration is not edited. The policy stays disabled. Eligible command execution, locks, receipts, posting, recovery, privacy and owner/RBAC are unchanged. V3 reference descriptors now include an owner-scoped account name and enabled-currency minor unit so the provider can resolve explicit named accounts and scale major units. Existing privacy filtering redacts sensitive account-label patterns before provider serialization; instruction-like labels are omitted. Request-body regressions exercise both cases. V2 descriptors remain unchanged.

Current clear-fixture headroom is 188 / 155 output tokens. This is measured support for ten, not a guarantee that every permitted merchant string or speech interpretation fits. Oversized, truncated, refused or incomplete responses fail the entire extraction, never post a prefix or masquerade as a successful zero-result batch. Overflow and bounded-field stress are explicit acceptance gates. There is no array slicing or deduplication by financial value.

The unchanged worst-case reservation remains USD 0.1316 per recording: 128,000 × USD 0.000001 prompt ceiling + 1,200 × USD 0.000003 output ceiling. Compact encoding adds **zero** reservation, price-ceiling, retry or monthly-budget increase. Public Vertex global pricing observed October 4 was USD 0.0000003 input / USD 0.0000025 output per token. An unused 1,800-token alternative would add USD 0.0018 to the reservation ceiling, approximately 1.37%; it was not implemented or configured. [Provider endpoint catalogue](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints).

## Software validation and retained boundaries

Failing regressions first reproduced the five-event rejection and missing v3 account-name/minor-unit descriptors. With the additive change, five fresh full-migration isolated PostgreSQL 18 Voice suites passed **51 tests**, including 23 batch ledger tests. They prove all ten valid items; eight valid plus two skipped; concurrent duplicate posting; exact balance deltas; no skipped financial commands; reference ownership; unchanged v2 descriptors; cancellation, recovery and atomic rollback. Official disposable Supabase/PostgreSQL 17 exact-SHA CI remains the release authority. The local PostgreSQL scaffold is not hosted Supabase acceptance.

Four API gateway/extraction/contract suites passed **78 tests**. The Mobile batch API suite passed **11 tests**, including all ten receipt IDs without review. API/Mobile typechecks, changed-code lint, migration checksums and the candidate build are required before freezing the next SHA. Independent delta review and full exact-SHA CI, including k6/image/browser/database gates, are recorded outside the candidate commit.

The inherited Mobile security exposure assessment is in [the dedicated report](2026-10-04-mobile-dependency-exposure.md). A reachable inherited moderate decoder availability issue remains a public-release risk; a green Voice CI is not a clean dependency audit.

Samsung SM-A165F is connected. This change leaves the already-green recorder/handoff implementation intact. Physical Ready timing remains unmeasured: measure native prepare separately and require Ready within 250 ms after native release plus durable journal handoff while previous work is still processing. No sleep or provider/server cleanup dependency is introduced.

## Remaining acceptance boundary

Do not enable `private.voice_automatic_policy` or run a financial v3 capture during this continuation. Use the exact new SHA/image for final non-posting bilingual and overflow gates. After its migration and accounting/security checks, propose the bounded financial protocol in [the Staging acceptance document](2026-10-04-voice-v3-staging-acceptance.md). The next user approval must explicitly cover enabling automatic financial posting and the first real financial canary. Production and final integration remain outside scope.
