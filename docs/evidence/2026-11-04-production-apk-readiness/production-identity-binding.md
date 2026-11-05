# Retained production identity build binding

Status: source/configuration qualification only. Production remains **NOT READY**.

The current customer identity uses the existing live Clerk instance at
`clerk.staging.masarifiratibi.com`. Moving the domain or choosing another live
instance could invalidate identity/session continuity. The former build policy
rejected this instance because its domain includes `staging`, while accepting an
unrelated live instance if an operator declared its domain approved.

The Production build policy now requires the exact retained domain and
publishable-key SHA256
`b23652e5532792769747186f24295dadd41fcc330abe12da3186951e0f084475`, customer
package `com.masarifi.mobile`, and EAS project
`c8cc3dd3-a7e9-4737-ac4d-32f076107600`. The CLI reads the application identity
from its own checked-in `app.json`. Other Clerk instances, mismatched keys, and
Dev/Benchmark packages or other EAS projects fail closed. The production API
origin, release channel, app lock and disabled automation/diagnostic checks
remain required. Authentication/session/owner checks were not changed.

## Evidence

- Read-only hosted container metadata: 13 current services use that exact
  live-key hash and domain; the configured mobile key matches. Two other
  development services use a different test instance and remain in the legacy
  route/security review. No service configuration was changed.
- The current domain's public JWKS endpoint returned HTTP200 through verified
  TLS on 4 November 2026. Its response is retained privately. Signing key IDs
  are not pinned in the APK, so this correction does not prevent ordinary
  provider key rotation. Fresh session-token/issuer acceptance is still open.
- Behavioral RED: three cases failed before the correction: retained-instance
  admission, refusal of an unrelated live instance, and package/project binding.
  The exact original failures remain in the private plan workspace.
- GREEN: 12 build-policy cases passed; the related configuration, private-QA
  exclusion, transform-cache isolation and production-entrypoint checks passed
  **20/20** together. Changed-file ESLint and formatting passed. These are local
  build guards, not a resumed Benchmark/performance campaign.
- Actual CLI validation and public Expo configuration resolution passed with
  the existing key, Production profile, version `1.0.0`, Arabic name, customer
  package, original scheme/project, app lock on, live mode, demo mode off, and
  automation/timing/diagnostics explicitly off.

The configuration check used the proposed production API origin
`https://api.masarifiratibi.com`; it did not establish DNS, deployment, TLS or
application availability at that origin. It did not build or install a customer
APK, change Clerk/Google/Firebase, or activate hosted Production. The final APK,
fresh OAuth, saved-session restoration, full Redmi feature matrix, current
database restore/rollout and monitoring acceptance remain open.
