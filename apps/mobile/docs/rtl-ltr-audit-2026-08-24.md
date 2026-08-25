# Masarifi Mobile RTL/LTR Audit — 2026-08-24

## Scope

- Branch: `codex/r01-shared-ui-foundation`
- Routes: 118 TSX route files
- Source components/screens: 393 TSX files
- Existing test files: 386
- Locales: Arabic RTL and English LTR
- States: loading, empty, populated, error, disabled, permission, validation, confirmation, modal, picker, and keyboard states where applicable
- Responsive checks: narrow phone, normal phone, wide layout, normal font scale, and 200% font scale

## Coverage

| Area                                       | Static review | Paired automated checks      | Android RTL                  | Android LTR                  | Result        |
| ------------------------------------------ | ------------- | ---------------------------- | ---------------------------- | ---------------------------- | ------------- |
| Foundation and design system               | Passed        | 13 suites / 31 tests passed  | Root direction passed        | Root direction passed        | Passed        |
| Shell, public auth, onboarding             | Passed        | 8 suites / 34 tests passed   | Navigation smoke passed      | Navigation smoke passed      | Fixed, passed |
| Home, accounts, categories, transactions   | Passed        | 75 suites / 307 tests passed | Home passed at 100% and 200% | Home passed at 100% and 200% | Fixed, passed |
| Reports and financial planning             | Passed        | 42 suites / 117 tests passed | Paired tests                 | Paired tests                 | Fixed, passed |
| Tracking, assistant, notifications         | Passed        | 60 suites / 201 tests passed | Paired tests                 | Paired tests                 | Fixed, passed |
| Settings, security, support, subscriptions | Passed        | 42 suites / 142 tests passed | App settings passed          | App settings passed          | Fixed, passed |
| Voice, accessibility, and route coverage   | Passed        | 63 suites / 150 tests passed | Paired tests                 | Paired tests                 | Passed        |

## Confirmed Findings

1. `OtpVerificationForm` inherited RTL for its six numeric slots and required 304 points before parent padding, overflowing a 320-point phone. The slots now form an explicit LTR, full-width row with a 4-point gap and unchanged 44-point controls. Paired Arabic/English regression coverage passed.
2. `StepIndicator` rendered numeric progress fractions without an explicit bidi direction. Fractions now use `writingDirection: 'ltr'` in both locales. Paired regression coverage passed.
3. Account, currency, category, home-transaction, and date-range labels were forcibly truncated at 200% text. They now wrap only when large text is active; normal-scale density is unchanged.
4. Category quick actions and the home period label were forcibly single-line. They now wrap without changing their approved normal-scale layout.
5. The transaction filter bar could not fit its account and period controls at 200% text. It now stacks only at large text, while preserving RTL/LTR row order at normal scale.
6. Report selectors and drill-down rows clipped at 200% text. Selector labels now wrap, and drill-down rows stack only at large text with locale-correct amount alignment.
7. Notification and tracking section headers competed with long actions at 200% text. They now stack only at large text.
8. Assistant suggestion labels and the conversation identity banner clipped at 200% text. Labels now wrap and the banner stacks only at large text.
9. Numeric form fields inherited RTL writing direction, risking reordered amounts, phone numbers, and PINs. Numeric values now remain physically LTR while localized text fields follow the active locale.
10. The month-start picker retained four columns and single-line ranges at 200% text. It now uses two columns and wrapping ranges only at large text.
11. The move-to-group modal pinned its close action to the physical right edge in both locales. It now uses the logical end edge in RTL and LTR.
12. The inherited RTL root was combined with manual `row-reverse` and `flex-end` mirroring, producing a double reversal that made Arabic rows look LTR. Physical/manual row boundaries now declare their layout direction explicitly, while the More directory and bottom tabs use React Native's inherited logical direction directly. The shared `MenuLink` keeps icon and text at logical start and the disclosure at logical end.

## Verification

- Full Jest run: 388 suites and 1,463 tests passed with `jest --runInBand`; zero failures.
- TypeScript: `npm run typecheck` passed.
- Frontend-quality boundaries: `npm run check:frontend-quality` passed all nine boundaries.
- ESLint: `npm run lint` completed with zero errors and 76 pre-existing forbidden-`require()` warnings.
- Patch hygiene: `git diff --check` reported no whitespace errors.
- Direction baseline: 5 suites and 11 tests passed with `jest --runInBand --runTestsByPath ...`.
- Shared foundation/design-system slice: 13 suites and 31 tests passed.
- OTP and step-indicator RED/GREEN cycle: 2 suites and 7 tests passed after both tests failed for the expected missing direction/layout contracts.
- Auth/onboarding/shell slice: 6 suites and 27 tests passed.
- Home/accounts/categories/transactions slice: 75 suites and 307 tests passed.
- Reports/planning/charts slice: 42 suites and 117 tests passed.
- Tracking/assistant/notifications slice: 60 suites and 201 tests passed.
- Settings/security/support/subscriptions/privacy slice: 42 suites and 142 tests passed.
- Voice/accessibility/route slice: 63 suites and 150 tests passed.
- The equivalent `npm test -- --runInBand ...` form is not used in this environment because npm strips the Jest options and the resulting worker spawn is blocked with `EPERM`.

## Android Device Validation

- Device: Samsung SM-A165F (`RK8XB00N33K`), Android development client `com.masarifi.mobile`.
- Arabic RTL and English LTR were switched through the in-app language control and loaded from this worktree's Metro bundle.
- The direction root, primary shell, home summary, account selector, quick actions, More directory, transaction rows, category rows, reports, bottom navigation, and app-settings language controls mirrored correctly.
- Arabic device bounds confirmed More/profile and menu content at the right with disclosures at the left; Home/More was `[900,145][1035,280]`, Reports was `[45,145][180,280]`, Add was `[797,885][1021,1118]`, and Accounts was `[59,885][283,1118]`. English produced the exact opposite positions.
- Arabic transaction rows placed category content at the right (`x=865..1000`) and amounts at the left (`x=80..314`); category management rows placed labels at the right and actions at the left.
- Both locales passed at the normal `1.0` font scale and at `2.0`; the device font scale was restored to `1.0` afterward.
- Evidence: `.device-smoke/rtl-more-final-ar.png`, `.device-smoke/rtl-home-final-ar.png`, `.device-smoke/rtl-audit-ar.png`, `.device-smoke/rtl-audit-en.png`, `.device-smoke/rtl-audit-ar-large.png`, and `.device-smoke/rtl-audit-en-large.png`.

## Environment Limits

- iOS device validation is unavailable in the current environment; platform-aware React Native tests provide iOS-specific coverage.
- `npm run check:frontend-quality-gates` remains blocked by four external evidence gates: `android-native`, `ios-native`, `participant-study`, and `final-end-to-end-consistency`. The Android interactive smoke above does not replace those formal gate artifacts.
