# Final Automated Matrix

Date: 2026-08-15

Automated coverage completed:

- Arabic/English localization keys compile through typed message keys.
- RTL/LTR shell direction covered by `AppTabs.test.tsx`, `ShellDirection.test.tsx`, and `AppShellLocalization.test.tsx`.
- English numerals and bidi financial output covered by `format-financial-value.test.ts` and financial primitive/card/row tests.
- Hidden values/privacy covered by design-system privacy, external-sensitive-display, SensitiveValue, and gallery privacy tests.
- State distinctions covered by `StateFeedback.test.tsx`, `StateGallery.test.tsx`, and planning state tests.
- Non-color meaning covered by status, progress, chart, and accessibility tests.
- Reduced motion covered by `src/design-system/motion.test.ts` and shell state tests.
- Safe areas and modal containment covered by `RouteModalContainer.test.tsx`, `Overlays.test.tsx`, `AppTabs.test.tsx`, and app-shell accessibility tests.
- Minimum target assertions covered by design-system primitive/navigation tests and shell accessibility tests.

Manual/device coverage partially completed:

- Android build/install and Metro launch pass on Samsung `SM-A165F`; language entry and English public entry screens render on device.
- Android TalkBack, 200% text, dark/light, smallest/large phone, background remask, native modal focus, keyboard, tabs, protected routes, planning conflict, and gallery journeys remain open.
- iOS VoiceOver, home indicator, native modal, and app-switcher journeys are blocked by missing supported iOS/macOS environment.
