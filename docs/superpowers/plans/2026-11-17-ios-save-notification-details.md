# iOS save notification details implementation plan

**Goal:** Show verified amount/currency, account and translated category in native iOS Shortcuts save notices.

**Architecture:** Extend the existing protected enrollment with optional bilingual presentation metadata, format the settled command using Foundation, and synchronize locale through a platform-specific runtime. Reuse existing owner/session/dedup/receipt guards and notification identifier.

**Spec:** [approved behavior](../specs/2026-11-17-ios-save-notification-details-design.md).

- [ ] Add setup payload regression tests; observe the missing metadata/locale-sync failure.
- [ ] Extend `BankSmsState.swift`, module setup and `bank-sms-setup.ios.ts` with optional notice locale, category labels and account currency scale. Keep old persisted payloads decodable.
- [ ] Add `BankSmsSavedNotice.swift` and native Foundation fixtures for Arabic/English, payment/deposit, currency scales, large exact amounts and bounded labels. Run native fixtures on the Mac EAS host using a platform-gated post-install script.
- [ ] Pass the settled command to the existing notice scheduler. Resolve configured labels by the exact command IDs after admission; keep settlement before scheduling and stable receipt-based notification ID.
- [ ] Mount an iOS-only locale runtime with a default no-op platform file; locale updates never enable capture or change enrollment epoch. Test language changes and stale work.
- [ ] Run focused JS/Node checks, TypeScript/lint, quality and Android identity checks. Review the final diff and commit/push to `ratibi/iOS`.
- [ ] Build one free AdHoc update with existing signing, verify actual archive/source, install in place and verify Arabic/English notices on the phone. Use QA-only financial data, check no replay duplication, record remaining limits. No OTA/store/server/schema/Android changes.
