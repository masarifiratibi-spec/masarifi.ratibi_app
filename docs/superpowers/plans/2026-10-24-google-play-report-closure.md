# Masarifi Google Play report closure

Approved specification: the user's complete closure plan in this chat, 2026-10-24.
Source: `D:/مصارفيي/Masarifi-final-report-before-Google-Play (3).pdf`, SHA-256 `3F8D8BCDD789E6A5A12C64CF3BAD8EA4B92962BD3A3E4A152175CC0077703D7D`.
Baseline: `7e3bbef0cdccc2ee5509dd332f4e32236af01b90`, branch `codex/voice-promoted-operating-2026-10-13` in `D:/Masarifi-integration-2026-10-10`.

## Binding decisions

- Main agent only; existing worktree and runtime; preserve completed dashboard recovery.
- Public repository; remove only confirmed secrets/private data. Screenshots allowed everywhere.
- Retain SMS and notification tracking; Play SMS approval is external acceptance.
- Existing owners may unlock/read/queue supported edits offline; online authentication gates synchronization and privileged operations.
- Logout syncs first; unsynced removal requires an explicit user decision.
- Billing is deferred, not resolved. Verify intended Stripe integration against Play policy before enabling purchases.
- No unchecked database resets, history rewrites, deployment, or publishing.

## Execution sequence and acceptance

| Phase | Work | Acceptance |
|---|---|---|
| P0 | Ledger, targeted privacy review, voice expectation, dependency/toolchain pins, formatting, mock recovery, CI | Relevant tests, install/build/format checks; exact failures retained |
| P1 | Offline startup, owner fences, step-up, queued auth age, cursor key, key loss, logout, delayed deletion, PIN escalation | Interrupted/retried lifecycle tests, owner isolation, actual erasure |
| P2 | Native scanned-cursor protocol, malformed rows, shared/native classification, aliases/currency evidence, notification retention/cache, sender/OEM configuration | Production regression fixtures; cursor crash/failure/tie/empty-page tests; no pending-message loss |
| P3 | User numeric input, linked refunds, financial-cycle/timezone dates, fee validation, per-currency ranking/net worth | 0/2/3 decimals, refund constraints, UTC-process zone tests, forward migration checks |
| P4 | Gulf Arabic, provider model identity, safe diagnostics, real AI acceptance | Existing 92 gateway tests plus model contracts; hosted acceptance separately |
| P5 | Support save/submit recovery, live reports/schedules, security events, export/privacy | Service-backed journeys, ownership/versioning/idempotency, real delivery gate |
| P6 | Reported UI/localization/theme defects | Focused checks and release-device RTL/large-text/theme evidence |
| P7 | Production/signing/minification/manifest/bundle, SQL candidate, device/Play acceptance, integration PR | Exact candidate evidence; preserve main-only commit; no false all-green claims |
| P8 | Billing deferred final phase | Policy/provider decision, real entitlements/purchases/restore/refunds, repeat affected gates |

## Inventory

Initial statuses: O=open, P=partial, E=awaiting external verification, U=unsupported or explicit exception, C=verified closed. Baseline denominator: 69 original references; 38 O, 20 P, 7 E, 3 U, 1 C. Repeated solutions on pp7–23 and summary tables do not increase the denominator. Grouped checks are tracked independently in execution evidence.

