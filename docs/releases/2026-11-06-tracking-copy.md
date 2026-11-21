# Tracking copy — approved source update

The user approved the proposed shorter Gulf Arabic wording on 6 November 2026. This change updates the Tracking page copy and removes the permanent manufacturer-specific instructions. It does not change tracking activation, permissions, owner checks, consent, queues, parsing or financial posting.

## Approved copy

| Location                 | Arabic text                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| Page title               | التتبع التلقائي                                                          |
| SMS label                | تتبع الرسائل النصية                                                      |
| SMS description          | معاملاتك تتسجّل تلقائيًا من الرسائل المالية.                             |
| Notification description | معاملاتك تتسجّل تلقائيًا من إشعارات البنوك والمحافظ.                     |
| Keywords description     | هالكلمات تساعد التطبيق يتعرّف على الرسائل المالية.                       |
| Automatic detection      | المعاملات الواضحة تتسجّل تلقائيًا، واللي تحتاج تأكيد تلقاها في المراجعة. |
| Data use                 | نحلّل الرسائل المالية ونزامن معاملاتك مع حسابك في مصاريفي.               |
| Background recovery      | اسمح لمصاريفي بالعمل في الخلفية عشان يستمر التتبع.                       |

The background recovery message and existing settings action are shown only on Android when a source is enabled and the reported service state is `battery_restricted`. The redundant permanent background explanation is removed. Existing permission disclosure, permission recovery, consent retry and actionable errors remain intact. The unused manufacturer guidance key is removed from both catalogs to preserve key parity; other English copy is unchanged.

## Verification

- Existing focused suites: **68 tests / 6 suites passed**, terminal exit 0. Coverage includes the Tracking screen, source journey, permission route, accessibility, tracking messages and locale parity.
- TypeScript: exit 0.
- ESLint on the three changed application files, with `--max-warnings=0`: exit 0.
- The screen's whitespace was normalized with the existing formatter after those checks; no semantic change followed them.
- Direct diff review: changes are limited to localized copy and guidance visibility. No new test, dependency, platform service, backend change or financial fixture was introduced.
- Private logs: `.superpowers/sdd/2026-11-04-production-apk-readiness/task18-copy-{focused-tests,types,lint}.log`. Jest emitted its Expo Go push warning and delayed-exit notice, then terminated successfully; no physical-device claim is based on that run.

## Delivery boundary

This is a **source-only** change on `codex/voice-promoted-operating-2026-10-13`. No APK was built or installed, no device input was sent, and no hosted service was accessed. Redmi and the canonical delivery remain the physically proved version 111, SHA-256 `d1403ba377a28a8a7c434c4454c499e2b8ac32d1e258238a50ef480eda8b192a`. The new wording has not been verified on the phone. The earlier signed deployment packages and execution receipts remain unchanged. No commit or push is claimed for this update.
