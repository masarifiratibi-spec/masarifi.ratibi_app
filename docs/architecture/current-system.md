# System architecture

At operating source 3a2b30c3, with Play and iOS differences noted below, Expo/React Native clients read local owner-scoped data and synchronize through the NestJS API. SQLite provides mobile persistence. Device-side authentication and app lock have separate responsibilities. Clerk verifies identity, while API guards and repositories enforce the current user, staff role and permission scope. Next.js Admin calls the API using its configured identity and data mode. UI visibility alone does not authorize reads or mutations.

| Boundary | Implemented responsibility | Sources |
|---|---|---|
| Mobile | Live service adapters, offline storage and synchronization, explicit demo/test services | `apps/mobile/src/services`, `apps/mobile/src/features` |
| HTTP and jobs | NestJS API plus workers for background execution, outbox, tracking, reports, assistant and notifications. Schema changes have a separate migration entry point. | `apps/api/src/app.module.ts`, `apps/api/src/worker.module.ts`, `apps/api/src/migration.ts` |
| Identity | Clerk principal plus server permissions and database roles; platform sign-in methods differ | `apps/api/src/identity/clerk-auth.guard.ts`, `apps/admin-web/src/core/permissions` |
| Server persistence | The November 13 cutover record identifies PostgreSQL 17 and private file storage on the VPS as the write target. TLS, private access and separate worker roles are part of that evidence. | `docs/operations/2026-11-13-selfhost-migration.md`, `ops/selfhost` |
| Migration and compatibility | Versioned SQL, checksums, seeds, RLS tests and local tooling remain under `supabase/`. Runtime scope distinguishes project-server from earlier Supabase staging configuration. | `apps/api/src/platform/config/runtime-scope.ts`, `supabase/migrations` |
| Assistant and voice | Server-side gateway uses OpenRouter transport with a Google Vertex provider selection for the inspected configuration. Inspect the gateway, enabled modes and quota at the intended release. | `apps/api/src/ai/ai.gateway.ts`, `apps/api/src/ai` |
| Messaging | Android store builds select the production Firebase sender. Client notification configuration and the server's financial database serve different purposes. | Play `apps/mobile/app.config.js`, `apps/mobile/scripts/firebase-config.test.mjs` |
| Public surfaces | Admin serves public routes; static legal site tooling lives in `apps/public-legal`; the marketing directory has a placeholder README on the reviewed source lines. | `apps/admin-web`, `apps/public-legal/README.md`, [audit](../project/audit.md) |

The recorded cutover covers data and files. Backup retention, a successful restore, current public ingress, store approval and device behavior each require dated evidence for the specific environment. See [verification](../project/verification.md) for this review's checks.

## Staff and customer access

The Admin UI maps `super-admin`, `support-agent`, `billing-operator`, `import-operator`, `ai-operator`, `content-manager`, `security-administrator` to navigation and action permissions in `apps/admin-web/src/core/permissions/role-map.ts`. For a live action, the API guard reads the endpoint permission and requests a decision for the authenticated actor. Use `apps/api/src/security/admin-auth.guard.ts` and `permission-manifest.ts` to verify that decision. Customer ownership and approved temporary staff access are separate scopes. A visible route or simulated staff role is insufficient evidence of production access. Paid subscription capability is deferred even though some billing permissions and UI surfaces exist.
