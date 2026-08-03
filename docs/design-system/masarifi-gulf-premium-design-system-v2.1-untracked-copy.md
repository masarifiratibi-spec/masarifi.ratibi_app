# Masarifi Gulf Premium Design System — Version 2.1

## 1. System Overview

**System name:** Masarifi Gulf Premium Design System  
**Version:** 2.1  
**Product:** Masarifi  
**Primary language:** Arabic RTL  
**Secondary language:** English LTR  
**Supported products:**

- Masarifi Mobile Application
- Masarifi Admin Dashboard
- Masarifi Marketing Website

---

# 2. Design Philosophy

## 2.1 Calm Financial Clarity

Financial values, status information, totals, warnings, and next actions must receive higher visual priority than decoration.

Every number, chart, notification, and insight should answer a useful question.

## 2.2 Premium, Not Decorative

Gold, bronze, Gulf patterns, and premium details are accents.

They must not dominate the product interface.

## 2.3 Arabic-First, Not Arabic-Adapted

The interface must be designed for RTL from the beginning.

Arabic screens must not be mirrored English screens without reviewing:

- Reading order
- Content hierarchy
- Navigation direction
- Icons
- Pagination
- Mixed-direction content
- Tables
- Charts
- Forms
- Numbers
- Currency placement

## 2.4 Helpful, Not Judgmental

The product language must guide users without blaming or shaming them for their financial behavior.

## 2.5 Privacy by Default

Customer financial data must be protected by the interface architecture.

Sensitive values must be masked, aggregated, or hidden unless access is explicitly authorized.

## 2.6 One Brand, Multiple Product Modes

The same Masarifi identity must adapt to different product contexts.

The system includes separate visual modes for:

- Customer mobile application
- Admin dashboard
- Marketing surfaces

The brand stays consistent while information density, background treatment, radius, typography, and decoration change by context.

---

# 3. Design System Architecture

The design system uses four token layers.

```text
Reference Tokens
├── color.ref.*
├── spacing.ref.*
├── radius.ref.*
├── shadow.ref.*
├── typography.ref.*
└── motion.ref.*

System Tokens
├── color.sys.background.*
├── color.sys.surface.*
├── color.sys.text.*
├── color.sys.border.*
├── color.sys.action.*
├── color.sys.status.*
├── color.sys.finance.*
├── color.sys.chart.*
└── elevation.sys.*

Product Mode Tokens
├── mobile.*
├── admin.*
└── marketing.*

Component Tokens
├── button.*
├── input.*
├── card.*
├── navigation.*
├── table.*
├── badge.*
├── dialog.*
├── drawer.*
├── chart.*
├── transaction.*
├── budget.*
├── salary.*
├── goal.*
├── debt.*
├── ai.*
└── audit.*
```

Components must not reference raw hexadecimal values directly.

Components should reference semantic or component-level tokens.

---

# 4. Brand Color Foundation

## 4.1 Masarifi Teal

Masarifi Teal is the primary brand family.

| Token | Hex | Primary Use |
|---|---|---|
| `teal-950` | `#102723` | Deep active states and dark backgrounds |
| `teal-900` | `#16332F` | Primary hover and strong dark surfaces |
| `teal-800` | `#1C3934` | Main brand and primary action |
| `teal-700` | `#244541` | Strong secondary teal |
| `teal-600` | `#315C55` | Interactive borders and selected states |
| `teal-500` | `#46756C` | Focus and secondary accents |
| `teal-400` | `#6B968D` | Charts and highlights |
| `teal-300` | `#96B8B0` | Muted indicators |
| `teal-200` | `#C1D5D0` | Soft selected backgrounds |
| `teal-100` | `#E3ECE9` | Soft teal surface |
| `teal-50` | `#F3F7F6` | Very subtle teal tint |

```css
--ref-teal-950: #102723;
--ref-teal-900: #16332F;
--ref-teal-800: #1C3934;
--ref-teal-700: #244541;
--ref-teal-600: #315C55;
--ref-teal-500: #46756C;
--ref-teal-400: #6B968D;
--ref-teal-300: #96B8B0;
--ref-teal-200: #C1D5D0;
--ref-teal-100: #E3ECE9;
--ref-teal-50: #F3F7F6;
```

### Action mapping

```css
--sys-action-primary-default: #1C3934;
--sys-action-primary-hover: #16332F;
--sys-action-primary-active: #102723;
--sys-action-primary-disabled-bg: #D9E3E0;
--sys-action-primary-disabled-text: #71817D;
--sys-action-on-primary: #FFFFFF;
```

The primary action becomes darker during hover and active states.

---

# 5. Bronze Accent Foundation

Bronze is a premium accent, not a second primary color.

