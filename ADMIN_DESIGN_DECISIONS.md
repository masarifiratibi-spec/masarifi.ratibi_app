# Admin Design Decisions

## Visual system

Neutral admin surfaces keep dense operational information legible. Teal is the
main interaction color; bronze is limited to premium-plan and secondary chart
accents. Most cards use borders rather than shadows.

## RTL

Arabic is the document default. Layout uses logical inline properties, while
emails, IDs, versions, service names, percentages, and latency values explicitly
retain LTR direction.

## Responsive data

Desktop and laptop views use semantic tables. Below tablet width, users and
failed imports become priority card lists, preserving touch targets and moving
secondary fields into drawers.

## Privacy

Mock identities are fictional, emails and user IDs are masked, and import
examples contain only sanitized extraction summaries. No balances, salary,
debt, raw messages, account numbers, or transaction histories are present.

## Charts and semantics

Charts use responsive containers and include screen-reader summaries. Financial
meaning and operational status remain separate; every status includes text and
an icon instead of relying on color.

## Future API integration

Page components consume typed serializable records from dedicated data modules.
Replacing those imports with server-fetched data will not require changing the
presentation components.
