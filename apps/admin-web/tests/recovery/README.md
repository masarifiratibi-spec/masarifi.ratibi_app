# Recovery verification against local HTTP and SQL

This test fixture mounts the production feature components, API client and shell against the real selected Nest controllers, services and repositories. MSW is disabled. Next routing/images and Clerk identity are explicit test boundaries. The actual Next shell has a separate Playwright configuration. This fixture does not establish deployed authentication or provider acceptance.

Use only the existing plan-owned PostgreSQL cluster at `127.0.0.1:55442`. The preparation script checks its exact data directory, clones the source-fresh database only when the browser database is absent, and verifies migration history. It never resets an existing database. The HTTP server requires `MASARIFI_RECOVERY_HTTP_TEST=1`, the exact disposable database name and a loopback listener. Its synthetic principal is deliberately not a production credential. External effects are disabled.

From `apps/admin-web`:

```powershell
node tests/recovery/prepare-db.mjs
$env:MASARIFI_RECOVERY_BROWSER_OUTPUT='../../.superpowers/sdd/2026-10-23-admin-dashboard-recovery/new-shell-receipt'
node node_modules/@playwright/test/cli.js test --config playwright.recovery-shell.config.ts tests/e2e/recovery-shell.spec.ts --project desktop-1440 --project mobile-390
$env:MASARIFI_RECOVERY_BROWSER_OUTPUT='../../.superpowers/sdd/2026-10-23-admin-dashboard-recovery/new-live-receipt'
node node_modules/@playwright/test/cli.js test --config playwright.recovery-live.config.ts
```

The shell check populates the approved Next font cache consumed by the HTTP fixture. Use a fresh output directory for each run to preserve earlier results. Ports are 43167 (Next), 43168 (feature fixture) and 43169 (test API). Reuse flags are opt-in for an already verified fixture process. The 200% check emulates desktop reflow with a 640 CSS-pixel viewport and double DPR; it does not claim physical-device or native browser zoom acceptance.

The journeys cover real support creation, staff replies/private notes, owner follow-up, assignment and lifecycle; filters beyond the first25; customer suspension/reactivation and immutable audit pagination; bootstrap failure/retry; explicit live authority; Arabic/English and light/dark at1440/1280/768/390. Read the final recovery evidence report for native PostgreSQL/Supabase and hosted-provider limitations.