| Token | Hex | Primary Use |
|---|---|---|
| `bronze-900` | `#744C2C` | Strong accent text |
| `bronze-800` | `#80552F` | Accessible accent text and icons |
| `bronze-700` | `#93663D` | Strong icon accent |
| `bronze-600` | `#BC8E60` | Hover accent |
| `bronze-500` | `#CFA47A` | Main bronze accent |
| `bronze-400` | `#D9B78F` | Decorative highlight |
| `bronze-300` | `#E2CEB7` | Soft border detail |
| `bronze-200` | `#EBDACA` | Soft premium surface |
| `bronze-100` | `#F6EADF` | Accent background |
| `bronze-50` | `#FBF6F0` | Very soft tint |

```css
--sys-accent-solid: #CFA47A;
--sys-accent-hover: #BC8E60;
--sys-accent-active: #A87446;
--sys-accent-text: #80552F;
--sys-accent-icon: #93663D;
--sys-accent-surface: #F6EADF;
--sys-accent-on-solid: #2B211A;
```

## 5.1 Approved Uses

- Premium plans
- Upgrade actions
- Salary progress highlights
- Major savings milestones
- Selected premium insight
- Small logo details
- Special celebratory states
- Main mobile quick-add action when visually justified

## 5.2 Restricted Uses

Do not use bronze for:

- Every primary button
- Every selected navigation item
- Warning states
- Error states
- Long text
- Dense table content
- Every chart
- Every icon

## 5.3 Visual Coverage Budget

Recommended maximum visual coverage:

```text
Mobile application screens: 5%
Admin screens: 2%–3%
Marketing pages: 10%–12%
```

---

# 6. Neutral Foundations

## 6.1 Mobile Warm Neutral Palette

| Token | Hex | Use |
|---|---|---|
| `warm-50` | `#FFFDFC` | Elevated surface |
| `warm-100` | `#FBF6EF` | Mobile page background |
| `warm-200` | `#F7EFE4` | Mobile subtle background |
| `warm-300` | `#F1E6D8` | Secondary warm surface |
| `warm-400` | `#E4D8C8` | Warm border |
| `warm-500` | `#D4C4B1` | Muted component |
| `warm-600` | `#C0A486` | Decoration |
| `warm-700` | `#817969` | Placeholder text |
| `warm-800` | `#554F42` | Secondary text |
| `warm-900` | `#39372E` | Strong text |
| `warm-950` | `#211F1B` | Maximum contrast |

## 6.2 Admin Neutral Palette

Admin screens use more neutral surfaces to improve data clarity.

| Token | Hex | Use |
|---|---|---|
| `admin-neutral-50` | `#FFFFFF` | Main surface |
| `admin-neutral-100` | `#FAFBFA` | Muted surface |
| `admin-neutral-200` | `#F6F7F5` | Main page background |
| `admin-neutral-300` | `#F1F3F1` | Secondary background |
| `admin-neutral-400` | `#E7E9E6` | Subtle border |
| `admin-neutral-500` | `#D4D8D3` | Default border |
| `admin-neutral-600` | `#B4BBB5` | Strong border |
| `admin-neutral-700` | `#727A74` | Tertiary text |
| `admin-neutral-800` | `#4B534E` | Secondary text |
| `admin-neutral-900` | `#202824` | Primary text |

---

# 7. Product Surface Modes

## 7.1 Mobile Application Light Mode

```css
--mobile-bg-page: #FBF6EF;
--mobile-bg-subtle: #F7EFE4;
--mobile-surface-primary: #FFFDFC;
--mobile-surface-secondary: #F1E6D8;
--mobile-surface-elevated: #FFFFFF;
```

Recommended for:

- Mobile app
- Salary
- Budgets
- Goals
- Debts
- Reports
- AI assistant

## 7.2 Admin Light Mode

```css
--admin-bg-page: #F6F7F5;
--admin-bg-subtle: #F1F3F1;
--admin-surface-primary: #FFFFFF;
--admin-surface-secondary: #FAFBFA;
--admin-surface-elevated: #FFFFFF;
```

Warm cream may still appear in:

- Empty states
- Selected AI insights
- Presentation cards
- Premium indicators
- Small branded zones

It should not be the background of every admin page.

## 7.3 Marketing Light Mode

Marketing may use stronger combinations of:

- Warm cream
- Deep teal
- Bronze
- Controlled patterns
- Large editorial typography
- Richer imagery

---

# 8. Text Colors

## 8.1 Light Mode Text

```css
--sys-text-primary: #18312C;
--sys-text-secondary: #554F42;
--sys-text-tertiary: #746D5D;
--sys-text-placeholder: #817969;
--sys-text-disabled: #8E897F;
--sys-text-inverse: #FFFFFF;
```

## 8.2 Text Rules

