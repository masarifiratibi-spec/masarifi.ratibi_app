# Data Model: Mobile Design System and Interaction Language

These models define frontend design contracts and gallery fixtures. They are not production
backend schemas.

## DesignToken

Represents one centrally owned reference, semantic, product-mode, or component value.

| Field | Type | Rules |
|---|---|---|
| `name` | string | Stable and unique within its layer |
| `layer` | enum | `reference`, `system`, `mobile`, or `component` |
| `category` | enum | Color, typography, spacing, radius, border, elevation, icon, motion, or chart |
| `value` | typed value | Raw values allowed only in the central adapter |
| `purpose` | string | One clear semantic use |
| `themeMode` | enum or null | `light`, `dark`, or null when mode independent |
| `contrastAgainst` | token list | Required for text, icon, and status foreground values |

**Validation**:

- Components reference semantic, mobile, or component names, never raw values.
- A missing value is added centrally before feature use.
- Financial semantics and system statuses cannot share a semantic name.
- Bronze cannot be mapped as the default primary action family.

## Theme

Represents a complete semantic mapping for one appearance mode.

| Field | Type | Rules |
|---|---|---|
| `mode` | enum | `light` or `dark` |
| `colors` | token map | Must cover every required semantic color |
| `typography` | token map | Must include Arabic, English, and financial number styles |
| `spacing` | token map | Based on the approved four-unit scale |
| `shape` | token map | Radius, border, and elevation mappings |
| `motion` | token map | Approved duration and easing mappings |

**Validation**:

- Normal text contrast is at least 4.5:1 and large text contrast is at least 3:1.
- Financial meanings and system statuses remain distinct in both modes.
- Disabled states remain readable and do not use opacity as their only cue.

## ComponentContract

Represents one reusable mobile component family member.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable component identifier |
| `family` | enum | Navigation, financial, form, feedback, overlay, or chart |
| `anatomy` | part list | Required and optional visible parts |
| `variants` | variant list | Only variants with distinct user meaning |
| `sizes` | size list | Must preserve minimum touch and text rules |
| `states` | interaction-state list | All applicable observable states |
| `contentRules` | rule list | Action language, wrapping, empty content, and privacy |
| `rtlBehavior` | behavior | Reading order and icon mirroring rules |
| `responsiveBehavior` | behavior | 320 by 568 minimum and tablet adaptation |
| `accessibilityBehavior` | behavior | Name, role, state, order, announcement, and target size |
| `tokenMap` | token references | No raw component values |

## FinancialSemantic

Represents financial meaning independently of operational success or failure.

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `income`, `expense`, `transfer`, `refund`, `savings`, or `debt` |
| `labelKey` | message key | Resolves in Arabic and English |
| `icon` | icon reference | Reinforces meaning without replacing text |
| `solidToken` | token reference | Financial semantic token only |
| `textToken` | token reference | Meets contrast target |
| `surfaceToken` | token reference | Remains distinct in both themes |

## InteractionState

Represents the visible and accessible condition of a component.

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `default`, `pressed`, `focused`, `selected`, `disabled`, `loading`, `success`, `warning`, `error`, `empty`, `offline`, `permission`, or `sync` |
| `labelKey` | message key or null | Required when state meaning is user-visible |
| `accessibleState` | semantic state | Must match visible behavior |
| `actionEnabled` | boolean | False while duplicate submission is blocked |
| `recoveryAction` | action or null | Required for actionable failures |
| `motion` | motion token or none | None for reduced-motion substitution |

**Mutation transition**:

```text
default -> pressed -> loading -> success -> default
default -> pressed -> loading -> error -> default
success -> undone
```

- A second submission is rejected while `loading`.
- Entered form values survive `error`.
- Reversible automatic success exposes `undone` through the undo action.

## ContentPattern

Represents approved user-facing interaction language.

| Field | Type | Rules |
|---|---|---|
| `messageKey` | message key | Resolves in Arabic and English |
| `purpose` | enum | Label, helper, validation, status, comparison, feedback, or action |
| `tone` | enum | Calm, direct, and non-judgmental |
| `actionOutcome` | string or null | Required for command labels |
| `sensitive` | boolean | Controls masking and announcement behavior |

## ChartPresentation

Represents a question-led financial chart and its accessible equivalent.

| Field | Type | Rules |
|---|---|---|
| `kind` | enum | `donut` or `line` for SPEC-002 |
| `questionKey` | message key | States the question answered |
| `series` | series list | Donut maximum 5 after grouping; line maximum 4 |
| `labels` | label list | Direct where space permits |
| `summaryKey` | message key | Required text equivalent with values |
| `emptyState` | interaction state | Empty or insufficient-data state |
| `drillDownAction` | action or null | Announces destination and filter |

## SensitivePresentation

Represents content that may be masked or revealed in the active app session.

| Field | Type | Rules |
|---|---|---|
| `classification` | enum | Balance, salary, debt, transaction, identifier, raw capture, notification, or assistant |
| `masked` | boolean | True on first use and external surfaces |
| `revealAuthorized` | boolean | True only after the approved action |
| `surface` | enum | In-app, lock screen, app switcher, error, or analytics |
| `expiresOn` | enum | `app_lock` or `background` for an in-app reveal |
| `accessibleLabelKey` | message key | Does not announce the hidden value while masked |

**State transitions**:

```text
masked -> authorized -> revealed
revealed -> background -> masked
revealed -> app_lock -> masked
```

- Lock-screen, app-switcher, raw-error, and analytics surfaces never enter `revealed`.
- Masking preserves layout without exposing value length or totals through helper content.

## Relationships

- A `Theme` maps semantic `DesignToken` values for one appearance mode.
- A `ComponentContract` references tokens, interaction states, content patterns, and access rules.
- A financial component references one `FinancialSemantic` and may also expose a separate
  operational `InteractionState`.
- A `ChartPresentation` uses chart tokens and one required accessible `ContentPattern` summary.
- A component containing protected content owns one `SensitivePresentation` state.
