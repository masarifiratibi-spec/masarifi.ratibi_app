# Masarifi Reorganization Report

## Outcome

The approved Admin Dashboard now lives at `apps/admin-web`, the governing documents are organized under `docs`, and future application/package/infrastructure boundaries are prepared without implementation. No frontend source, asset, lockfile, or configuration content changed.

## Files Moved

### Admin application

- `.openai/hosting.json` → `apps/admin-web/.openai/hosting.json`
- `build/sites-vite-plugin.ts` → `apps/admin-web/build/sites-vite-plugin.ts`
- `worker/index.ts` → `apps/admin-web/worker/index.ts`
- `eslint.config.mjs` → `apps/admin-web/eslint.config.mjs`
- `next-env.d.ts` → `apps/admin-web/next-env.d.ts`
- `next.config.ts` → `apps/admin-web/next.config.ts`
- `package-lock.json` → `apps/admin-web/package-lock.json`
- `package.json` → `apps/admin-web/package.json`
- `postcss.config.mjs` → `apps/admin-web/postcss.config.mjs`
- `tsconfig.json` → `apps/admin-web/tsconfig.json`
- `vite.config.ts` → `apps/admin-web/vite.config.ts`
- `public/download.png` → `apps/admin-web/public/download.png`
- `public/og.png` → `apps/admin-web/public/og.png`
- `src/app/layout.tsx` → `apps/admin-web/src/app/layout.tsx`
- `src/app/page.tsx` → `apps/admin-web/src/app/page.tsx`
- `src/app/globals.css` → `apps/admin-web/src/app/globals.css`
- `src/app/admin/layout.tsx` → `apps/admin-web/src/app/admin/layout.tsx`
- `src/app/admin/page.tsx` → `apps/admin-web/src/app/admin/page.tsx`
- `src/app/admin/users/page.tsx` → `apps/admin-web/src/app/admin/users/page.tsx`
- `src/app/admin/imports/page.tsx` → `apps/admin-web/src/app/admin/imports/page.tsx`
- `src/app/admin/system-health/page.tsx` → `apps/admin-web/src/app/admin/system-health/page.tsx`
- `src/components/admin/AdminShell.tsx` → `apps/admin-web/src/components/admin/AdminShell.tsx`
- `src/components/admin/Charts.tsx` → `apps/admin-web/src/components/admin/Charts.tsx`
- `src/components/admin/ui.tsx` → `apps/admin-web/src/components/admin/ui.tsx`
- `src/data/admin/imports.ts` → `apps/admin-web/src/data/admin/imports.ts`
- `src/data/admin/overview.ts` → `apps/admin-web/src/data/admin/overview.ts`
- `src/data/admin/system-health.ts` → `apps/admin-web/src/data/admin/system-health.ts`
- `src/data/admin/users.ts` → `apps/admin-web/src/data/admin/users.ts`
- `src/lib/admin-utils.ts` → `apps/admin-web/src/lib/admin-utils.ts`
- `src/lib/admin.test.ts` → `apps/admin-web/src/lib/admin.test.ts`
- `src/types/admin.ts` → `apps/admin-web/src/types/admin.ts`

### Documentation

- `All Project_Docs/masarifi-full-product-technical-plan-v3.md` → `docs/product/masarifi-full-product-technical-plan-v3.md`
- `All Project_Docs/masarifi-admin-dashboard-full-frontend-specification-v2.md` → `docs/admin/masarifi-admin-dashboard-full-frontend-specification-v2.md`
- `Front_end/Docs/masarifi-admin-dashboard-frontend-specification.md` → `docs/admin/masarifi-admin-dashboard-frontend-specification.md`
- `Front_end/Docs/masarifi-gulf-premium-design-system-v2.1.md` → `docs/design-system/masarifi-gulf-premium-design-system-v2.1.md`
- `Front_end/ADMIN_DEMO_ROUTES.md` → `docs/admin/ADMIN_DEMO_ROUTES.md`
- `Front_end/ADMIN_DESIGN_DECISIONS.md` → `docs/admin/ADMIN_DESIGN_DECISIONS.md`
- `Front_end/ADMIN_PROTOTYPE_PLAN.md` → `docs/admin/ADMIN_PROTOTYPE_PLAN.md`
- `Front_end/ADMIN_REVIEW_CHECKLIST.md` → `docs/admin/ADMIN_REVIEW_CHECKLIST.md`
- `Front_end/masarifi-gulf-premium-design-system-v2.1.md` → `docs/design-system/masarifi-gulf-premium-design-system-v2.1-untracked-copy.md`

### Repository metadata

- `Front_end/.git/` → `.git/`
- `Front_end/.gitignore` → `.gitignore`

## Files Renamed

- The pre-existing untracked, non-identical design-system copy gained the suffix `-untracked-copy.md` to prevent it from overwriting the official tracked document.
- No approved source, asset, configuration, or governing document was renamed.

## Files Created

- `PROJECT_REORGANIZATION_PLAN.md`
- `PROJECT_STRUCTURE.md`
- `REORGANIZATION_REPORT.md`
- `README.md`
- `apps/marketing-web/README.md`
- `apps/mobile/README.md`
- `apps/api/README.md`
- `packages/shared-types/README.md`
- `packages/validation/README.md`
- `packages/api-client/README.md`
- `packages/finance-core/README.md`
- `packages/transaction-parser/README.md`
- `packages/config/README.md`
- `packages/eslint-config/README.md`
- `packages/ui-tokens/README.md`
- `apps/admin-web/specs/README.md`
- `apps/admin-web/.specify/memory/.gitkeep`
- `apps/admin-web/.specify/memory/constitution.md`
- `supabase/migrations/.gitkeep`
- `supabase/seed/.gitkeep`
- `supabase/policies/.gitkeep`
- `supabase/tests/.gitkeep`
- `docker/local/.gitkeep`
- `docker/production/.gitkeep`
- `docs/architecture/.gitkeep`
- `docs/api/.gitkeep`
- `docs/security/.gitkeep`
- `docs/deployment/.gitkeep`

