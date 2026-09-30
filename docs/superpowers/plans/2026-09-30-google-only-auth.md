# Google-only Staging authentication

Approved by the owner on 2026-09-30 in this chat, including preservation of all completed App Lock/PIN fixes and tests. The revised plan and owner clarification in the chat are the specification.

## Constraints

- Google is the only public authentication method in this phase.
- Preserve biometric lifecycle, coalescing/cancellation, PIN fallback, fail-closed storage, privacy masking, and Clerk bridge regressions.
- Disable App Lock only through Staging enforcement configuration; valid Clerk authentication remains mandatory.
- No Production or credential changes. No clear-data/uninstall. Clerk configuration changes require separate owner approval.
- Callback parameters are sensitive: never persist, render, or log them; tests use fabricated values.
- Phone, SMS, country selection/normalization, Email/password/code, and password recovery are deferred. No phone dependency.

## Tasks (test-first)

1. Fix restoration cancellation and establish one authenticated bootstrap owner.
2. Add deterministic loading/error/retry outcomes and bounded token/HTTP operations.
3. Gate user-facing App Lock enforcement for Staging, preserving enabled regressions.
4. Expose Google-only public authentication and preserve reusable deferred code.
5. Polish Welcome/Login with existing Masarifi tokens/assets and official Google branding, Arabic/English and accessibility.
6. Intercept native SSO callback at the Router boundary, preserving Clerk/WebBrowser ownership and clean navigation.
7. Harden Google new/existing session, cancel/failure/incomplete registration, lifecycle and persistence.
8. Focused and full Mobile verification plus whole-diff review.
9. Commit/push and exact-SHA CI.
10. Verify Staging, changing only required artifacts.
11. Build/install the exact passing SHA with compatible signer and preserved data.
12. Physical Android acceptance: signed-out UI, chooser, login, clean callback, terminating bootstrap, restart, logout/login, locales and disabled lock.

## Verification

Google icon source: https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg

Regression tests must reproduce hydration self-cancellation, stale-owner cancellation, token deadline, retry without identity reset, SSO existing/new session outcomes, no duplicate activation, sanitized callback routing, protected access with lock disabled, UI cancellation/error/accessibility, and preserve all historical security regressions. Run Mobile Jest, typecheck, lint, frontend-quality and exact-SHA CI before APK acceptance.