- Primary text is used for headings, totals, and essential values.
- Secondary text is used for descriptions and table metadata.
- Tertiary text is used for captions and low-priority metadata.
- Placeholder text never replaces a visible label.
- Disabled text must remain readable.
- Do not reduce disabled components using opacity alone.
- Text smaller than 14px must still meet required contrast.
- Avoid using bronze for body text.

---

# 9. Border System

```css
--sys-border-subtle: #E7E3DA;
--sys-border-default: #D5D1C7;
--sys-border-strong: #B8B2A6;
--sys-border-interactive: #668C84;
--sys-border-selected: #315C55;
--sys-border-focus: #2E756B;

--sys-border-width-default: 1px;
--sys-border-width-selected: 1.5px;
--sys-border-width-focus: 2px;
```

Admin-specific borders:

```css
--admin-border-subtle: #E7E9E6;
--admin-border-default: #D4D8D3;
--admin-border-strong: #B4BBB5;
```

Use borders instead of shadows for most standard cards.

---

# 10. Focus System

A two-layer focus ring must be used to remain visible over different backgrounds.

```css
--sys-focus-ring-light: #2E756B;
--sys-focus-ring-dark: #A8D4CA;
```

```css
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--sys-surface-page),
    0 0 0 4px var(--sys-focus-ring);
}
```

Requirements:

- Focus must be visible on keyboard navigation.
- Focus must not be hidden by overflow.
- Focus must remain clear on selected controls.
- Focus styling must not depend only on color change.

---

# 11. Financial Semantic Colors

Financial colors represent transaction meaning, not success or failure.

```css
--finance-income-solid: #2F7359;
--finance-income-text: #245944;
--finance-income-surface: #E8F4EE;

--finance-expense-solid: #A95A4C;
--finance-expense-text: #7D3E35;
--finance-expense-surface: #F8E8E4;

--finance-transfer-solid: #3C7187;
--finance-transfer-text: #285666;
--finance-transfer-surface: #EAF4F6;

--finance-refund-solid: #6C7D3E;
--finance-refund-text: #4F5E2D;
--finance-refund-surface: #EEF2E1;

--finance-savings-solid: #497460;
--finance-savings-text: #365847;
--finance-savings-surface: #E7EFE7;

--finance-debt-solid: #8D654E;
--finance-debt-text: #684632;
--finance-debt-surface: #F5EADF;

--finance-investment-solid: #5B668E;
--finance-investment-text: #424B72;
--finance-investment-surface: #EAECF5;
```

## 11.1 Usage Rules

- Expense must not automatically use an error icon.
- Income must not automatically use a success checkmark.
- Debt must not automatically use a warning triangle.
- Transfer must include a label or icon, not color alone.
- Financial meanings must remain understandable in grayscale.

---

# 12. System Status Colors

System status colors indicate operational state.

Each status includes:

- Solid
- Text
- Border
- Surface

## 12.1 Success

```css
--status-success-solid: #2F765D;
--status-success-text: #245944;
--status-success-border: #9CCBB8;
--status-success-surface: #E8F4EE;
```

## 12.2 Warning

```css
--status-warning-solid: #B06A12;
--status-warning-text: #7A4308;
--status-warning-border: #E2B66D;
--status-warning-surface: #FFF4DF;
```

## 12.3 Danger

```css
--status-danger-solid: #C04B45;
--status-danger-text: #842F2B;
--status-danger-border: #E6A39F;
--status-danger-surface: #FCEAE8;
```

## 12.4 Information

```css
--status-info-solid: #367184;
--status-info-text: #285666;
--status-info-border: #9BC5D0;
--status-info-surface: #EAF4F6;
```

## 12.5 Neutral

```css
--status-neutral-solid: #66726E;
--status-neutral-text: #4B5551;
--status-neutral-border: #C1C8C4;
--status-neutral-surface: #F1F3F2;
```

## 12.6 Status Rules

Every status must use:

- Color
- Icon
- Label
- Optional shape or pattern

Color must never be the only indicator.

---

# 13. Severity System

Severity is separate from general status.

```text
Info
Low
Medium
High
Critical
```

Suggested mapping:

```css
--severity-info: #367184;
--severity-low: #66726E;
--severity-medium: #A9680E;
--severity-high: #B85B2E;
--severity-critical: #A93636;
```

Severity badges must always show a visible text label.

---

# 14. Dark Mode

Dark mode uses warm neutral charcoal with controlled teal.

```css
--dark-bg-page: #111816;
--dark-bg-subtle: #151E1B;
--dark-surface-primary: #19231F;
--dark-surface-secondary: #202B27;
--dark-surface-elevated: #283530;

--dark-border-subtle: #2C3934;
--dark-border-default: #3B4A44;
--dark-border-strong: #56635E;

--dark-text-primary: #F8F0E5;
--dark-text-secondary: #D9CDBD;
--dark-text-tertiary: #AEA596;
--dark-text-placeholder: #918A7D;
--dark-text-disabled: #7F7A71;

--dark-action-primary: #79A99F;
--dark-action-primary-hover: #8FBAB1;
--dark-action-primary-active: #A8CFC7;
--dark-action-on-primary: #0F211E;

--dark-accent-solid: #D0AA7D;
--dark-accent-hover: #E0BC91;
--dark-accent-text: #E3C59F;
--dark-accent-surface: #3D342A;
--dark-accent-on-solid: #2B211A;
```