| Reference | PDF page | Initial | Issue |
|---|---|---|---|
| 1.1 | 1 | O | Signing |
| 1.2 | 1 | P | Production environment, lock, automation, version |
| 1.3 | 1 | O | R8/shrinking |
| 1.4 | 1 | E | SMS declaration/approval |
| 1.5 | 1 | P | Media playback FGS permission |
| 1.6 | 1 | P | Permissions and wallet queries |
| 1.7 | 2 | O | Delayed erasure and web deletion |
| 1.8 | 2 | P | Public repository private material |
| 1.9 | 2 | P | Main integration and CI |
| 1.10 | 2 | E | Closed testing |
| 2.1 | 2 | O | Offline startup/categories |
| 2.2 | 2 | P | Startup latency |
| 2.3 | 2 | O | Assistant dialect |
| 2.4 | 2 | E | Intermittent hosted assistant failure |
| 2.5 | 3 | O | Support submission |
| 2.6 | 3 | P | Tracking activation/OEM guidance |
| 2.7 | 3 | E | Hosted planning |
| 2.8 | 3 | E | First onboarding save |
| 2.9 | 3 | O | Leading zero |
| 2.10 | 3 | P | Period/assistant dates |
| R4 | 4 | O | Malformed SMS batch |
| fix-01 | 4 | E | Voice database qualification |
| R5 | 4 | O | Lost SQLCipher key |
| R6 | 4 | P | Model identity |
| جديد 1 (New-1) | 4 | P | Bare riyal |
| ج1 (J1) | 4 | O | Linked refund entry |
| ج7 (J7) | 4 | O | Arabic spelling |
| ج8 (J8) | 4 | P | Obligation layout/date, net worth, deferred subscriptions |
| 21 | 4 | O | Budget/subscription dates |
| 16 | 4 | O | Assistant time locale |
| 20 | 4 | O | Period chip |
| 26 | 4 | O | Budget validation feedback |
| 24 | 4 | P | Category mini-bars |
| 47 | 4 | P | Demo bank seeds |
| R10 | 5 | O | Recent-auth step-up |
| R11 | 5 | U | Obsolete flat three-second timeout claim |
| R13 | 5 | O | Latest dependencies |
| R14 | 5 | P | Toolchain/install |
| ج9 (J9) | 5 | O | System dark mode |
| ج10 (J10) | 5 | O | Mixed-currency ranking |
| ج11 (J11) | 5 | O | API formatting |
| R16 | 5 | O | feeMinor SQL error |
| R17 | 5 | U | Unknown sync operation already rejected |
| R18 | 5 | O | Cursor signing key |
| R19 | 5 | O | Queued auth age |
| R20 | 5 | E | Deployment circuit/rate topology |
| R21 | 5 | O | Mock startup rejection |
| 4.1 | 5–6 | O | Arabic morphology |
| 4.2 | 6 | O | Promotion substring |
| 4.3 | 6 | O | OTP context |
| 4.4 | 6 | C | Encrypted queue/journal: 35 baseline tests |
| 4.5 | 6 | P | Bills/URLs vs posted transactions |
| 4.6 | 6 | O | Credit-limit amount roles |
| 4.7 | 6 | O | Merchant suffixes |
| 4.8 | 6 | P | Notification pending retention/performance |
| 4.9 | 6 | O | PIN escalation |
| 4.10 | 6 | O | Botim/imo exclusions |
| 4.11 | 6 | O | Release development scheme |
| 4.12 | 6 | O | Native financial discovery/pagination |
| 8.1 | 25,27 | P | Currency aliases/bare dinar |
| 8.2 | 25,27–28 | P | a billing deferred; b reports; c support; d events; e export |
| 8.3 | 25,28 | O | Arabic/Persian amount inputs |
| 8.4 | 25,29 | O | Salary-cycle monthly reports |
| 8.5 | 25,29 | O | Local civil today |
| 8.6 | 25,29 | P | Timezone fallback |
| 8.7 | 25,29 | U | User expressly allows screenshots |
| 8.8 | 25,29 | P | Demo production bundle |
| 8.9 | 25,30 | O | Logout retention |
| 8.10 | 25,30 | O | Privacy lifecycle copy |

## External acceptance

Physical Android devices; production Clerk/API/AI/Storage/email accounts/configuration; verified database target and PostgreSQL compatibility; upload key and Play Console access; SMS approval/privacy/deletion/Data safety; verified sender fixtures; billing market/program decision.

Server checks from p25: net worth; refunds/transfer report totals; installment idempotency; notification contents; report email; sync conflicts; phone OTP.

Initial inherited SQL evidence: 52/64 suites passing, 12 baseline failures; do not claim all-green. Track nullable source_version CHECK separately from the report denominator.
