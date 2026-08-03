# Masarifi Project Reorganization Plan

> **Follow-up:** The original root-level Spec Kit preparation described below was later isolated under `apps/admin-web/.specify` and `apps/admin-web/specs` by explicit user direction. See `PROJECT_STRUCTURE.md` and `REORGANIZATION_REPORT.md` for the current structure.

**Goal:** Reorganize the existing approved Admin Dashboard and project documents into the planned monorepo layout without changing frontend design, behavior, routes, dependencies, or product logic.

**Architecture:** Keep the current Next.js/npm Admin Dashboard intact as one application at `apps/admin-web`. Prepare future application, package, documentation, Supabase, Docker, and Spec Kit boundaries with documentation or empty directories only; defer pnpm/Turborepo conversion until more than one runnable workspace exists.

**Technical baseline:** Next.js App Router, React, TypeScript strict mode, Tailwind CSS, npm, and the existing Sites/Vite build adapter.

## Global Constraints

- `masarifi-full-product-technical-plan-v3.md` remains the highest-level architecture reference.
- Preserve the approved Admin Dashboard design, RTL behavior, routes, source, assets, mock data, tests, and package versions exactly.
- Do not add backend, mobile, marketing, API, Supabase, Docker service, authentication, payment, or AI implementation.
- Do not move or delete `node_modules`, `.next`, `dist`, `.wrangler`, logs, caches, or TypeScript build metadata.
- Do not initialize a new Git repository, change branches, commit, or push.
- Preserve npm and `package-lock.json`; do not introduce pnpm or Turborepo configuration during this move.

## Current Structure

```text
MASREFY _Final/
├── All Project_Docs/
│   ├── masarifi-full-product-technical-plan-v3.md
│   └── masarifi-admin-dashboard-full-frontend-specification-v2.md
└── Front_end/                         # current Git repository root
    ├── .git/
    ├── .openai/
    ├── build/
    ├── worker/
    ├── src/
    ├── public/
    ├── Docs/
    ├── package.json
    ├── package-lock.json
    ├── Next.js/TypeScript/Vite configuration
    └── generated and ignored directories/files
```

The active frontend entry points are `src/app/layout.tsx`, `src/app/page.tsx`, and the routes under `src/app/admin`. Static assets are `public/download.png` and `public/og.png`. No environment file or environment example currently exists.

## Target Structure

```text
MASREFY _Final/
├── apps/
│   ├── admin-web/                    # unchanged approved implementation
│   ├── marketing-web/README.md
│   ├── mobile/README.md
│   └── api/README.md
├── packages/
│   ├── shared-types/README.md
│   ├── validation/README.md
│   ├── api-client/README.md
│   ├── finance-core/README.md
│   ├── transaction-parser/README.md
│   ├── config/README.md
│   ├── eslint-config/README.md
│   └── ui-tokens/README.md
├── supabase/{migrations,seed,policies,tests}/
├── docker/{local,production}/
├── docs/{product,admin,design-system,architecture,api,security,deployment}/
├── .specify/memory/
├── specs/README.md
├── .git/
├── .gitignore
├── README.md
├── PROJECT_REORGANIZATION_PLAN.md
├── PROJECT_STRUCTURE.md
└── REORGANIZATION_REPORT.md
```

`Front_end/` remains temporarily with ignored generated artifacts that the brief forbids moving or deleting.

## Exact Moves

| Source | Destination |
|---|---|
| `Front_end/.git/` | `.git/` |
| `Front_end/.gitignore` | `.gitignore` |
| `Front_end/.openai/` | `apps/admin-web/.openai/` |
| `Front_end/build/` | `apps/admin-web/build/` |
| `Front_end/worker/` | `apps/admin-web/worker/` |
| `Front_end/src/` | `apps/admin-web/src/` |
| `Front_end/public/` | `apps/admin-web/public/` |
| `Front_end/package.json` | `apps/admin-web/package.json` |
| `Front_end/package-lock.json` | `apps/admin-web/package-lock.json` |
| `Front_end/next-env.d.ts` | `apps/admin-web/next-env.d.ts` |
| `Front_end/next.config.ts` | `apps/admin-web/next.config.ts` |
| `Front_end/postcss.config.mjs` | `apps/admin-web/postcss.config.mjs` |
| `Front_end/eslint.config.mjs` | `apps/admin-web/eslint.config.mjs` |
| `Front_end/tsconfig.json` | `apps/admin-web/tsconfig.json` |
| `Front_end/vite.config.ts` | `apps/admin-web/vite.config.ts` |
| `Front_end/ADMIN_*.md` | `docs/admin/` |
| `All Project_Docs/masarifi-full-product-technical-plan-v3.md` | `docs/product/masarifi-full-product-technical-plan-v3.md` |
| `All Project_Docs/masarifi-admin-dashboard-full-frontend-specification-v2.md` | `docs/admin/masarifi-admin-dashboard-full-frontend-specification-v2.md` |
| `Front_end/Docs/masarifi-admin-dashboard-frontend-specification.md` | `docs/admin/masarifi-admin-dashboard-frontend-specification.md` |
| `Front_end/Docs/masarifi-gulf-premium-design-system-v2.1.md` | `docs/design-system/masarifi-gulf-premium-design-system-v2.1.md` |
| `Front_end/masarifi-gulf-premium-design-system-v2.1.md` | `docs/design-system/masarifi-gulf-premium-design-system-v2.1-untracked-copy.md` |

