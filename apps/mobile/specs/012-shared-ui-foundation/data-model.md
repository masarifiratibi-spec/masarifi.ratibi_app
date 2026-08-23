# Phase 1 Data Model: R01 Shared UI Foundation

R01 introduces no persisted business data. These entities are typed presentation contracts. Feature areas remain the owners of financial records, calculations, permissions, commands, and recovery policy.

## 1. Semantic Theme Contract

Represents resolved visual roles for one active theme.

### Fields

- `mode`: `light | dark`
- `surfaces`: page, grouped, card, inset, brand-strong, brand-subtle, attention, overlay
- `content`: primary, secondary, muted, inverse, link, disabled, sensitive
- `borders`: default, subtle, strong, focus, selected, error, disabled
- `interactions`: primary, primary-pressed, secondary, quiet-pressed, destructive, premium
- `statuses`: success, warning, danger, info, neutral, pending, offline, sync, review, conflict, read-only
- `financialTones`: income, expense, transfer, refund, savings, debt, neutral
- `chart`: approved series colors and non-color patterns
- `spacing`, `radius`, `borderWidth`, `elevation`, `iconSize`, `controlHeight`, `minTouchTarget`
- `typography`: caption, support, body, label, subtitle, title, summary, row-amount

### Validation Rules

- Raw colors exist only in the token adapter.
- Every light role has a dark counterpart.
- Operational status and financial tone remain separate domains.
- Bronze is used only by restrained premium/accent roles.
- Focus, text, status, and chart pairings meet the project contrast standard.
- `minTouchTarget` is at least 44.

## 2. Shared Component Contract

Describes one reusable presentation pattern.

### Fields

- `id`: stable component/pattern name
- `purpose`: user problem solved
- `allowedContexts` and `prohibitedUses`
- `variants`
- `interactionStates`: default, pressed, focused, selected, disabled, loading as applicable
- `presentationStates`: supported state models
- `contentRules`
- `directionRules`
- `accessibilityRules`
- `motionRules`
- `privacyRules`
- `consumers`: downstream areas/files requiring regression validation

### Relationships

- Resolves visual values through one Semantic Theme Contract.
- May accept Presentation State, Financial Display, Source Presentation, or Action Contract values.
- Is demonstrated by one or more Gallery Scenarios.

## 3. Shell Destination

Represents one existing primary destination rendered by `AppTabs`.

### Fields

- `route`: one of `/(tabs)/home`, `/(tabs)/transactions`, `/(tabs)/add`, `/(tabs)/reports`, `/(tabs)/more`
- `labelKey`: localization key
- `icon`: approved icon name
- `selected`: supplied from current route
- `emphasis`: `standard | add`
- `onSelect`: existing navigation callback

### Validation Rules

- Exactly five destinations exist.
- Route, label meaning, and destination order remain unchanged.
- Every destination has a persistent label and icon.
- Add uses integrated emphasis and remains a tab.
- Selected state is conveyed by more than color.
- RTL changes visual/focus order through the existing direction contract, not route meaning.

## 4. Presentation State

Represents truthful state content without owning its cause or recovery policy.

### Fields

- `kind`: initial, loading, empty, no-result, error, offline, partial, stale, pending-sync, local-success, permission, review, conflict, disabled, read-only, limit, success, hidden
- `title`: localized caller-supplied text
- `message`: optional localized explanation
- `consequence`: optional statement of what did or did not change
- `action` and `secondaryAction`: optional Action Contracts
- `source`: optional Source Presentation
- `freshness`: optional timestamp or caller-formatted label
- `announcement`: `none | polite | assertive`

### Validation Rules

- Unknown data cannot be represented as confirmed zero.
- Error/offline/permission/conflict identifies a valid next step when the feature provides one.
- Local success and pending sync cannot use confirmed synchronized-success language.
- Review/conflict cannot imply a financial change before feature confirmation.
- Meaning is not color-only.

## 5. Financial Display

Represents a feature-owned monetary value projected for display.

### Fields

- `value`: numeric amount supplied by the feature
- `currencyCode`: validated three-letter code supplied by the feature
- `locale`: current `ar | en`
- `sign`: `positive | negative | none`, supplied by the feature
- `tone`: income, expense, transfer, refund, savings, debt, neutral
- `state`: confirmed, estimated, pending, unknown, absent, hidden
- `size`: summary, row, supporting
- `accessibilityLabel`: safe caller-supplied description or shared formatted equivalent