## 14.1 Dark Mode Rules

- Teal remains the main interaction color.
- Bronze remains an accent.
- Avoid pure black.
- Avoid neon colors.
- Use lower chart saturation.
- Keep data surfaces visually distinct.
- Do not use teal for every surface.
- Maintain readable financial values.
- Test all status colors independently in dark mode.

---

# 15. Typography Families

## 15.1 Product Font Stack

```css
font-family:
  "IBM Plex Sans Arabic",
  "IBM Plex Sans",
  system-ui,
  -apple-system,
  "Segoe UI",
  sans-serif;
```

This stack should be used across Arabic and English product interfaces to reduce visual mismatch.

## 15.2 Optional Marketing Font

Alexandria may be used for selected Arabic marketing headings only.

Do not use decorative fonts in:

- Dashboards
- Tables
- Forms
- Reports
- Settings
- Financial values

---

# 16. Typography Scale

## 16.1 Marketing Scale

| Style | Size | Line Height | Weight |
|---|---:|---:|---:|
| Display XL | 56px | 72px | 700 |
| Display L | 48px | 62px | 700 |
| Display M | 40px | 54px | 700 |

## 16.2 Mobile Application Product Scale

| Style | Size | Line Height | Weight |
|---|---:|---:|---:|
| H1 | 32px | 44px | 700 |
| H2 | 28px | 40px | 700 |
| H3 | 24px | 34px | 600 |
| H4 | 20px | 30px | 600 |
| H5 | 18px | 28px | 600 |
| H6 | 16px | 24px | 600 |
| Body L | 18px | 30px | 400 |
| Body M | 16px | 26px | 400 |
| Body S | 14px | 22px | 400 |
| Caption | 12px | 18px | 400 |

## 16.3 Admin Product Scale

| Style | Size | Line Height | Weight |
|---|---:|---:|---:|
| Page Title | 28px | 38px | 700 |
| Section Title | 20px | 30px | 600 |
| Card Title | 16px | 24px | 600 |
| Body | 14px | 22px | 400 |
| Body Compact | 13px | 20px | 400 |
| Table Header | 12px | 18px | 600 |
| Table Body | 14px | 20px | 400 |
| Caption | 12px | 18px | 400 |
| Metric Large | 28px | 36px | 700 |
| Metric Medium | 22px | 30px | 600 |

Avoid 11px Arabic text in operational interfaces.

## 16.4 Financial Number Styles

| Style | Size | Weight |
|---|---:|---:|
| Amount Hero | 40px | 700 |
| Amount Large | 32px | 700 |
| Amount Medium | 24px | 600 |
| Amount Small | 16px | 600 |
| Amount Table | 14px | 600 |

```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

---

# 17. Numbers, Currency, and Direction

## 17.1 Currency Rules

Currency formatting must follow the selected locale.

Examples:

```text
3,950.00 AED
3,950.00 د.إ
```

The implementation must use locale-aware formatting.

Do not manually build financial strings.

## 17.2 Decimal Rules

- Show decimals only when relevant to the selected currency.
- Maintain consistent decimal behavior within a table.
- Use tabular numbers for aligned values.
- Negative values must include a visible minus sign.
- Positive financial values may include a plus sign when useful.

## 17.3 Mixed-Direction Fields

The following values should usually use `dir="ltr"` or `dir="auto"` inside Arabic layouts:

- Email
- Phone number
- IBAN
- Transaction ID
- Version number
- Correlation ID
- API path
- Currency code
- Device identifier

---

# 18. Spacing System

Base unit: `4px`.

| Token | Value |
|---|---:|
| `space-0` | 0px |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |
| `space-30` | 120px |

## 18.1 Semantic Spacing Tokens

```css
--layout-page-padding-desktop: 32px;
--layout-page-padding-laptop: 24px;
--layout-page-padding-mobile: 16px;

--layout-section-gap: 32px;
--layout-card-gap: 16px;
--layout-grid-gap: 24px;