## Files Remaining Unchanged

- All files under `apps/admin-web/src`, `public`, `build`, `worker`, and `.openai` keep their content unchanged.
- `package.json`, `package-lock.json`, Next.js, TypeScript, PostCSS, ESLint, Vite, and Sites configuration keep their content unchanged unless verification proves a path repair is required.
- All four governing Markdown documents keep their content unchanged.
- Generated artifacts remain physically unchanged under `Front_end`.

## Controlled Deviations

### 1. Workspace configuration deferred

- **Proposed:** Create root `package.json`, `pnpm-workspace.yaml`, and `turbo.json`.
- **Selected:** Keep the existing npm application self-contained at `apps/admin-web` and add no root package-manager configuration.
- **Why safer:** There is only one implemented workspace, it already has a tested npm lockfile, and immediate conversion adds no runtime value.
- **Future impact:** Admin development continues with npm; future mobile/API/marketing work must not assume a root workspace command yet.
- **Later migration:** Add pnpm/Turborepo once a second runnable app or shared package is introduced, then regenerate and validate a pnpm lockfile in a dedicated change.

### 2. Existing Git repository moved to the project root

- **Proposed:** The target tree only states that `.git` must be preserved.
- **Selected:** Move `Front_end/.git` to the project root.
- **Why safer:** The reorganized Admin app, documents, and future workspace boundaries remain in one repository instead of leaving an embedded frontend-only repository.
- **Future impact:** Git will show source and document relocations from their old paths; future apps can be tracked without nested repositories.
- **Later migration:** None required; review and commit the detected renames only when explicitly requested.

### 3. Generated frontend artifacts retained in the legacy location

- **Proposed:** End with the implementation entirely under `apps/admin-web`.
- **Selected:** Move implementation and configuration only; retain forbidden-to-move generated artifacts under `Front_end`.
- **Why safer:** It obeys the explicit no-move/no-delete rule and prevents a large, stale build/cache transfer.
- **Future impact:** The legacy directory is not a runnable source project and should not be used for development.
- **Later migration:** Delete the ignored legacy artifacts after explicit approval or after confirming they are no longer needed.

### 4. Non-identical design-system copy preserved

- **Proposed:** Keep one design-system document at `docs/design-system/masarifi-gulf-premium-design-system-v2.1.md`.
- **Selected:** Use the tracked `Front_end/Docs` document as the official copy and preserve the untracked, non-identical root copy with an `-untracked-copy` suffix.
- **Why safer:** No user-created content is discarded or overwritten.
- **Future impact:** Product work should use the official filename; the preserved copy is reference-only.
- **Later migration:** Diff and remove or archive the preserved copy only after owner review.

## Risks and Compatibility

- Moving Git metadata is sensitive; verify the exact source and destination first, then run Git status immediately afterward.
- npm dependencies are not moved. Verification therefore requires an install in `apps/admin-web`; the existing lockfile remains authoritative.
- Alias imports use `@/* -> ./src/*`, public asset URLs are root-relative, and all build/Sites paths are application-root-relative, so moving the application as a unit should require no source path edits.
- Hosting metadata remains with the Admin application. No deployment or external write is part of this task.

## Rollback

1. Move `.git` back from the project root to `Front_end/.git`.
2. Move Admin source, configuration, assets, and documentation back to the exact source paths listed above.
3. Remove only the new placeholder READMEs and empty preparation directories.
4. Do not touch the retained generated artifacts.
5. Confirm `git -C Front_end status` matches the pre-move state: branch `main`, tracking `origin/main`, with only the pre-existing untracked design-system copy.

## Verification

From `apps/admin-web`:

```text
npm install
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:sites
```

Then confirm Git status, final paths, route files, public assets, and the absence of source/config changes.
