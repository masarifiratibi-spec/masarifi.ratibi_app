# Security Release Gates

Security Engineering owns scanner policy; Release Engineering owns evidence and
artifact promotion. A release is blocked by any detected secret, exploitable
Critical or High dependency/image finding, SAST blocker, failed contract/RLS or
scope test, root or writable production container, missing SBOM, missing or
invalid provenance/signature, unpinned workflow action, production debug or
Swagger exposure, or failed migration checksum.

There is no checkbox, feature flag, environment variable, or emergency waiver
that converts a blocker into a pass. A false positive requires a reviewed,
version-controlled policy correction with evidence, then a fresh full scan.

## Triage

1. Preserve the scanner name/version, rule/CVE, package or layer, commit, image
   digest, and redacted evidence. Never paste a secret value.
2. Security Engineering confirms exploitability and assigns the Backend or
   Platform owner. Rotate any exposed credential before further analysis.
3. Fix source or locked dependency, rebuild from the reviewed commit, and rerun
   typecheck, lint, tests, secret scan, dependency/SAST scan, image scan, SBOM,
   signature, and provenance verification.
4. Verify the CycloneDX SBOM identifies the commit and production dependencies.
   Verify signature and provenance bind the same immutable image digest.

## Rollback And Closure

Do not deploy a failed candidate. If a post-release issue is found, remove it
from traffic and restore the previous signed digest; run only forward-compatible
database corrections and the migration/recovery reconciliation. Close after a
fresh candidate has zero exploitable Critical/High findings, no secrets, all
gates pass, and Security plus Release Engineering approve the retained evidence.
Approval permits review or merge; automation never auto-merges or auto-deploys.
