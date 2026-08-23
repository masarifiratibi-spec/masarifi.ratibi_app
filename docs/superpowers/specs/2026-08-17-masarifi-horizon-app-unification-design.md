# Masarifi Horizon App-Wide Design Unification

## 1. Job and audience

Masarifi serves Arabic-first mobile users who need to understand and manage everyday finances quickly, often one-handed and while distracted. The redesign must make the whole application feel like one product without changing financial logic, routes, stored data, privacy behavior, or task flows.

The approved Home screen is the visual authority. The goal is not to copy its composition everywhere; it is to extract its typography, surfaces, spacing, color discipline, financial semantics, and interaction patterns into a reusable system that adapts to each screen's job.

## 2. Approved direction

The product adopts the **Masarifi Horizon** identity app-wide in staged vertical releases.

- Light mode is the only active visual target for this program.
- Dark mode remains preserved in source but is a separate future program.
- The strong Horizon gradient is reserved for **Home and Transactions**.
- All other screens use light Horizon surfaces, dark-teal actions, semantic financial colors, and restrained brand accents.
- Every stage receives a visual proposal and explicit approval before implementation.
- Existing uncommitted work is preserved; no reset, clean, unrelated overwrite, commit, or push is part of this program.

## 3. Typography system

### Families

- Arabic UI: **Noto Sans Arabic UI**.
- English UI and financial numerals: **Roboto**.
- The selected font files are vendored centrally with their licenses and loaded once through the existing typography foundation.
- Arabic and English are equal first-class layouts; screens do not choose font families directly.

### Semantic weights

- Regular `400`: body copy, descriptions, metadata, helper text.
- Medium `500`: form values, secondary controls, compact labels.
- Semibold `600`: buttons, chips, selected states, section actions.
- Bold `700`: card titles, screen titles, important values.
- ExtraBold `800`: Arabic hero headings and primary section headings.
- Black `900` in Roboto: hero financial amounts only.

Financial numerals always use Roboto, LTR isolation, tabular numerals where supported, and remain visually attached to their currency. Feature screens consume semantic typography roles rather than raw font names or weights.

## 4. Shared visual system

### Surfaces and color

- Keep the approved Horizon gradient `#103F37 → #1D7464` for Home and Transactions only.
- Use the approved light page surface, activity sheet, wash, glass, borders, and scrim through semantic design tokens.
- Income remains green, expense red, transfer blue, savings and debt retain their existing semantic families.
- Color never carries financial meaning alone; signs, labels, icons, and accessible text remain present.
- No feature-level raw colors are introduced.

### Content containers

- Financial entities—transactions, accounts, savings goals, obligations, salary entries, and budgets—render as independent rounded cards.
- Settings, menus, and compact choice lists render as grouped rows with internal dividers.
- Forms do not wrap every field in decorative cards; fields sit on calm light surfaces with clear grouping.
- Card radii stay within 12–16 px. Pills are reserved for filters, periods, and compact states.

### Iconography

- OpenMoji category imagery is used only for categories, merchants, and financial meaning visuals.
- Masarifi line icons are used for navigation, actions, settings, security, and system states.
- Category assets and mapping stay centralized; no screen duplicates the mapping.

### Overlays

- Bottom sheets handle quick choices, filters, menus, and contextual actions.
- Full-screen routes handle long or multi-step forms.
- Native date/time pickers remain native.
- Sheets cover underlying content and navigation, preserve Android Back and backdrop dismissal, and follow the approved Horizon menu appearance.

## 5. Header families

The application uses three header families:

1. **Branded primary header:** Home and Transactions. It may use the Horizon gradient and compact account/report actions.
2. **Collection header:** lists and overview screens. It contains a reading-edge title, an optional supporting scope, and one clear primary action.
3. **Task header:** detail and form screens. It contains Back/Close, a direction-aware title, and Save/Confirm or the relevant contextual action.

Reports, More, deep links, contextual Back behavior, and existing routes remain intact. Headers use minimum 48×48 touch targets and preserve RTL/LTR focus order.

## 6. Transactions redesign

Transactions is the first full vertical adoption after the shared foundation.

### Composition

- A Horizon gradient region contains the title, current period control, and income and expense with equal visual status.
- Income and expense are both visible; neither becomes subordinate to balance.
- Search and compact filter actions remain accessible without competing with the summary.
- A horizontal shortcut rail exposes All and active high-value categories/types.
- Advanced filters open in the existing filter flow presented as a Horizon Bottom Sheet.
- The activity list sits on a light rounded sheet below the gradient.

### List organization

