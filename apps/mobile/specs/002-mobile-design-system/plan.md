# Implementation Plan: Mobile Design System and Interaction Language

**Branch**: `002-mobile-design-system` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-mobile-design-system/spec.md`

## Summary

Extend the semantic theme adapter delivered by SPEC-001 into the reusable Masarifi mobile
design system. Complete the reference, semantic, theme, typography, motion, and component
contracts; implement the shared navigation, form, feedback, overlay, financial, chart, and
privacy primitives as small compositions; and expose one design-system gallery for automated
and native validation. The work stays inside the existing Expo application and does not create
a second token source, copy Admin Dashboard components, or implement later feature journeys.

## Technical Context

**Language/Version**: TypeScript 5.3.3, React 18.2, React Native 0.74.5

**Primary Dependencies**: Expo SDK 51, Expo Router, Expo Font, Expo Vector Icons,
React Native Safe Area Context, React Native Animated, React Native SVG, Zustand, i18next,
React Native Testing Library, and Jest

**Storage**: Existing protected preference storage for theme, locale, reduced motion, and
sensitive-value visibility; no new design-system database or cache

**Testing**: Jest and React Native Testing Library for tokens, themes, component behavior,
accessibility, charts, masking, and interaction states; Android/iOS development builds for
font rendering, screen readers, keyboard/safe-area behavior, motion, and app-switcher privacy

**Target Platform**: Android API 23+ with target API 34; iOS versions supported by Expo SDK 51;
portrait phones down to 320 by 568 logical pixels; adaptive tablet layouts

**Project Type**: Shared Expo and React Native mobile application with platform-aware behavior

**Performance Goals**: Maintain 60 frames per second for ordinary component interactions;
complete motion inside the approved 100-240 millisecond ranges; prevent loading-state layout
shift; render chart summaries and controls without blocking interaction

**Constraints**: Frontend-only; Arabic RTL and English LTR parity; light and dark themes;
200% text scaling; 44 by 44 minimum targets; sensitive values masked after lock/background;
semantic tokens only; no Admin Dashboard layouts; no glass effects, heavy gradients, or
decorative shadow system

**Scale/Scope**: One mobile token and theme source, two languages, two themes, reusable
contracts for the approved navigation, financial, form, feedback, overlay, and chart families,
plus one validation gallery; no production feature screens or service integration

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design: passed.*

- **Financial trust - PASS**: Financial semantics remain separate from operational status.
  Sensitive values default to masked, reveals reset after app lock/background, and automatic
  feedback patterns include correction or undo where applicable.
- **Platform honesty - PASS**: Components expose one shared product language while native
  behavior remains platform-aware. No SMS, permission, or provider capability is added by this
  feature; later flows must supply honest fallback content through component contracts.
- **Language and access - PASS**: The contract covers Arabic RTL, English LTR, IBM Plex product
  typography, locale-aware financial formatting, 200% text scaling, screen readers, focus,
  reduced motion, contrast, and 44 by 44 targets.
- **Design system - PASS**: The existing `src/design-system` adapter remains the single mobile
  source until `packages/ui-tokens` exports runtime values. Raw values remain confined to the
  adapter, and every component declares theme, RTL, responsive, state, content, and access rules.
- **Architecture and proof - PASS**: Components are typed presentational compositions with no
  provider calls or secrets. Focused tests and a development-build gallery prove deterministic
  behavior and the native checks that Jest cannot prove.

## Project Structure

### Documentation (this feature)

```text
specs/002-mobile-design-system/
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   `-- mobile-design-system-contract.md
|-- data-model.md
|-- plan.md
|-- quickstart.md
|-- research.md
`-- spec.md
```

### Source Code (`apps/mobile`)

```text
app/
|-- design-system/
|   `-- index.tsx
|-- _layout.tsx
`-- index.tsx

src/
|-- design-system/
|   |-- components/
|   |   |-- feedback/
|   |   |-- financial/
|   |   |-- forms/
|   |   |-- navigation/
|   |   `-- overlays/
|   |-- charts/
|   |-- icons.tsx
|   |-- motion.ts
|   |-- privacy.ts
|   |-- theme.ts
|   |-- tokens.ts
|   |-- typography.ts
|   `-- index.ts
|-- features/
|   `-- design-system/
|       |-- DesignSystemGallery.tsx
|       `-- DesignSystemGallery.test.tsx
|-- localization/
|   `-- messages/
|       |-- ar.ts
|       `-- en.ts
|-- state/
|   |-- preferences.ts
|   `-- theme-context.ts
|-- test-utils/
`-- utils/
    |-- format-financial-value.ts
    `-- mask-financial-value.ts

assets/
`-- fonts/
```

**Structure Decision**: Extend the existing `src/design-system` boundary and existing
preference, localization, formatting, and masking utilities. Organize components by user-facing
family so later specs import small public exports rather than a new framework or registry.
Keep tests beside shared behavior and use one temporary gallery route for visual/native QA.

## Phase 0: Research Outcome

Research decisions are recorded in [research.md](research.md). All technical-context choices
are resolved; no `NEEDS CLARIFICATION` items remain.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines token, theme, component, semantic, state, content,
  chart, and sensitive-presentation models and their validation rules.
- [mobile-design-system-contract.md](contracts/mobile-design-system-contract.md) defines the
  public UI behavior consumed by later mobile specifications.
- [quickstart.md](quickstart.md) defines automated, gallery, accessibility, responsive, chart,
  privacy, and native validation scenarios.

## Complexity Tracking

No constitution violations or justified complexity exceptions are required.
