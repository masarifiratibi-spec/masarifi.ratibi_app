# Requirements crosswalk: 69 references / 88 acceptance units

Latest explicit user revision: PIN implementation accepted complete; remaining30/60-minute physical checks are an accepted testing exception, NOT passes, and do not block progress. Destructive current-ownerT04/T12 cases remain fixtures-only or actual-device-unverified.

Every original ID is preserved. This is a work mapping, not closure. Historical device states remain historical; no new journey ran. JSON retains original Arabic IDs, prior commits/outcomes and next-acceptance wording. T01 admits evidence; T22 reconciles every row.

D00 = deferred billing/payment/subscription work. E00 = accepted exception/rejected historical claim; associated tasks verify preservation, without reopening it as a defect. Reference21 subscription-renewal portion is D00; only budget dates remain active. J1 navigation and isolated calculations remain in scope; actual real-owner payment/refund execution is deferred. 4.4 retains earlier closure with final-artifact qualification separate.

| ID | Requirement | Historical implementation | Historical device state | Owning tasks |
| --- | --- | --- | --- | --- |
| 1.1 | Release signing | Partial | Not exercised on this device; No device case assigned | T21 |
| 1.2.a | Production API and Clerk binding | Open | Not exercised on this device; No device case assigned | T21 |
| 1.2.b | Production app-lock flag | Code changes recorded | Not exercised on this device; No device case assigned | T02, T21 |
| 1.2.c | Production automation/diagnostics flags | Code changes recorded | Not exercised on this device; No device case assigned | T21 |
| 1.2.d | Release version and build number | Open | Not exercised on this device; No device case assigned | T21 |
| 1.3 | R8 and resource shrinking | Code changes recorded | Not exercised on this device; No device case assigned | T20, T21 |
| 1.4 | SMS disclosure and Play declaration | Partial | Partial device coverage; D023, D024 | T15, T21 |
| 1.5 | Playback foreground permission | Code changes recorded | Not exercised on this device; No device case assigned | T21 |
| 1.6.a | Storage/overlay permission removal | Code changes recorded | Not exercised on this device; No device case assigned | T21 |
| 1.6.b | Unrelated wallet queries | Code changes recorded | Not exercised on this device; No device case assigned | T21 |
| 1.7.a | Immediate and delayed server erasure | Code changes recorded | Not exercised on this device; No device case assigned | T12 |
| 1.7.b | Deletion/provider retry safety | Code changes recorded | Not exercised on this device; No device case assigned | T12 |
| 1.7.c | Public deletion request page | Code changes recorded | Not exercised on this device; No device case assigned | T12, T21 |
| 1.8 | Public-repository privacy review | Limited inspection | Not exercised on this device; No device case assigned | T20, T21 |
| 1.9 | Integration PR and required CI | Partial | Not exercised on this device; No device case assigned | T20, T22 |
| 1.10 | Closed-testing eligibility | Open | Not exercised on this device; No device case assigned | T21 |
| 2.1 | Cached offline access and queued edits | Code changes recorded | Observed device failure; open; D018, D019, D056, D057, D058 | T03, T04 |
| 2.2 | Startup performance | Code changes recorded | Partial device coverage; D041, D058 | T02, T03 |
| 2.3 | Saudi/Gulf assistant wording | Code changes recorded | Partial device coverage; D050 | T17 |
| 2.4 | Intermittent assistant failures | Open | Partial device coverage; D047, D050, D053 | T17, T18 |
| 2.5 | Support submission safety | Code changes recorded | Partial device coverage; D017 | T10 |
| 2.6.a | Tracking activation persistence | Code changes recorded | Not exercised on this device; No device case assigned | T15, T16 |
| 2.6.b | OEM battery/settings guidance | Code changes recorded | Not exercised on this device; No device case assigned | T15, T16 |
| 2.6.c | Tracking permission lifecycle | Code changes recorded | Partial device coverage; D024 | T15, T16 |
| 2.7 | Planning journeys | Open | Observed device failure; open; D033, D035, D042 | T07 |
| 2.8 | First onboarding save | Open | Partial device coverage; D001, D002 | T07 |
| 2.9 | Opening-balance leading zero | Code changes recorded | Partial device coverage; D003, D004 | T07 |
| 2.10.a | Period presentation | Code changes recorded | Observed device failure; open; D025 | T13 |
| 2.10.b | Assistant narrative dates | Code changes recorded | Observed device failure; open; D048 | T17 |
| R4 | Malformed SMS rows | Code changes recorded | Partial device coverage; D038 | T15 |
| fix-01 | Voice database acceptance | Automated verification recorded | Not exercised on this device; No device case assigned | T05, T18 |
| R5 | Lost SQLCipher key recovery | Code changes recorded | Not exercised on this device; No device case assigned | T04 |
| R6 | AI model identity validation | Code changes recorded | Not exercised on this device; No device case assigned | T17, T18 |
| New-1 | Ambiguous bare riyal | Code changes recorded | Partial device coverage; D036 | T15 |
| J1 | Linked refunds | Code changes recorded | Observed device failure; open; D014, D015 | T06 |
| J7 | Arabic brand/greeting spelling | Code changes recorded | Partial device coverage; D010 | T13, T17 |
| J8.a | Obligation layout | Code changes recorded | Partial device coverage; D042, D055 | T13 |
| J8.b | Obligation date locale | Reviewed / preserved | Partial device coverage; D042, D055 | T13 |
| J8.c | Net-worth comparison | Code changes recorded | Blocked by unavailable reports; D016 | T05, T09, T13 |
| J8.d | Subscription capability | Deferred | DEFERRED — final phase; No device case assigned | D00 |
| 21 | Budget/subscription date presentation | Code changes recorded | Partial device coverage; D033 | T07, T13, D00 |
| 16 | Assistant timestamp locale/clock | Code changes recorded | Observed device failure; open; D049, D053, D054 | T13 |
| 20 | Period-chip clipping | Code changes recorded | Observed device failure; open; D025 | T13 |
| 26 | Budget validation and correction | Code changes recorded | Observed device failure; open; D030, D031, D033, D034, D035 | T07 |
| 24 | Category mini-bars | Code changes recorded | Blocked by unavailable reports; D016 | T09, T13 |
| 47 | Demo banks and verified sender registry | Code changes recorded | Not exercised on this device; No device case assigned | T15, T19 |
| R10 | Recent-auth step-up | Code changes recorded | Partial device coverage; D027, D028 | T04, T11, T12 |
| R11 | Route-specific AI deadlines | Reviewed / preserved | Not exercised on this device; No device case assigned | E00, T18 |
| R13 | Pinned Admin dependencies | Code changes recorded | Not exercised on this device; No device case assigned | T20 |
| R14 | Validated Node/npm toolchain | Code changes recorded | Not exercised on this device; No device case assigned | T20 |
| J9 | System theme and contrast | Code changes recorded | Observed device failure; open; D007, D008 | T13 |
| J10 | Per-currency largest expense | Code changes recorded | Partial device coverage; D047 | T05, T09, T17 |
| J11 | API formatting | Code changes recorded | Not exercised on this device; No device case assigned | T20 |
| R16 | Controlled feeMinor SQL errors | Code changes recorded | Not exercised on this device; No device case assigned | T05 |
| R17 | Unknown sync-operation rejection | Reviewed / preserved | Not exercised on this device; No device case assigned | E00, T04, T05 |
| R18 | Dedicated cursor signing key | Code changes recorded | Not exercised on this device; No device case assigned | T04 |
| R19 | Execution-time authentication age | Code changes recorded | Not exercised on this device; No device case assigned | T04 |
| R20 | Replica-aware circuit/rate semantics | Open | Not exercised on this device; No device case assigned | T17, T18, T21 |
| R21 | Recoverable Admin mock bootstrap | Code changes recorded | Not exercised on this device; No device case assigned | T20 |
| 4.1 | Arabic morphology | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 4.2 | Promotional context | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 4.3 | OTP/security context | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 4.4 | Encrypted SMS/voice payload storage | Reviewed / preserved | Not exercised on this device; No device case assigned | T15, T16, T18, T21 |
| 4.5 | Bills, requests and URLs | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 4.6 | Transaction versus balance/limit amounts | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 4.7 | Merchant suffix boundaries | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 4.8.a | Pending-notification retention | Reviewed / preserved | Not exercised on this device; No device case assigned | T16 |
| 4.8.b | Parsed policy caching | Code changes recorded | Not exercised on this device; No device case assigned | T16 |
| 4.8.c | Queue performance and compaction | Partial | Not exercised on this device; No device case assigned | T16 |
| 4.9 | Persistent escalating PIN lockout | Code changes recorded | Partial device coverage; D011, D041 | T02 |
| 4.10 | Botim/imo exclusions | Code changes recorded | Partial device coverage; D036, D037 | T15, T16 |
| 4.11 | Release deep-link allowlist | Code changes recorded | Not exercised on this device; No device case assigned | T21 |
| 4.12 | Native financial SMS pagination | Code changes recorded | Partial device coverage; D038 | T15 |
| 8.1 | Currency aliases and bare dinar | Code changes recorded | Partial device coverage; D036, D037 | T15 |
| 8.2.a | Billing/subscriptions | Deferred | DEFERRED — final phase; No device case assigned | D00 |
| 8.2.b | Reports/output/schedules/history | Code changes recorded | Observed device failure; open; D016, D052 | T08, T09 |
| 8.2.c | Support workflow | Code changes recorded | Partial device coverage; D017 | T10 |
| 8.2.d | Security event retrieval | Code changes recorded | Observed device failure; open; D012 | T06 |
| 8.2.e | Export lifecycle | Code changes recorded | Observed device failure; open; D027, D028, D029 | T11 |
| 8.3 | Localized amount input | Code changes recorded | Partial device coverage; D004, D032, D043 | T07 |
| 8.4 | Monthly financial cycle | Code changes recorded | Partial device coverage; D051 | T09 |
| 8.5 | Timezone-aware civil today | Code changes recorded | Partial device coverage; D046, D051 | T09, T13 |
| 8.6.a | Salary timezone fallback | Code changes recorded | Partial device coverage; D045, D046 | T09, T13 |
| 8.6.b | Budget timezone fallback | Code changes recorded | Not exercised on this device; No device case assigned | T09, T13 |
| 8.7 | Screenshots intentionally permitted | Reviewed / preserved | Accepted scope exception; observed screenshots allowed; D020 | E00, T21 |
| 8.8 | Production/demo entrypoint separation | Code changes recorded | Not exercised on this device; No device case assigned | T20, T21 |
| 8.9 | Sync-first logout and removal | Code changes recorded | Not exercised on this device; No device case assigned | T04 |
| 8.10 | Truthful privacy lifecycle copy | Code changes recorded | Partial device coverage; D026 | T11, T12 |

## Additional findings outside the denominator

| ID | Finding | Tasks |
| --- | --- | --- |
| N01 | Report picker coerces every selection to monthly and discards start | T09 |
| N02 | Report cache omits resolved timezone/bounds | T08 |
| N03 | Edit/composer draft lifecycle gaps require promised-scope qualification | T14 |
| N04 | Nullable source_version SQL CHECK permits UNKNOWN; bounded hardening | T05 |
| N05 | Long obligation name readability under large fonts | T13 |

Original client62 coverage is retained separately in client-62-crosswalk.md/json. No denominator is merged or used as a completion percentage.
