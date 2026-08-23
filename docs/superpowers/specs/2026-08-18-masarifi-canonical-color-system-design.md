# Masarifi Canonical Color System Design

## Visual source of truth

The approved Home surface is the visual baseline: deep organic teal hero surfaces, quiet off-white grouped surfaces, white elevated cards, subtle borders, and restrained bronze accents. Transactions keeps its approved structure and adopts this identity through shared semantic tokens only.

## Architecture

`apps/mobile/src/design-system/tokens.ts` remains the only owner of raw colors. The canonical teal primitive ramp owns the Home hero endpoints; Horizon effect roles reference that ramp instead of defining a parallel palette. Light and dark themes compose their own Horizon surface roles from the same canonical primitives.

## Scope

- Preserve all layouts, content, navigation, filters, privacy behavior, and financial calculations.
- Preserve financial income/expense and operational status colors.
- Do not add feature-local raw colors.
- Do not alter category artwork, third-party marks, OpenMoji assets, or chart series for this change.
- Propagate the Home identity to shared consumers through semantic theme mappings.
- Keep the existing approved Home gradient limited to strong financial/brand surfaces.

## Accessibility and validation

Light and dark semantic text pairs must retain WCAG contrast: 4.5:1 for normal text and 3:1 for controls/large text. Validate token/theme tests, focused Home and Transactions tests, design-system and app-shell boundaries, typecheck, lint, and the existing bilingual visual mockups.
