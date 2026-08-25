# Implementation Plan: R02 — Accounts

**Branch**: `013-r02-accounts` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: R02 specification, approved redesign analysis, implemented account routes/screens/domain/services, mobile constitution, and R01 shared contracts.

## Summary

Redesign the six existing account surfaces in place: compact virtualized management rows, record-first detail, focused create/edit, safe archive/restore, and a searchable controlled picker. Preserve routes, guards, commands, account validation/default/archive rules, and caller flows. Correct the existing read boundary so displayed balances use the authoritative complete-ledger projection rather than a paginated UI page, preserve optional stored fields during edit, and consume R01 presentation plus R04 transaction rows without introducing a new account store, route, provider, permission, or dependency.

## Technical Context

**Language/Version**: TypeScript 5.3.3 strict mode; React 18.2; React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router 3.5, React Query 5.51, Zustand 4.5 for shared preferences/privacy, Zod 3.23, Expo SQLite 14 through existing repository, i18next 23.12, R01 design system

**Storage**: Existing core-finance repository only; no schema or durable account-draft addition

**Testing**: Jest 29/jest-expo, React Native Testing Library 12.5, core-finance/design-system boundary checks, TypeScript, ESLint, Android/iOS device validation

**Target Platform**: Existing supported Android and iOS Expo development-build application

**Project Type**: React Native/Expo feature-oriented mobile application with file routing and typed repository/service boundaries

**Performance Goals**: Immediate search/row response; native virtualization remains usable with 100+ accounts; complete-ledger balance projection remains within existing repository performance envelope; standard motion 100–240 ms

**Constraints**: Six routes unchanged; no account rule or calculation change; unknown money never zero; 320×568 minimum viewport; 44×44 targets; 200% text; Arabic RTL/English LTR; hidden-value privacy; no fabricated sync/freshness state

**Scale/Scope**: Six route surfaces, three account screens plus picker, one bounded balance read projection, and downstream account-selection consumers

## Constitution Check

*GATE: Passed before Phase 0 research; re-checked after Phase 1 design.*

- **Financial trust — PASS**: Balance uses the existing authoritative rule over complete data; presentation never recalculates from a partial page. Archive/restore is confirmed, optional stored data is preserved, unknown/hidden values remain distinct, and failures are actionable.
- **Platform honesty — PASS**: Account capability is the same on Android/iOS; no permission/platform claim is added and existing manual/offline repository behavior remains.
- **Language and access — PASS**: Arabic/English parity, English numerals, bidi-safe amounts/identifiers, 200% text, screen-reader order, keyboard/safe areas, non-color status, reduced motion, and 44×44 targets are contractual.
- **Design system — PASS**: R02 consumes R01 grouped rows, financial/sensitive values, fields, states, confirmation, overlay, semantic tokens, and motion with no local token system.
- **Architecture and proof — PASS**: Existing core-finance domain/service/repository owns rules and mutations. A read-only projection corrects the balance boundary; no duplicate store, provider, secret, permission, or production integration is added.

### Post-Design Re-check

- Research resolves balance trust, list density, picker ownership, optional-field preservation, dirty forms, and truthful state mapping.
- Data model adds presentation/read projections only and no persistence schema.
- Account UI contract separates R01, R02, core-finance, R04, and caller responsibilities.
- Quickstart covers complete-ledger balances, every screen, downstream callers, privacy, accessibility, and devices.
- No constitution exception remains.

## Project Structure

### Documentation (this feature)

```text
specs/013-r02-accounts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/account-presentation-contract.md
├── checklists/requirements.md
└── tasks.md                              # Created later by /speckit-tasks
```

### Existing Source Code in Scope

```text
app/accounts/
├── _layout.tsx
├── index.tsx
├── new.tsx
└── [id]/{index,edit}.tsx
app/modals/account-picker.tsx

src/
├── features/accounts/{AccountListScreen,AccountDetailScreen,AccountForm}.tsx
├── features/transactions/AccountPicker.tsx
├── features/core-finance/core-finance-queries.ts
├── domain/core-finance.ts
├── services/contracts/core-finance-service.ts
├── services/mocks/core-finance-service.ts
├── storage/core-finance-repository.ts
├── features/shell/navigation-context.ts
├── design-system/                         # R01 contracts consumed
├── localization/messages/{ar,en}.ts
└── test-utils/core-finance-fixtures.ts
```