## Admin Web Spec Kit Isolation

Files moved and preserved:

- `.specify/memory/.gitkeep` → `apps/admin-web/.specify/memory/.gitkeep`
- `specs/README.md` → `apps/admin-web/specs/README.md`

File created:

- `apps/admin-web/.specify/memory/constitution.md` — uninitialized Admin Web scope placeholder; no Spec Kit command was run.

Files updated:

- `apps/admin-web/specs/README.md` — now documents Admin Web-only ownership, frontend-only/backend-aligned development, the approved 10-phase plan, design preservation, and per-application isolation.
- `PROJECT_STRUCTURE.md`
- `REORGANIZATION_REPORT.md`
- `PROJECT_REORGANIZATION_PLAN.md` — historical-plan note only.

Directories removed after confirming they were empty:

- `.specify/memory`
- `.specify`
- `specs`

Final Spec Kit paths:

- `apps/admin-web/.specify/memory/constitution.md`
- `apps/admin-web/.specify/memory/.gitkeep`
- `apps/admin-web/specs/README.md`

Remaining root-level Spec Kit files: none.

Risks or unresolved issues: none. Future Mobile, API, and Marketing Spec Kit folders remain intentionally uncreated.

## Configuration and Path Changes

Only Spec Kit documentation paths changed. Admin application configuration and runtime paths remain unchanged.

The move preserved application-relative paths:

- TypeScript alias `@/*` still maps to `./src/*`.
- Public asset paths remain `/download.png` and `/og.png`.
- Vite still loads `./.openai/hosting.json` and `./build/sites-vite-plugin`.
- The worker entry remains `./worker/index.ts`.
- npm scripts still execute from the Admin application root.

## Controlled Deviations

### Workspace configuration deferred

- **Proposed:** Root pnpm workspaces and Turborepo files.
- **Selected:** Existing npm package and lockfile remain inside `apps/admin-web`; no root workspace configuration was added.
- **Reason:** One implemented app does not justify a package-manager conversion or duplicate orchestration.
- **Impact:** Admin development uses commands from `apps/admin-web`.
- **Later:** Introduce pnpm/Turborepo in a dedicated migration when a second runnable app or shared package exists.

### Git repository promoted to the project root

- **Proposed:** Preserve the existing repository while reorganizing files.
- **Selected:** Move the existing `.git` directory from `Front_end` to the project root.
- **Reason:** All apps, documents, and future workspace boundaries now remain in one repository instead of an embedded frontend-only repository.
- **Impact:** Git reports deletions and additions until the reorganization is staged, at which point rename detection can represent the moves.
- **Later:** Review and commit only when explicitly requested.

### Generated artifacts retained

- **Proposed:** Place the application under `apps/admin-web`.
- **Selected:** Move source/configuration only and leave pre-existing generated artifacts in `Front_end`.
- **Reason:** The task explicitly prohibited moving or deleting generated directories and caches.
- **Impact:** `Front_end` remains as an ignored artifact directory and is not runnable source.
- **Later:** Remove it only with explicit approval after confirming the artifacts are unnecessary.

### Non-identical design-system copy preserved

- **Proposed:** One design-system document.
- **Selected:** Keep the tracked `Docs` version as official and preserve the untracked copy under a marked filename.
- **Reason:** Their SHA-256 hashes and line counts differ; deleting either would risk data loss.
- **Impact:** Use the official filename for future frontend/mobile work.
- **Later:** Owner review may archive or remove the preserved copy.

## Validation Results

| Check | Result |
|---|---|
| `npm install` | Passed; installed from the preserved npm lockfile. |
| `npm run typecheck` | Passed with no TypeScript errors. |
| `npm run lint` | Passed with no lint errors or warnings. |
| `npm run test` | Passed: 3 tests, 0 failures. |
| `npm run build` | Passed; all existing routes compiled and prerendered. |
| `npm run build:sites` | Passed after rerunning with local process permission; first sandbox run failed with `spawn EPERM`. |
| Development server smoke test | Passed; `/`, all four Admin routes, `/download.png`, and `/og.png` returned HTTP 200. |
| Git blob integrity check | Passed: all 38 previously tracked files match their pre-move Git blobs after Git line-ending normalization. |

Verified routes:

- `/`
- `/admin`
- `/admin/users`
- `/admin/imports`
- `/admin/system-health`

## Remaining Warnings

- `npm install` reports 20 dependency advisories: 1 low and 19 high.
- npm reports deprecated transitive package `tsconfck@3.1.6`.
- npm reports four dependency install scripts pending allow-scripts review.
- The Sites build reports current vinext static-analysis limitations and classifies the existing routes as unknown, but the build completes successfully.
- No automatic audit fix or dependency upgrade was applied because that would exceed the organization-only scope and could change the approved frontend.
- Pre-existing generated artifacts remain under `Front_end`; new verification artifacts under `apps/admin-web` are ignored by the root `.gitignore`.

## Recommended Next Step

Review and stage the reorganization so Git can present rename detection, then commit it as a dedicated structure-only change. Migrate to pnpm/Turborepo separately when another runnable workspace exists; address dependency advisories in a separate tested dependency-maintenance change.
