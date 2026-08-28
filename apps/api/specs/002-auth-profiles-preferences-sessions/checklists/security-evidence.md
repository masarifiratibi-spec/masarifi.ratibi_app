# Security Evidence — SPEC-BE-002

| Gate | Local evidence | State |
|---|---|---|
| Forced RLS / least grants / Admin denial | `supabase test db`: 8 files, 308 tests | Pass 2026-08-28 |
| Official Clerk verification | `clerk-token-boundary`, `clerk-webhook.contract`, `clerk-webhook-boundary` | Pass locally |
| Push HMAC/AES-GCM | `push-token.crypto.spec.ts` | Pass locally |
| Safe response/log/metric projection | identity security suites plus logger/metrics unit tests | Pass locally |
| Dependency audit | `npm audit --audit-level=high`: 0 vulnerabilities | Pass 2026-08-28 |
| Repository/history/image secret scan | Worktree files: 0; Git-history matches: 0; container secret suite passed without printing values | Pass 2026-08-28 |
| SAST and container image | TypeScript + ESLint pass; release image 4 suites/9 tests, non-root/read-only/no-dev-dependency/no-baked-secret checks | Pass 2026-08-28 |
| Application security suites | Live local `npm run verify`: 9 suites, 50 tests | Pass 2026-08-28 |
| Provider-backed replay/owner matrix | Protected credentials unavailable locally | Blocked |

No local pass substitutes for the unresolved SMS-country, native-app identifiers, hosted Supabase integration, real test identities, remote CI, SBOM, image signature, or provenance gates.
