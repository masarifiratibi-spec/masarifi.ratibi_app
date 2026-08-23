# Home Balance Card Design

## Scope

Redesign the existing Home balance hero in the Masarifi mobile app. Preserve the approved Home header, all financial calculations, period and account scope behavior, privacy masking, navigation, localization, and dark-theme behavior.

## Ownership

`FinancialPulse` remains the canonical shared hero surface. It owns the dark-teal container, balance hierarchy, divider, spacing, and restrained orbit decoration. `HomeSummary` continues to provide real Home summary values and owns the three Home-specific metric cards. No competing Home-only financial hero or new summary model is introduced.

## Visual Direction

Use an organic-premium Masarifi direction built entirely from existing semantic tokens: a dark-teal hero, rounded geometry, generous spacing, soft inset stat surfaces, semantic income and expense colors, and restrained bronze orbit lines. Avoid gradients, heavy shadows, raw feature-level colors, fabricated content, and decorative noise.

The reading order is:

1. Total-balance label with a shared information icon.
2. Balance and currency as one responsive financial unit.
3. Estimated or recorded supporting description.
4. Low-contrast divider.
5. Income, expenses, and active-account metrics.

## Balance Composition

The balance is the strongest element. It uses tabular numerals and responsive hero typography while retaining the current formatter and masking state. The currency stays visually attached to the amount and the complete value uses LTR financial ordering inside both Arabic and English layouts. Long values may wrap or scale within the existing responsive typography rules, but the currency must never be positioned independently.

The total-balance label and description align to the reading edge. The existing privacy press target continues to reveal a masked card without changing the global preference.

## Metric Cards

The lower region contains three inset cards that visually belong to the hero. Each card includes a shared semantic icon in a soft circular treatment, a localized label, and its real value.

- Income uses the shared trending-up icon and income semantic color.
- Expenses uses the shared trending-down icon and expense semantic color.
- Active Accounts uses the shared accounts icon and inverse/neutral treatment.

At normal text scale, the cards use one row. LTR physical order is Income, Expenses, Active Accounts. RTL uses the mirrored physical structure so the Arabic reading order is Active Accounts, Expenses, Income from right to left.

At 200% text or when the current large-text threshold is reached, cards stack vertically. Typography is not reduced to force three columns. The stacked order follows the locale's reading sequence and retains the same hierarchy, colors, and icons.

## Responsive and Theme Behavior

Use existing spacing, radius, typography, and semantic theme tokens. Avoid fixed card widths. Flexible children, controlled wrapping, and a normal-scale row provide phone and web adaptation; the large-text vertical stack prevents clipping. The dark theme uses the same semantic token roles rather than light-only raw colors.

The decorative orbit remains absolutely positioned inside the clipped hero and is inaccessible. It must not affect layout, touch handling, or focus order.

## Accessibility

Keep the existing aggregated balance accessibility label and reveal behavior. Each metric remains independently accessible with its localized label and unmasked numeric value or the shared hidden-value label. Decorative icons and orbit lines are excluded from accessibility. RTL/LTR visual order must agree with focus order.

## Testing

Use TDD. Focused tests must fail before production changes and then prove:

- the canonical `FinancialPulse` renders the stronger hierarchy and orbit treatment;
- the Home hero renders three inset metric cards with shared icons;
- income and expense use their semantic colors;
- normal text uses a single responsive row with correct RTL/LTR structure;
- 200% text stacks metrics vertically without reducing typography;
- the amount and currency remain one formatted unit;
- masked balances and metrics remain masked through the existing privacy owner;
- Home header, queries, navigation, and transaction content remain unchanged.

After focused tests pass, run the full Jest suite, typecheck, lint, design-system/core-finance boundaries, and the Impeccable detector once. Perform one bounded Arabic/English web comparison against the supplied reference and one confirmation pass after any batched visual corrections. Android validation runs only when `adb devices -l` reports an authorized device; otherwise report the gate without claiming physical Android or TalkBack coverage.
