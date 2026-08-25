# Home Redesign Design

## Approved visual source

The four PNGs in `new_Desinge/final_visual_mockups/000-home` define the final Arabic RTL, English LTR, default, and expanded quick-add presentation.

## Functional boundary

Home keeps `useHomeSummary`, the existing planning/tracking/profile cards, all current routes, privacy masking, loading/error/empty states, and the existing manual/voice destinations. No repository, service, permission, tracking, or financial calculation changes are allowed.

## Presentation

Home is ordered as: branded greeting header, period/account scope, financial pulse, prioritized attention, recent transactions, compact planning progress, remaining Home actions, tracking, and profile completion. Only data already supplied by current queries is rendered; unavailable mockup sample facts are not fabricated.

The center Add tab uses the approved icon-only glass chooser on Home. Manual and voice continue to open their existing routes. Other tabs retain the current Add navigation.

## States and accessibility

Arabic uses RTL composition and English uses LTR composition. Amounts retain LTR isolation and tabular numerals. Hidden values remain masked. Loading, error, empty, partial, offline, stale, review, and pending-sync states remain explicit. Every icon-only control keeps a localized accessibility label and at least a 44×44 touch target.