**Structure Decision**: Keep thin routes and current feature/domain/service/repository ownership. Extend existing account screens and picker; add at most one small account presentation projector and one authoritative read-only balance query where current boundaries cannot provide complete data. Do not create another account model or generic form/list framework.

## Implementation Design

### 1. Authoritative Read and Shared Prerequisites

- Inventory account consumers and current R01 component contracts.
- Add/reuse a typed core-finance read projection that produces each account's balance from complete qualifying ledger data using the current rule; tests prove parity with repository calculations beyond one page.
- Map privacy visibility through the shared owner and inclusion/exclusion only when existing aggregate data supplies it.
- Resolve any missing R01 variant at R01 ownership rather than local raw styles.

### 2. Account List

- Replace repeated `AccountCard` heroes with a virtualized compact account-row composition inside grouped sections.
- Preserve name search semantics, create action, detail navigation, archived/default identity, and sanitized return action.
- Distinguish no accounts, no search match, loading, error/retry, hidden/unknown values, dense/long content, and only supplied inclusion state.

### 3. Account Detail

- Recompose summary → identity/status → R04 activity integration → actions.
- Use the authoritative balance projection and preserve active/archived/default/multi-currency/credit context.
- Add R01 confirmation/pending/error handling around existing archive/restore; block duplicate commands.
- Preserve edit, transfer context, result navigation, missing, and retry behavior.

### 4. Create and Edit

- Recompose the current form with persistent labels, compact account-type selection, opening balance, currency behavior, default toggle, one Save action, keyboard/safe-area handling, and local dirty guard.
- Keep current validation/service commands and preserve all optional stored account fields not exposed by the focused form.
- Prevent duplicate Save and show only truthful working/success/failure states.

### 5. Account Picker

- Convert the current scroll map to a virtualized searchable selection list inside R01 modal/container presentation.
- Keep active eligibility, current selection, name/currency/last-four search, select/cancel callbacks, and optional caller-owned create route.
- Do not introduce a global picker store; each caller retains draft/filter application and return context.

### 6. Localization, Accessibility, Privacy, and Integration

- Localize every new label/status/error/action in Arabic and English.
- Validate bidi-safe amount, currency, masked digits, account names/institutions; logical focus and disclosure direction; 200% reflow and 44×44 targets.
- Confirm hidden-value behavior across UI, screen reader, background, app switcher, errors, and safe evidence.
- Regress R04/R05/R06/R07/R08/R12/R15/R16 consumers without redesigning them in R02.

## Planned Verification

### Automated

- Complete-ledger balance projection and partial-page regression.
- List search/empty/dense/status/hidden states and route return.
- Detail missing/error/transfer/archive/restore/pending/failure.
- Create/edit validation, currency behavior, all seven types, dirty dismissal, duplicate submission, and optional-field preservation.
- Picker search/selection/eligibility/no-result/cancel and caller integration.
- Localization/accessibility/privacy and R01 boundary tests.
- `npm run typecheck`, `npm run lint`, `npm run check:design-system`, `npm run check:core-finance`.

### Visual and Device

- Independently validate Account List, Detail, Create, Edit, and Picker before advancing.
- Cover Arabic/English, light/dark, normal/200%, smallest/larger phone, keyboard, TalkBack/VoiceOver, reduced motion, visible/hidden values, dense/long/mixed data, error/offline transport states.
- Validate on supported Android and iOS device/environment and retain only safe evidence.

## `/tasks` Handoff

Future `tasks.md` MUST be ordered:

1. Shared/authoritative-balance prerequisites.
2. Screen: Account List, then tests/device validation/fixes.
3. Screen: Account Detail, then tests/device validation/fixes.
4. Screen: Create Account, then tests/device validation/fixes.
5. Screen: Edit Account, then tests/device validation/fixes.
6. Screen: Account Picker, then tests/device validation/fixes.
7. Cross-consumer and final R02 consistency/privacy/financial regression.

Each screen group names exact files and covers hierarchy, components, styling, interaction/navigation, states, RTL/LTR, accessibility, motion, tests, real-device evidence, and bounded validation fixes.

## Complexity Tracking

No constitution violations or exceptional complexity are planned.