--component-card-padding: 20px;
--component-card-padding-compact: 16px;
--component-control-gap: 8px;
--component-field-gap: 6px;
--component-form-section-gap: 24px;
```

Use semantic spacing tokens in components instead of selecting primitive spacing values independently.

---

# 19. Border Radius

## 19.1 Reference Radius

| Token | Value |
|---|---:|
| `radius-xs` | 6px |
| `radius-sm` | 8px |
| `radius-md` | 10px |
| `radius-lg` | 12px |
| `radius-xl` | 16px |
| `radius-2xl` | 20px |
| `radius-3xl` | 24px |
| `radius-pill` | 999px |

## 19.2 Mobile Application Radius

```text
Inputs: 12px
Buttons: 12px
Small cards: 16px
Dashboard cards: 16px–20px
Hero salary card: 20px–24px
Bottom sheets: 24px top corners
```

## 19.3 Admin Product Radius

```text
Inputs: 8px–10px
Buttons: 8px–10px
Tables: 8px–12px
Cards: 12px–16px
Drawers: 16px
Dialogs: 16px
```

Admin screens should not look like enlarged mobile layouts.

---

# 20. Shadow and Elevation System

## 20.1 Reference Shadows

```css
--shadow-xs:
  0 1px 2px rgba(26, 46, 42, 0.05);

--shadow-sm:
  0 4px 12px rgba(52, 39, 27, 0.07);

--shadow-md:
  0 10px 28px rgba(52, 39, 27, 0.10);

--shadow-lg:
  0 20px 48px rgba(52, 39, 27, 0.14);
