# Customer 104: physical core and Tracking acceptance

The primary Redmi application was updated in place and tested on Android owner user 0. Customer 104 uses the existing Production signing key and retains the original application ID, first-install time, saved owner session, and original accounts. The installed and delivered APK SHA-256 is `4636466ad136f655ad747701d3c7b3dc2f5379a6a652efac8da7491d488b5b66` (49,503,110 bytes). Hermes SHA-256 is `831e925ad21dc370525ce46fd01f048a78d3945d69890aaf5a8e6a3f83c00c8d`.

Application source is commit `ed0ab5e1a63a12676c945de57f926469038dc9a0`. The APK was built from base `790fd6a07ab3fada76e7086d12f2b2d799d0c3a8` plus the five individually pinned changes committed in that source commit. Git normalizes only the Proguard file's CRLF line endings; the exact built raw inputs and index qualification are retained privately. No new build or installation followed the user's subsequent instruction to continue on the installed release 104.

## Corrections and verification

The original Tracking startup failure was reproduced in release 101's actual DEX: R8 made Expo's background notification consumer abstract and removed the constructor used by TaskService reflection. A narrow keep rule preserves that class and constructor. Actual release 103 and 104 DEX checks pass; physical task registration and ordinary consent activation now succeed.

Production save confirmation previously returned before native presentation because its origin guard admitted only Staging. The correction admits the two exact approved origins and retains the owned, posted, automatic, synced ledger checks and native owner-generation lease. A fresh identity is reused only inside one consent command's scope for at most 15 seconds, with owner and SDK session checks before and after every request. New or expired scopes still acquire a fresh identity.

The correction passed 97 focused tests across three suites, TypeScript, scoped lint and formatting. The focused independent review found no Critical or Important issue. Existing 611-suite/4,889-test and 88-native-test evidence for unchanged inputs was reused. It is not represented as a new whole-suite run for release 104. Static APK signatures pass at APIs 24, 28, 32, 33, 35 and 36; Arabic identity, disabled backup, non-debuggable configuration, Production bindings, absence of QA code, record reflection, and 16 KB ZIP/ELF alignment pass.

## Actual device journeys

The saved owner session reached Home after the normal updates through bridge 100, final 101, correction 103 and correction 104. Ordinary account creation, expense entry, editing and refund were proved through the phone UI and bounded hosted reads. No primary clear, uninstall, logout, identity override or downgrade was used.

An ordinary OS notification on release 104 produced one accepted `-243` minor-unit SAR posting on the existing synthetic account, one accepted history entry and one confirmation event. Android displayed the native V4 confirmation, titled `دفع · 2.43 SAR`. A first malformed test command delivered only `Paid` because its ADB shell argument was unquoted; it created no financial import. That harness failure is retained. The corrected full-text fixture was a distinct, explicitly identified notification.

The user then sent a real carrier SMS from another phone, after SMS consent was enabled. Its exact synthetic reference matched the owned import. The real native SMS path produced one accepted `-257` minor-unit SAR posting, one accepted history entry and one confirmation event. The hosted session completed on its first attempt. Android displayed `دفع · 2.57 SAR`. The notification source was off during this SMS test, so the SMS journey did not rely on capturing the messaging application's notification.

The SMS provider's receive timestamp was 12:00:07.217 UTC. The import completed at 12:00:18.275 UTC, approximately 11.06 seconds later. Android created the confirmation at 12:00:24.216 UTC, approximately 17.00 seconds after receipt. This is working end-to-end behavior, with a remaining latency issue.

Both synthetic automatic expenses were refunded through the ordinary owner UI. The retained synthetic account has eight transactions and a net posting sum of zero. Original account balances remain unchanged; the original cash account is restored as default. Both sources are off and hosted installation authority is revoked, matching the pre-test preference. The fixture and all audit records remain retained.

## Response measurements and remaining work

USB XML observations include several seconds of accessibility capture overhead and are completion bounds, not isolated request durations or stable benchmark estimates.

| Action | Release 103 completion observation | Release 104 completion observation |
| --- | ---: | ---: |
| SMS off | 13.4 s | 10.1 s; later 9.9 s |
| Notifications on | 17.4 s | 15.7 s; later 12.8 s |
| Notifications off | 12.5 s | 8.6 s; later 10.7 s |

A bounded, 50-second, metadata-only loopback observation during the ordinary SMS-off command measured eight API upstream first-byte durations of 172.01, 42.69, 62.90, 18.96, 34.77, 69.39, 33.14 and 31.81 ms. No request headers, tokens or bodies were printed or stored in the probe. There were zero reported dropped capture packets. The API was idle at the earlier sampled observation. Read-only PostgreSQL statement statistics also showed normal consent-write execution in tens of milliseconds. These observations do not establish network or client phase durations individually, but they do not support treating the multi-second wait as slow execution of these API requests.

The installed client still performs sequential consent and mode requests, waits for native scheduling, and reconciles the saved result before local confirmation. Its SMS content trigger also contains a three-second update delay. Further client changes cannot take effect in the installed binary without another update. The user's current constraint is to retain this exact version; no additional APK was built, installed or silently substituted. Speed is partially improved, not fully resolved. No security check was removed to obtain a faster response.

The hosted selective forward, DNS/TLS route, API and scoped `import.parse` worker were executed under the earlier explicit package approval. Original migration history, role memberships, all 22 bounded original table fingerprints and 27 original serving services were preserved. The reviewed three-field metadata-guard amendment and successful execution receipts are retained separately; the original frozen review package remains unchanged. The temporary SSH rule is closed; a later read confirmed 32 rules and no temporary rule. Browser console read access worked during this diagnostic continuation, without reopening SSH or changing service configuration.

Fresh Google OAuth remains outside the user's narrowed scope. The secondary Android profile is retained untouched. Voice001 and original pending imports were not replayed. Full offline, permission-loss and restart combinations, distinct voice acceptance, public legal/operator pages, Storage bytes and provider-key recovery remain unqualified. This report establishes the journeys above and does not declare unrestricted Production readiness.

The delivery path is `D:/Masarifi-delivery-2026-11-04/مصاريفي وراتبي.apk`, with its adjacent `apk-identity.json`. The older delivery APK and identity were backed up and verified byte for byte before replacement. The private evidence workspace retains consumed dispatches, failures, original screenshots and qualified receipts. Do not replay completed installs, hosted forwards or old pending operations.
