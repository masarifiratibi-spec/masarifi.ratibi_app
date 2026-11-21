# Production core release package â€” 5 November 2026

Status: preparation and isolated qualification; **NOT DEPLOYED / NOT PRODUCTION READY**.

Backend/SQL source: `97e66588b2b516ae8c67e285f8439be591439dd6`. Customer mobile source: `2d8b5dfefedecd62ff8c48b01c12f89dfee43867`; its changes do not alter backend image inputs. This package is separate from the canonical fresh-install migration chain. The original 174-row hosted history is immutable. Never stamp missing historical migrations, run `migration up` / `db push`, or replace the database with the qualified clone.

See [the exact deployment and recovery order](deployment-runbook.md). Current qualification metadata and the completed signing matrix belong to this package; private runtime values and keys remain outside Git. Production approval is still required before hosted execution or the primary signer transition.

## Qualified database corrections

`forward-manifest.json` pins the five exact SQL inputs and their order. Every input requires an external transaction, frozen metadata, PostgreSQL 17.6 and the migration advisory lock. Executor qualification used actual `postgres` session/current identity with NOSUPERUSER; DDL uses the existing migration role, followed by exact grantor-specific membership restoration. `apply-forward.sql` adds an atomic transaction and unchanged-history/role-graph checks around the five inputs. The combined transaction was qualified on the current isolated restore by reconstructing the frozen precursor inside a rollback-only fixture; the resulting entire catalog matched the starting corrected catalog and original data/history/memberships remained equal.

1. Add only the three missing compatibility helpers.
2. Correct malformed transfer-fee validation and reminder timestamp handling.
3. Insert owner context into the retained finalizer chain without removing its date/correlation layers. Owner identity comes only from a valid server lease. Inner wrappers remain owner-only.
4. Apply existing salary date-edit reconciliation, currency-separated assistant ordering and exact committed compensation lookup.
5. Add explicit production installation consent; preserve DEV installations/cohorts and older callers. No read enrolls an installation.

Current-clone witnesses include 18 owner-context cases, 23 semantic cases, 40 complete production Tracking cases and 43 ledger/guarded-compensation cases. The last witness creates an actual guarded refund, exhausts the original amount through a second actual refund, then recovers its exact committed original UUID/version without a new ledger effect. Every fixture rolls back and original logical data/history/membership fingerprints remain equal.

The final mobile source also closes interrupted cleanup and offline consent findings from independent review: latest intent is durable before network/local writes; cold cleanup resumes native erasure without reopening capture; a durable database-purge-ready phase follows audio/native removal and permits WAL/key recovery. Final checks: 611 suites / 4,889 mobile tests, 88 native tests, types and changed-file lint passed. Actual customer device acceptance remains open.

Do not execute qualification fixtures against hosted data. Qualification uses synthetic owner namespaces on the owned network-none current restore and rolls back every fixture. Original logical data/history/membership fingerprints are checked separately from TAP results. No physical byte-equality claim is made.

## Execution and recovery boundaries

Hosted SQL, DNS/TLS/routing, new consumers and the primary signer transition require approval of the completed concrete package. Preparing an image or APK is not activation. Keep all 27 original serving containers and their exact image/start identities. Do not start an unrestricted worker. Pending operations, original keys, identities, sessions, Voice001, UI/Accounts improvements and private evidence remain protected.

Before approved execution, reconcile the dispatch receipts, rerun the exact guarded read-only preflight, take and authenticate an incremental-time current backup with the already-qualified procedure, and verify the unchanged package hashes. The completed off-host backup/restore is reusable proof of that procedure; it is not a claim that Storage object bytes or provider-managed recovery material were backed up.

The proposed customer API is `https://api.masarifiratibi.com`, retaining `clerk.staging.masarifiratibi.com` and the exact existing Clerk key/package/EAS binding. Production DNS was absent during preparation. Production DNS, verified TLS, current issuer/JWKS/Google continuity and public privacy/deletion resources remain deployment gates. Existing draft legal documents must not be represented as approved notices.

Database rollback before commit is transactional. After activation, keep the additive consent table, durable receipts, corrections and pending records; never restore the old database snapshot over newer user work. Runtime rollback must use the compatible higher-counter APK and the frozen previous routing/runtime identities, with capture held closed until its required consumer is verified. No old-key signing retake capability is enabled.

The final customer artifact must receive actual Redmi acceptance before delivery replacement and branch push. The separate signing-QA fixture qualifies signing mechanics only. Retained automatic test results can be reused when their exact source inputs match; they cannot replace actual customer APK/phone proof.