```

## 20.2 Semantic Elevation

```css
--elevation-base: none;
--elevation-raised: var(--shadow-xs);
--elevation-floating: var(--shadow-sm);
--elevation-overlay: var(--shadow-md);
--elevation-modal: var(--shadow-lg);
```

Recommended mapping:

- Normal card: border only
- Sticky toolbar: raised
- Dropdown: floating
- Drawer: overlay
- Dialog: modal
- Toast: floating or overlay

Do not apply shadows to every card.

---

# 21. Layout Grid


## 21.1 Admin Dashboard

```text
Canvas: 1440px
Sidebar: 264px
Compact sidebar: 76px
Topbar: 64px
Content max width: 1600px
Columns: 12
Gutter: 20px–24px
Page padding: 24px–32px
```

## 21.2 Tablet

```text
Columns: 8
Gutter: 20px
Page padding: 24px
```

## 21.3 Mobile

```text
Columns: 4
Gutter: 16px
Page padding: 16px
```

---

# 22. RTL and Bidirectional Rules

## 22.1 Layout Direction

Arabic:

- Sidebar on the right
- Primary reading order from right to left
- Navigation groups aligned to start
- Page actions placed according to importance and reading flow

English:

- Sidebar on the left
- Reading order from left to right

## 22.2 Logical CSS

Use logical properties:

```css
margin-inline-start
margin-inline-end
padding-inline-start
padding-inline-end
border-inline-start
border-inline-end
inset-inline-start
inset-inline-end
```

Avoid direction-specific layout rules when logical properties can be used.

## 22.3 Icons

Mirror icons only when they communicate direction.

Examples that may mirror:

- Back
- Forward
- Next
- Previous
- Chevron navigation

Examples that should not mirror automatically:

- Play
- Download
- Search
- Settings
- Calendar
- External link
- Brand icons

## 22.4 Tables and Charts

- Table reading order follows the selected language.
- Financial numbers may remain LTR within RTL cells.
- Chart axes must be reviewed for RTL.
- Legends should follow reading direction.
- Tooltip content must preserve number direction.
- Pagination order must be tested in both languages.

---

# 23. Icon System

Direction:

- Outline icons
- Rounded line caps
- Consistent visual weight
- Minimal detail
- Universal product symbols
- No forced Gulf decoration

Recommended sizes:

| Use | Size |
|---|---:|
| Compact table actions | 16px |
| Inputs and navigation | 20px |
| Standard actions | 24px |
| Category cards | 28px |
| Feature highlights | 32px |

Recommended stroke:

```text
1.75px–2px
```

Colored icons should usually sit inside a soft tinted surface.

---

# 24. Illustration and Pattern System

## 24.1 Allowed Illustration Themes

- Light 3D illustrations
- Wallets
- Saving jars
- Goals
- Travel
- Home ownership
- Plants
- Controlled Gulf geometry
- Seasonal lanterns

## 24.2 Rules

- Avoid realistic 3D objects inside data-heavy screens.
- Avoid landmarks inside normal product screens.
- Use skyline visuals mainly in marketing.
- Lanterns are seasonal.
- Patterns must never reduce readability.

## 24.3 Pattern Usage

Recommended locations:

- Cover
- Splash
- Onboarding
- Empty states
- Premium cards
- Selected AI insight cards
- Marketing backgrounds

Constraints:

```text
Opacity: 3%–8%
Maximum component coverage: 20%–30%
Never behind small text
Never inside dense tables
Never on every card
```

---

# 25. Button System

## 25.1 Variants

- Primary
- Secondary
- Tertiary
- Quiet
- Destructive
- Premium

## 25.2 Primary Button

```text
Background: teal-800
Hover: teal-900
Active: teal-950
Text: white
```

## 25.3 Secondary Button

```text
Background: transparent or surface
Border: teal-600
Text: teal-800
```

## 25.4 Tertiary Button

```text
Background: transparent
Text: teal-800
Soft hover surface
```

## 25.5 Quiet Button

Used for:

- Table actions
- Inline actions
- Secondary utilities

## 25.6 Destructive Button

Use muted red in normal states.

Use stronger red inside the final confirmation step.

## 25.7 Premium Button

Reserved for:

- Upgrade
- Paid feature
- Premium plan
- Exclusive capability

It must not replace normal primary actions.

## 25.8 Button Sizes

```text
Compact: 36px
Default Admin: 40px
Comfortable Mobile Form: 44px
Mobile: 48px
```

Required states:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Icon-only

---

# 26. Input System

## 26.1 Input Sizes

```text
Compact Admin: 36px
Default Admin: 40px
Comfortable Desktop: 44px
Primary Mobile Controls: 48px
```

## 26.2 Default Input Style

```text
Surface: white or warm-50
Border: default border
Focus: teal focus ring
Label: visible above field
Helper: below field
Error: text + icon + border
```

Required types:

- Text
- Password
- Search
- Amount
- Currency
- Date
- Date range
- Account selector
- Category selector
- Phone
- OTP
- File upload
- Combobox
- Multi-select
- Tags
- Textarea
- Code or JSON input

---

# 27. Data Density System

Admin products require multiple density modes.

## 27.1 Table Density

```text
Compact row: 40px
Default row: 48px
Comfortable row: 56px
```

## 27.2 Filter Density

```text
Compact controls: 36px
Default controls: 40px
```

## 27.3 Rules

- Do not make every table compact by default.
- Allow density preference where appropriate.
- Maintain 44px touch targets on touch devices.
- Do not hide essential actions in hover-only behavior.

---

# 28. Core Mobile Application Components

The mobile application component library includes:

- Financial Summary Card
- Hero Salary Card
- Transaction Row
- Budget Card
- Savings Goal Card
- Debt Card
- Account Card
- Report Card
- AI Insight Card
- Quick Add
- Import Source Card
- Category Selector
- Spending Breakdown
- Salary Cycle Progress

---

# 29. Core Admin Components

The admin product library must include:

- Application shell
- Sidebar
- Topbar
- Breadcrumbs
- Page header
- Global search
- Date range selector
- Environment selector
- Metric card
- Trend card
- Data table
- Table toolbar
- Filter toolbar
- Saved filters
- Pagination
- Bulk-action toolbar
- Column manager
- Status badge
- Severity badge
- Role badge
- Health indicator
- Queue indicator
- Tabs
- Drawer
- Dialog
- Confirmation dialog
- Temporary-access dialog
- Timeline
- Activity feed
- Audit row
- Notes panel
- Internal comment
- Attachment
- Masked field
- Code preview
- JSON preview
- Permission matrix
- Empty state
- Skeleton
- Error state
- Access-denied state
- Banner
- Toast
- Stepper

Each component must define:

- Anatomy
- Variants
- Sizes
- States
- Responsive behavior
- RTL behavior
- Accessibility behavior
- Content rules
- Token mapping

---

# 30. Financial Summary Card

Contains:

- Label
- Main value
- Currency
- Trend
- Comparison period
- Optional icon
- Optional progress

Variants:

- Income
- Expense
- Remaining salary
- Savings
- Debt
- Neutral

Use financial semantic colors, not system status colors.

---

# 31. Hero Salary Card

Contains:

- Current salary cycle
- Remaining salary
- Total salary
- Progress
- Days until next salary
- Daily spending recommendation
- Optional Gulf pattern

Recommended style:

```text
Background: controlled teal gradient
Text: cream or white
Progress fill: bronze
Pattern opacity: 4%
Radius: 20px–24px
```

---

# 32. Transaction Row

Contains:

- Category icon
- Merchant or title
- Date
- Account
- Amount
- Status
- Source
- More menu

Formatting examples:

```text
Expense: −120.00 AED
Income: +5,000.00 AED
Transfer: label + icon
Pending: visible status badge
```

Expense must not look like a system error.

---

# 33. Budget Card

Contains:

- Category icon
- Category name
- Used amount
- Limit
- Percentage
- Progress bar
- Remaining amount
- Warning state

Thresholds:

```text
0%–69%     Normal
70%–89%    Warning
90%–99%    High
100%+      Exceeded
```

Always pair state color with an icon or label.

---

# 34. Savings Goal Card

Contains:

- Goal image or icon
- Goal name
- Current amount
- Target amount
- Percentage
- Deadline
- Suggested contribution
- Add contribution action

Bronze may be used for significant milestones, not for all progress states.

---

# 35. Debt Card

Contains:

- Debt title
- Total amount
- Paid amount
- Remaining amount
- Next installment
- Due date
- Status
- Record payment action

Debt is a financial category, not automatically a warning state.

---

# 36. AI Insight Card

Recommended style:

- Cream or soft teal background
- Small sparkle icon
- Clear title
- Short insight
- Supporting amount
- Recommendation
- View-details action

Avoid:

- Permanent glow
- Neon gradients
- AI visual noise
- Long assistant messages inside compact cards

---

# 37. Navigation

## 37.1 Mobile Bottom Navigation

Maximum five items:

- الرئيسية
- المعاملات
- إضافة
- الميزانيات
- المزيد

The center action may use bronze when visually justified.


## 37.2 Admin Sidebar

Use:

- Neutral surfaces
- Reduced decoration
- Minimal bronze
- Strong hierarchy
- Grouped navigation
- Clear selected states
- Permission-aware visibility

---

# 38. Chart System

## 38.1 Categorical Palette

```css
--chart-category-1: #246B62;
--chart-category-2: #4B69A2;
--chart-category-3: #9A6847;
--chart-category-4: #7B6A9A;
--chart-category-5: #6C7D3F;
--chart-category-6: #B65454;
```

## 38.2 Sequential Teal Palette

```css
--chart-teal-1: #E3EFEC;
--chart-teal-2: #BAD7D0;
--chart-teal-3: #83B6AA;
--chart-teal-4: #4F8F82;
--chart-teal-5: #246B62;
--chart-teal-6: #123E39;
```

## 38.3 Diverging Palette

```css
--chart-negative: #B65454;
--chart-neutral: #D8D3C8;
--chart-positive: #34745D;
```

## 38.4 Alert Palette

```css
--chart-success: #34745D;
--chart-warning: #AA6B13;
--chart-danger: #B84B47;
--chart-info: #39788C;
```

## 38.5 Chart Rules

- Maximum 5 categories in donut charts.
- Group remaining categories under Other.
- Maximum 4 lines in standard line charts.
- Use line thickness and dash style in addition to color.
- Use direct labels when possible.
- Use soft grid lines.
- Avoid 3D charts.
- Avoid decorative gradients.
- Avoid auto-moving charts.
- Do not use tooltips as the only way to read values.
- Provide text summaries for accessibility.
- Test charts in grayscale and color-blind simulation.

---

# 39. Motion System

## 39.1 Durations

```text
Micro interaction: 100ms–140ms
Control state: 140ms–180ms
Dialog: 180ms–220ms
Drawer: 200ms–240ms
Page content: 180ms–240ms
Large marketing transition: up to 320ms
```

## 39.2 Easing

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-enter: cubic-bezier(0, 0, 0, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

## 39.3 Approved Motion

- Fade
- Small slide
- Progress animation
- Limited number count-up
- Drawer transition
- Bottom-sheet transition
- Card expansion

## 39.4 Avoid

- Excessive bounce
- Admin dashboard parallax
- Permanent AI glow
- Replaying chart animation after every small filter
- Count-up on every page visit
- Layout shifts during loading

Support `prefers-reduced-motion`.

---

# 40. Loading and State System

Every major component and page should support relevant states.

## 40.1 Component States

```text
Default
Hover
Focus
Active
Selected
Disabled
Loading
Success
Warning
Error
Empty
Skeleton
```

## 40.2 Page States

- Initial loading
- Refreshing
- Empty
- Filtered empty
- Error
- Partial error
- Access denied
- Session expired
- Maintenance
- Offline
- Success confirmation

Skeletons must preserve the final layout structure to avoid visual jumps.

---

# 41. Accessibility Requirements

- Minimum normal text contrast: 4.5:1
- Minimum large text contrast: 3:1
- Minimum touch target: 44×44px
- Visible keyboard focus
- Semantic HTML
- Correct labels
- Logical tab order
- Reduced motion
- Screen-reader text
- Accessible dialogs
- Status labels beyond color
- Text summary for charts
- Font scaling support
- Destructive-action confirmation
- Clear error recovery
- Proper RTL order
- No hover-only essential actions
- Do not rely on placeholder text as a label
- Do not use opacity alone for disabled states

---

# 42. Privacy and Sensitive Data UI

Sensitive fields include:

- Account number
- IBAN
- Salary
- Debt amount
- Transaction history
- Raw SMS
- Raw notifications
- Bank statement
- AI conversation
- Support attachments
- Device identifiers

Required behaviors:

- Mask by default
- Reveal only when authorized
- Show access reason
- Show access expiration
- Record access action
- Add visible audit indicator
- Support copy restrictions where required
- Use confirmation for reveal actions
- Avoid exposing sensitive values in page titles or browser history

---

# 43. Admin-Specific Token Namespace

```css
--admin-sidebar-width: 264px;
--admin-sidebar-compact-width: 76px;
--admin-topbar-height: 64px;
--admin-page-max-width: 1600px;
--admin-content-padding: 24px;

