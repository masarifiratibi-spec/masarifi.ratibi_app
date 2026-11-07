# Dashboard owner self-deletion

The mobile confirmation on Android 129 already submits an authenticated, owner-scoped deletion request. The database previously refused to freeze and erase a verified owner when an admin profile existed. This change admits the same confirmed request as for an ordinary owner, revokes the admin profile when the financial profile is frozen, and removes its department and last-login metadata. Staff references for audit history and the consumed bootstrap record are retained. The existing identity handler revokes provider sessions and deletes the identity. A retry still uses the persisted request and receipt.

The last-super-admin trigger permits the transition to revoked for the matching frozen owner with a verified, eligible processing request. Ordinary administrative changes retain the existing last-admin protection. A confirmed self-deletion can therefore leave the dashboard without any active administrator. A read-only aggregate on production found one active staff member, who was the only active super-admin. This release does not appoint a successor or reopen first-admin bootstrap. Applying the migration itself does not submit any deletion request.

## Qualification

The three production function bodies, owners and grants matched the before-state manifest. On an isolated PostgreSQL clone, the new staff regression failed before the change with HTTP 403. After applying the migration all 16 immediate-deletion integration cases passed. The staff case confirmed the original mobile service command returned completed, the personal profile was deleted, admin membership became revoked, and the completion receipt remained readable. The provider session-revocation and user-deletion calls were checked with a test double. No real provider identity, Redmi account or production row was erased.

The local-only [last-admin fixture](verify-last-admin.sql) rolled back after proving a normal last-admin revocation was blocked, a mismatched owner was refused, a valid last-admin freeze was retryable, dashboard permission was denied after freeze, and the worker could prepare, lock objects and erase the owner's payload. The forward, inverse and forward transactions ran successfully on the same clone with definition, grant, membership and history checks.

## Execution

1. Confirm approval for the production database of project `qcffvfbpzvpwcwxwjyro`. Reconcile any existing history for version `20261107083047`. Verify the [manifest](manifest.json) against the three live functions. Reuse the reviewed operator connection and execute one complete transaction.
2. From this directory run `python render.py apply <unused-private-output.sql>`. The exact rendered UTF-8/LF transaction has SHA256 `a4cd23a8ec799d2c2811d4ad49ee4c464bc0d8c15ae686e0dd160782c36a9f31`. Apply it once. Check registered version, source SHA, the three resulting body hashes and original grants against the manifest. Verify API liveness and record execution. A timeout requires reconciling the actual state first.
3. For rollback run `python render.py rollback <unused-private-output.sql>`. SHA256 `0113b5728e08c3c338427196814c70a33abbb1b1312582c34d78c75cdefd6fc4`. Rollback restores the previous functions and migration history. It cannot restore an erased account. Check for in-flight staff deletions before rollback, because the old rule would reject their remaining stages.
