# T024-T025 Re-review

## Verdict

- Prior finding: **ADDRESSED**
- Spec: **PASS**
- Quality: **APPROVED**

`apps/mobile/src/storage/settings-storage.ts:41-43` now delegates hydration to the canonical `usePreferenceStore.getState().hydrate()` action. It no longer reads protected preferences or mutates Zustand directly.

`apps/mobile/src/storage/settings-storage.test.ts:76-103` persists non-default preferences through `secure-preferences`, hydrates through `createSettingsStorage()`, and proves:

- locale, direction, theme, hide-balances, currency, and reduced-motion values reach the global store;
- `hydrated` becomes `true`;
- the runtime locale changes to `en`.

## Verification

- Focused settings/privacy-lock suites: 5/5 tests passed.
- TypeScript typecheck passed.
- No blocking new breakage found in the fix.