--admin-table-row-compact: 40px;
--admin-table-row-default: 48px;
--admin-table-row-comfortable: 56px;
--admin-table-header-height: 44px;

--admin-filter-height-compact: 36px;
--admin-filter-height-default: 40px;

--admin-card-radius: 14px;
--admin-control-radius: 9px;
--admin-dialog-radius: 16px;
```

---

# 44. Token Naming Convention

Use consistent token naming.

## 44.1 Reference

```text
--ref-teal-800
--ref-bronze-500
--ref-space-4
--ref-radius-lg
```

## 44.2 System

```text
--sys-surface-page
--sys-surface-card
--sys-text-primary
--sys-border-default
--sys-action-primary-default
--sys-status-warning-text
--sys-finance-expense-text
```

## 44.3 Product Mode

```text
--mobile-bg-page
--admin-bg-page
--marketing-bg-hero
```

## 44.4 Component

```text
--button-primary-bg
--button-primary-text
--input-border-focus
--table-row-height
--badge-warning-bg
```

---

# 45. Responsive Behavior

## 45.1 Desktop

- Full sidebar
- Multi-column dashboards
- Persistent filters
- Full tables
- Drawers
- Dense operational layout

## 45.2 Laptop

- Compact sidebar option
- Reduced horizontal padding
- Responsive columns
- Overflow actions

## 45.3 Tablet

- Sidebar drawer
- Two-column cards
- Filter drawer
- Reduced table columns
- Touch-friendly actions

## 45.4 Mobile

Mobile application:

- Bottom navigation
- Single-column cards
- Quick add
- Mobile-first inputs

Admin product:

- Monitoring and urgent actions only
- Incident summaries
- User search
- Ticket approvals
- Health overview
- Desktop-required notice for complex configuration

---

# 46. Implementation Order

## Phase 1 — Foundations

Create:

- Brand colors
- Customer neutrals
- Admin neutrals
- Semantic statuses
- Financial semantics
- Typography
- Spacing
- Radius
- Borders
- Elevation
- Icons
- Charts
- Motion
- Light mode
- Dark mode
- RTL rules

## Phase 2 — Product Modes

Create:

- Mobile application theme
- Admin dashboard theme
- Marketing theme

## Phase 3 — Core Components

Create:

- Buttons
- Inputs
- Cards
- Badges
- Navigation
- Dialogs
- Drawers
- Tables
- Filters
- Charts
- Empty states
- Loading states

## Phase 4 — Mobile Application Components

Create:

- Salary
- Transactions
- Budgets
- Debts
- Goals
- Reports
- AI insights

## Phase 5 — Admin Components

Create:

- App shell
- Data tables
- Metrics
- Statuses
- Audit timeline
- Permission controls
- Health indicators
- Queue indicators
- Masked data
- JSON previews

## Phase 6 — Screen Validation

Validate:

- Arabic RTL
- English LTR
- Light mode
- Dark mode
- Desktop
- Laptop
- Tablet
- Mobile
- Accessibility
- Contrast
- Density
- Privacy

---

# 47. Foundations Board Deliverable

The first design deliverable should contain:

- Brand palette
- Mobile application light palette
- Admin light palette
- Dark palette
- Text colors
- Borders
- Status colors
- Financial colors
- Chart palettes
- Typography scales
- Financial number styles
- Spacing
- Radius
- Shadows
- Elevation
- Icon rules
- Motion
- RTL examples
- Contrast examples
- Gold usage examples
- Correct and incorrect examples

---

# 48. Final Design Decisions

The following decisions are mandatory for Version 2.1:

1. Deep teal remains the core Masarifi identity.
2. Bronze remains a limited premium accent.
3. The mobile application and Admin Dashboard use separate surface modes.
4. Admin pages use neutral backgrounds and higher information density than the mobile application.
5. Teal remains the primary interaction color in light and dark modes.
6. Financial meaning is separate from system status.
7. Status colors use separate solid, text, border, and surface tokens.
8. Chart colors use categorical, sequential, diverging, and alert palettes.
9. Arabic RTL behavior is defined at the system level.
10. Product components use semantic tokens instead of raw colors.
11. Admin components have dedicated density and layout tokens.
12. Accessibility and privacy are foundational requirements, not later enhancements.

---

# 49. Final Recommendation

Adopt this system under the name:

> **Masarifi Gulf Premium Design System — Version 2.1**

The recommended next task is to build the complete Foundations Board before creating production-level components or screens.

The first screens used to validate the new system should be:

1. Mobile Application Home
2. Admin Platform Overview

These two screens will prove that the same brand can support both:

- A warm and human mobile experience
- A neutral and data-dense operational experience
