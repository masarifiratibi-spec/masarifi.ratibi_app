# Masarifi Admin Prototype

## Delivered routes

- `/admin` — operational overview and attention queue
- `/admin/users` — user search, filters, states, selection, and summary drawer
- `/admin/imports` — automation metrics, failure review, details, and retry
- `/admin/system-health` — services, monitoring, incidents, and incident details

The prototype is frontend-only. Data is typed, fictional, and stored under
`src/data/admin`. Local component state simulates interactions without implying
backend persistence.

## Implementation order

1. Semantic tokens and Arabic RTL foundation
2. Responsive admin shell
3. Shared operational components
4. Overview, users, imports, and health routes
5. Responsive, theme, accessibility, and privacy verification

## Exclusions

Authentication, backend integrations, unrestricted customer records, additional
sidebar routes, and the optional presentation index are intentionally excluded.
