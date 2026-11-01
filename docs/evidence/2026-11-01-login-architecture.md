# Approved architectural sign-in design

Implemented the user's final sandstone-and-emerald reference, with the app logo removed. The Google brand icon remains in the Google sign-in button. The architectural image is a standalone background asset at `apps/mobile/assets/auth/saudi-courtyard.png`; it contains no text, logo, phone frame, or baked-in controls.

`GoogleAuthScreen` now uses the architectural hero, warm surface, emerald heading and outlined Google button. Arabic remains right-aligned and English left-aligned. Short screens scroll. Terms and privacy links retain their existing navigation, and the registration legal preview remains available in welcome mode. Sign-in callbacks, duplicate-submission protection, lifecycle messages and authenticated routing remain intact.

Validation:

- `GoogleAuthScreen.test.tsx` and `GoogleAccountSelector.test.tsx`: 2 suites, 12 tests passed.
- Mobile TypeScript (`tsc --noEmit`) and ESLint for all six changed source/test files passed.
- Impeccable scoped layout detector returned no findings; `git diff --check` passed.
- The full foundation-boundary checker reports an existing raw color at `FirstLaunchOnboarding.test.tsx:180`. The same assertion is present in HEAD and that file was not changed for this work.
- Isolated React Native Web rendering of the actual screen was visually checked at Arabic 390x844, English 360x740, and Arabic 360x640. Each has one Google button and no horizontal overflow; the short Arabic viewport has a vertical scroll region. The preview stubs auth/storage and does not execute sign-in.

Private screenshots: `.superpowers/sdd/2026-11-01-onboarding-preview/architectural-signin-{ar-390x844,en-360x740,ar-360x640}-final.png`. Renderer and source hash receipt are in the same directory. These are isolated component previews, not captures of the signed-out native phone.

The existing branch, phone, APK, authenticated account and Metro PID12652 were preserved. No logout, reinstall, data clear, new deletion request, or new registration was performed for the redesign. Existing account-deletion changes in the worktree were preserved. No commit or push was made.

## Native Arabic/English alignment follow-up

The user requested native screenshots and corrected Arabic/English text placement. The phone was already displaying sign-in when this follow-up began; no authentication action was invoked to reach it.

The before screenshot confirmed that the Arabic title and supporting text were physically left-aligned. React Native Android mirrors explicit left/right text alignment in RTL (`TextAttributeProps.getTextAlignment` and `ReactTextShadowNode._textAlign` in the installed native source). The screen now uses automatic text alignment with explicit writing direction and the existing platform-aware `layoutDirectionStyle` helper. The Google label stays centered; lifecycle/loading text and legal text follow the locale direction.

The app was reloaded once from the existing Metro process so the native confirmation used current source. Native screenshots at 1080x2460 on Redmi `f66a40694eca` confirm Arabic text at the right and English at the left, with Google icon order following the locale. Captures:

- Before: `.superpowers/sdd/2026-11-01-onboarding-preview/phone-layout-before.png`
- Arabic: `.superpowers/sdd/2026-11-01-onboarding-preview/native-login-ar-aligned.png`
- English: `.superpowers/sdd/2026-11-01-onboarding-preview/native-login-en-aligned.png`

Language was switched through the existing preference action for this check and restored to Arabic. No sign-in, sign-out, deletion, reinstall or data clear was performed. The same branch, device, APK and Metro PID12652 remain. Fresh verification: 2 auth suites /12 tests passed; mobile TypeScript and scoped ESLint passed; layout detector returned no findings and patch whitespace check passed. iOS was not exercised.

## Publication preparation

The user subsequently authorized committing and pushing the current updates to the existing `ratibi/codex/voice-promoted-operating-2026-10-13` branch. Fresh combined validation passed 4 mobile suites /65 tests covering deletion recovery, preferences and Google authentication, plus mobile/API TypeScript and scoped ESLint. The migration checksum manifest was regenerated with the existing project tool; its only additions are the two 1 November deletion-repair migrations. Checksum verification then passed. Both migrations were already applied to Staging and were not reapplied for publication. Private screenshots and debugger scripts are excluded from the commit.