### Validation Rules

- Formatting uses the shared locale-aware formatter and English numerals.
- Tone never determines sign, ledger effect, or calculation.
- Unknown, absent, hidden, and zero remain distinct.
- Hidden display does not expose magnitude or value through accessibility.
- The formatted number/currency/sign is one bidi-safe LTR run in either app direction.

## 6. Source Presentation

Represents feature-supplied origin metadata.

### Fields

- `kind`: manual, automatic, imported, assistant-proposed, or other supported feature value
- `label`: localized concise source label
- `description`: optional localized explanation
- `protectedDetail`: optional detail governed by existing privacy rules
- `onPress`: optional route/action supplied by the owner

### Validation Rules

- Source is not inferred from presentation context.
- Protected raw source content is never a default label or accessibility value.
- Press behavior cannot create or confirm a financial change.

## 7. Action Contract

Represents a caller-owned command rendered by a shared control.

### Fields

- `label`: localized visible and accessible name
- `variant`: primary, secondary, quiet, destructive, premium
- `status`: ready, loading, disabled
- `disabledReason`: optional localized explanation
- `onInvoke`: caller-supplied callback

### State Transitions

```text
ready --invoke--> loading
loading --feature success--> ready or owning destination
loading --feature failure--> ready + caller-supplied error
ready --feature condition--> disabled
disabled --condition resolved--> ready
```

The control blocks duplicate invocation while loading but does not determine success or retry policy.

## 8. Overlay Contract

Represents a shared sheet, picker, or confirmation container.

### Fields

- `kind`: sheet, picker, dialog
- `visible`: owner-controlled boolean
- `title` and optional `description`: localized text
- `content`: feature/shared component content
- `primaryAction`, `secondaryAction`: optional Action Contracts
- `dismissPolicy`: explicit, backdrop, platform-back, or allowed combination
- `invokerRef`: focus-return target
- `preserveDraft`: true where dismissal must keep input

### State Transitions

```text
closed --open--> opening --focus placed--> open
open --confirm--> submitting --feature result--> closed or open-with-error
open --allowed dismiss--> closing --focus returned--> closed
open --background/keyboard/safe-area change--> open with reachable content
```

### Validation Rules

- At most one dominant primary action is visible.
- Dismissal does not invoke a feature command.
- Consequential confirmation names the object and consequence.
- Focus is contained and returned to the invoker.
- Keyboard/safe-area changes do not hide required content or actions.

## 9. Direction Contract

### Fields

- `locale`: Arabic or English
- `layoutDirection`: RTL or LTR derived from locale
- `numericDirection`: LTR
- `iconBehavior`: mirror or fixed by semantic icon
- `focusOrder`: logical task sequence

### Validation Rules

- Layout uses logical start/end behavior.
- Back/disclosure icons mirror; universal icons do not.
- Chronology and data order do not reverse solely because layout is RTL.
- Mixed-script merchant/account/reference content remains readable.
- Arabic and English expose equivalent actions and state meaning.

## 10. Gallery Scenario

Represents a review fixture, not production data.

### Fields

- `componentId`
- `locale`, `theme`, `direction`
- `contentDensity`: normal, long, dense
- `textScale`: standard, 200-percent
- `interactionState`, `presentationState`
- `privacyState`: visible or hidden
- `motionState`: standard or reduced
- `viewport`: minimum or large phone
- `expectedOutcome`

### Validation Rules

- Fixtures are localized or deliberately mixed-direction test data.
- No raw sensitive production data is used.
- Each family covers applicable variants/states, not an unnecessary Cartesian product.

## 11. Consumer Relationship

### Fields

- `componentId`
- `consumerArea`: R02–R21
- `consumerFiles`: current import sites
- `contractVersion`: R01 baseline
- `regressionScenarios`: targeted automated, gallery, and device checks

### Validation Rules

- Every changed public component has identifiable consumers.
- Consumer migrations may adapt props but cannot redesign feature hierarchy in R01.
- A later reusable variant returns to R01 ownership instead of becoming a local token or duplicate contract.