- Transactions are grouped by relative time: Today, Yesterday, Last week, Earlier.
- Each transaction is an independent card with no shared outer container and no internal divider.
- Arabic places category and transaction information on the right and amount/date on the left; English mirrors this structure.
- Category visuals use the existing centralized mapping.
- Pressing a row continues to open `/transactions/[id]/edit` directly.
- Search, filters, privacy masking, pagination, virtualization, deduplication, empty/loading/error states, and deep links are unchanged.

## 7. Forms and task screens

All existing form structures remain stable, including Edit Transaction, account forms, budget forms, obligation forms, salary forms, savings forms, support forms, and settings forms.

The unification changes only:

- typography roles;
- Horizon colors and semantic states;
- input, picker, chip, segmented-control, and action styling;
- section spacing and dividers;
- header identity;
- responsive reflow and RTL/LTR alignment.

Field order, validation, domain logic, defaults, persistence, navigation, delete/undo behavior, and save outcomes remain unchanged. Edit Transaction keeps its approved three-option type selector and centered amount composition.

## 8. Responsive and accessibility behavior

- The default target is balanced mobile density, based on the approved Home screen.
- At normal text sizes, related compact controls may share a row.
- At 200% text, controls and financial cards reflow or stack; typography is not reduced to preserve a column count.
- Financial amounts never clip, abbreviate unexpectedly, or detach from their currency.
- Arabic RTL and English LTR are validated independently at phone width.
- Screen-reader labels, focus order, minimum touch targets, WCAG AA contrast, reduced motion, privacy masking, and native platform affordances remain release requirements.

## 9. Delivery stages

### Stage 0 — Shared Horizon foundation

- Vendor and license Noto Sans Arabic UI and Roboto weights.
- Replace direct feature font declarations with semantic typography roles.
- Finalize Horizon surface, card, field, chip, segmented-control, header, list-row, state, and sheet primitives.
- Add gallery coverage and boundary rules before broad adoption.

### Stage 1 — Transactions

- Produce and approve Arabic and English Transactions mockups.
- Implement the gradient summary, time groups, shortcut rail, independent transaction cards, and responsive behavior.
- Preserve all existing transaction behavior.

### Stage 2 — Accounts and Categories

- Adopt collection headers, financial entity cards, CategoryIcon visuals, grouped pickers, detail states, and existing forms.
- Preserve account calculations, category mapping, merge behavior, and routes.

### Stage 3 — Planning and Reports

- Apply the light Horizon system to budgets, salary, obligations, savings, report overview, report details, previews, and schedules.
- Keep charts semantically colored and information-dense without introducing the large gradient.

### Stage 4 — Automation and assistance

- Apply the system to tracking, voice capture/review, assistant, and notifications.
- Preserve recording, review, privacy, permission, and notification behavior.

### Stage 5 — Utility surfaces

- Apply grouped navigation and task headers to More, Profile, Settings, Privacy, Security, Support, Subscriptions, and related states.

### Stage 6 — Entry experience

- Recompose authentication and onboarding last, using the light Horizon identity while preserving platform onboarding and authentication logic.

### Future stage — Dark mode

- Reintroduce dark mode only after the light system is stable across every stage.
- Dark mode requires separate visual approval and full accessibility validation; it is not bundled into the current program.

## 10. State and interaction contract

Every migrated surface must include real-content, loading, empty, error, disabled, pressed, selected, hidden-balance, large-text, RTL, and LTR states where applicable. Existing analytics, service contracts, data schemas, query ownership, storage, and route contracts remain unchanged.

Motion is restrained and task-oriented. No migration adds decorative animation as a prerequisite. Existing reduced-motion behavior remains authoritative.

## 11. Validation gates

Each stage follows the same gate:

1. Produce Arabic RTL and English LTR visual proposals at phone width.
2. Obtain explicit visual approval before production edits.
3. Use TDD for shared primitives and screen composition.
4. Run focused tests red then green.
5. Run full Jest, TypeScript, ESLint, relevant design-system/feature boundary checks, and Impeccable once after final UI edits.
6. Validate normal text and 200% text on web.
7. Validate on an authorized Android device when available; never claim Android or TalkBack validation without physical evidence.

## 12. Explicit anti-goals

- No business-logic rewrite.
- No route or deep-link deletion.
- No screen-specific copies of shared tokens or category mappings.
- No gradient on every screen.
- No card around every field or setting.
- No global privacy bypass.
- No Dark Mode work in the current stages.
- No simultaneous app-wide big-bang migration.
- No implementation stage begins before its visual proposal is approved.

