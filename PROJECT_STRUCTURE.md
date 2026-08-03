# Masarifi Project Structure

## Repository Map

```text
MASREFY _Final/
├── apps/
│   ├── admin-web/                 # approved Next.js Admin Dashboard
│   │   ├── .specify/memory/
│   │   │   ├── .gitkeep
│   │   │   └── constitution.md
│   │   ├── specs/README.md
│   │   ├── src/
│   │   └── package.json
│   ├── marketing-web/README.md    # future application boundary
│   ├── mobile/README.md           # future application boundary
│   └── api/README.md              # future application boundary
├── packages/
│   ├── shared-types/README.md
│   ├── validation/README.md
│   ├── api-client/README.md
│   ├── finance-core/README.md
│   ├── transaction-parser/README.md
│   ├── config/README.md
│   ├── eslint-config/README.md
│   └── ui-tokens/README.md
├── supabase/
│   ├── migrations/
│   ├── seed/
│   ├── policies/
│   └── tests/
├── docker/
│   ├── local/
│   └── production/
├── docs/
│   ├── product/
│   ├── admin/
│   ├── design-system/
│   ├── architecture/
│   ├── api/
│   ├── security/
│   └── deployment/
├── Front_end/                     # retained ignored artifacts only
├── .git/
├── .gitignore
├── README.md
├── PROJECT_REORGANIZATION_PLAN.md
├── PROJECT_STRUCTURE.md
└── REORGANIZATION_REPORT.md
```

## Main Folders

| Path | Purpose |
|---|---|
| `apps/admin-web` | Existing approved Admin Dashboard implementation, npm package, public assets, tests, Sites build configuration, and isolated Admin Web Spec Kit area. |
| `apps/admin-web/.specify/memory` | Admin Web-only Spec Kit memory and uninitialized constitution placeholder. |
| `apps/admin-web/specs` | Future Admin Web frontend specifications only. |
| `apps/marketing-web` | Reserved for the future public Next.js marketing application. |
| `apps/mobile` | Reserved for the future shared React Native/Expo mobile application. |
| `apps/api` | Reserved for the future shared NestJS modular-monolith API. |
| `packages` | Reserved shared-package boundaries. Each README states the future responsibility; no package implementation exists. |
| `docs/product` | Highest-level product and technical plan. |
| `docs/admin` | Admin specifications, prototype notes, route guide, decisions, and review checklist. |
| `docs/design-system` | Approved Masarifi Gulf Premium Design System plus a preserved non-identical copy awaiting review. |
| `docs/architecture` | Reserved for future architecture records. |
| `docs/api` | Reserved for future API documentation. |
| `docs/security` | Reserved for future security documentation. |
| `docs/deployment` | Reserved for future deployment documentation. |
| `supabase` | Marker-only preparation folders for future migrations, seed data, policies, and tests. |
| `docker` | Marker-only preparation folders for future local and production container definitions. |
| `Front_end` | Legacy generated artifacts retained because the task prohibited moving or deleting them. It is not the application source location. |

## Admin Dashboard

Location:

```text
apps/admin-web/
```

Existing routes:

```text
/
/admin
/admin/users
/admin/imports
/admin/system-health
```

Run locally:

```powershell
cd apps/admin-web
npm install
npm run dev
```

Quality and production checks:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:sites
```

The npm lockfile remains authoritative. There is intentionally no root workspace command yet.

## Project Documents

| Document | Location |
|---|---|
| Full product and technical plan v3 | `docs/product/masarifi-full-product-technical-plan-v3.md` |
| Full Admin frontend specification v2 | `docs/admin/masarifi-admin-dashboard-full-frontend-specification-v2.md` |
| Admin frontend screen specification | `docs/admin/masarifi-admin-dashboard-frontend-specification.md` |
| Approved design system v2.1 | `docs/design-system/masarifi-gulf-premium-design-system-v2.1.md` |

Use the approved design-system filename above as the source of truth. The `-untracked-copy.md` file is preserved only because it differs from the tracked official document.

## Known Placeholders

- Future app folders contain README files only.
- Shared package folders contain README files only.
- Supabase and Docker subfolders contain only `.gitkeep` markers.
- `apps/admin-web/.specify/memory` contains the preserved `.gitkeep` marker and an uninitialized `constitution.md` placeholder.
- `apps/admin-web/specs` contains only its Admin Web scope README.
- `docs/architecture`, `docs/api`, `docs/security`, and `docs/deployment` contain only `.gitkeep` markers.
- No numbered Spec Kit feature folders exist.
- No root-level `.specify` or `specs` folder exists.

## Intentionally Not Implemented

- Root pnpm workspace or Turborepo configuration
- Marketing website, mobile application, or backend
- Shared package code or extracted Admin components
- Supabase migrations, policies, credentials, or integration
- Dockerfiles, Compose services, or backend containers
- Real authentication, permissions, API calls, payments, AI, or customer data
- New Admin pages, routes, features, or visual changes

Add pnpm/Turborepo only when a second runnable application or real shared package makes a workspace useful.
