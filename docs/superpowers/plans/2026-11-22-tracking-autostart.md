# Tracking autostart guide implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Add the user-approved fourth help topic inside the existing tracking setup guide and qualify Android APK 163 on the connected Redmi.

**Architecture:** Extend `TrackingSetupGuide` with an `autostart` topic, retaining its current collapsible guide and sheet. A platform settings helper opens the verified Xiaomi settings component through the existing Expo intent launcher, falling back to application settings with explicit manual guidance.

**Tech Stack:** React Native, TypeScript, Expo Intent Launcher, Jest, existing signed Android build recipe, ADB.

**Spec:** User-approved preview `exec-b4d6e2c0-3fca-4848-a906-466768fda0de.png` and the approval in this chat on 2026-11-22.

## Global constraints

- Fourth topic after SMS, bank notifications, and saved alerts; no separate card, mandatory gate, or inferred enabled badge.
- Arabic/English copy, RTL, existing colors and components.
- Only explicit button presses open settings; never toggle source consent or OS settings.
- Explain first device unlock after reboot and manufacturer-dependent names.
- Preserve normal production package/signature/account and current tracking settings on upgrade.

## Review focus

- Missing OEM activity or intent-launcher binary: app-settings fallback and truthful manual instructions.
- Non-Android platforms: explain unavailability without invoking an Android action.
- Admission pending: help remains browseable, settings action disabled.
- Settings failures: retryable error; no success/activation claim.
- Dismissal during pending settings action: stale response must not affect another topic.

### Task 1: Settings navigation and fourth guide topic

**Files:** `src/services/platform/tracking-autostart-settings.ts`, its Jest test; `TrackingSetupGuide.tsx`, its tests; `TrackingStatusScreen.tsx`; Arabic/English message dictionaries (all under `apps/mobile`).

**Interface:** `openTrackingAutostartSettings(): Promise<'autostart' | 'app_settings' | 'unavailable'>`, passed to the guide as `onOpenAutostartSettings`.

- [x] Write tests proving the fourth topic only appears inside the expanded guide, opens no settings until pressed, and reports fallback/failed settings appropriately.
- [x] Observe expected failing guide test.
- [x] Implement helper using `Platform.constants.Manufacturer`, existing `expo-intent-launcher`, the observed Xiaomi Security Center component, and `Linking.openSettings` fallback.
- [x] Add topic, sheet copy, localized fallback guidance, and pending-admission disabled callback.
- [x] Run focused guide/settings/screen regression tests, TypeScript, scoped ESLint, app-shell/design-system checks. Review with clean-code-guard and test-guard.
- [x] Commit only this change and its plan for immutable-source packaging.

### Task 2: Build and device acceptance

- [ ] Adapt the verified isolated APK 162 recipe to versionCode 163 and build from the committed source.
- [ ] Verify production identity, signer, bundle feature markers and APK receipt.
- [ ] Upgrade connected normal app without clearing data; verify current account and both source settings.
- [ ] Expand guide, verify four topics, inspect autostart sheet, press its button and observe the Xiaomi autostart settings page. Preserve its enabled switch.
- [ ] Return to app, verify source settings, cold reopen and background-return guide behavior, and save screenshots/report.
- [ ] Deliver APK link and observed acceptance result.

## Implementation rulings

- Reused the existing Expo intent launcher rather than adding another native API/dependency; its local source supports explicit components and errors fall back to app settings.
- Updated the existing guide links to sit beside each topic, matching the approved compact four-row preview.
- Focused verification: 110 tests across seven suites, TypeScript, scoped ESLint, foundation/design-system/app-shell checks passed. The initial fourth-topic test failed for the expected missing row before implementation. Guard review found no changes to capture consent, source flags, or owner admission.
