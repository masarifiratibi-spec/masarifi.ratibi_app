# OWASP Security Traceability

**Baseline**: OWASP ASVS `v5.0.0` Level 2 plus applicable Level 3 controls,
OWASP API Security Top 10:2023, OWASP Top 10:2025, and OWASP MASVS 2.1 control
groups. Security failures below are release blockers; `DEFERRED` means the
named owning Spec must supply evidence before production, not that the control
is waived.

Official baselines:

- https://owasp.org/www-project-application-security-verification-standard/
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- https://owasp.org/Top10/
- https://mas.owasp.org/MASVS/

## ASVS 5.0.0

Ranges include every L1/L2 requirement in the named chapter. L3 is applicable
where noted because Masarifi processes high-value financial data. A requirement
whose mechanism does not exist in SPEC-BE-001 is explicitly N/A or assigned to
the future owning Spec.

| Requirement range | Applicability and owner | Mandatory evidence / blocking gate | State |
|---|---|---|---|
| `v5.0.0-V1.*` Encoding/Sanitization, L1-L2 | API, SQL, logs | DTO validation, parameterized repository tests, safe-error/redaction tests | VERIFIED |
| `v5.0.0-V2.*` Validation/Business Logic, L1-L2 | config, HTTP, outbox bounds | environment, validation, envelope, retry and dispatcher suites | VERIFIED |
| `v5.0.0-V3.*` Web Frontend, L1-L2 | No frontend owned | scope gate proves Mobile/Admin untouched | N/A in SPEC-BE-001 |
| `v5.0.0-V4.*` API/Web Service, L1-L3 | all owned endpoints | HTTP security/validation/timeout/OpenAPI drift; performance gate pending | BLOCKED: performance evidence |
| `v5.0.0-V5.*` File Handling, L1-L2 | bucket baseline only; workflows Specs 009-011 | private-bucket pgTAP; no upload endpoint | BLOCKED: Supabase pgTAP |
| `v5.0.0-V6.*` Authentication, L1-L3 | live Clerk is SPEC-BE-002 | meta 401/503 fail-closed; SPEC-BE-002 production auth gate | DEFERRED: SPEC-BE-002 |
| `v5.0.0-V7.*` Session Management, L1-L3 | SPEC-BE-002 owns sessions | no session mechanism in this Spec; scope gate | DEFERRED: SPEC-BE-002 |
| `v5.0.0-V8.*` Authorization, L1-L3 | database and server boundaries | privilege pgTAP, ownership/scope tests, no client writes | BLOCKED: Supabase pgTAP |
| `v5.0.0-V9.*` Self-contained Tokens, L1-L3 | Clerk JWT contract only | signed fixture, unsigned rejection; issuer/key lifecycle in SPEC-BE-002 | DEFERRED: SPEC-BE-002 |
| `v5.0.0-V10.*` OAuth/OIDC, L1-L3 | Clerk integration SPEC-BE-002 | no OAuth/OIDC endpoint or token exchange in this Spec | DEFERRED: SPEC-BE-002 |
| `v5.0.0-V11.*` Cryptography, L1-L3 | IDs, checksums, transport boundary | Node crypto UUID, SHA-256 migration checksums, SBOM/signature gates | BLOCKED: release signature evidence |
| `v5.0.0-V12.*` Secure Communication, L1-L3 | deployment boundary | HTTPS-only production CORS and production deployment contract | BLOCKED: runtime deployment evidence |
| `v5.0.0-V13.*` Configuration, L1-L3 | platform/container/CI | strict environment, Helmet/CORS, non-root image, Gitleaks/audit/Trivy | BLOCKED: image scan |
| `v5.0.0-V14.*` Data Protection, L1-L3 | logs, errors, buckets, secrets | redaction/sentinel suites, private bucket pgTAP, runtime secrets | BLOCKED: pgTAP/image inspection |
| `v5.0.0-V15.*` Secure Coding/Architecture, L1-L3 | entire Spec | Constitution, ownership gate, lockfile, tests, immutable migrations | VERIFIED locally |
| `v5.0.0-V16.*` Logging/Error Handling, L1-L3 | logs/events/alerts | logger, safe errors, telemetry failure, runbooks; outbox metrics pending | BLOCKED: metrics/alerts |
| `v5.0.0-V17.*` WebRTC, L1-L3 | no WebRTC capability | ownership and forbidden-technology scope tests | N/A in SPEC-BE-001 |

## API Security Top 10:2023

| Risk | Control owner | Evidence / blocking gate | State |
|---|---|---|---|
| API1 Broken Object Level Authorization | Specs 003-014; foundation deny-default | RLS/privilege pgTAP and no product endpoint | BLOCKED: pgTAP |
| API2 Broken Authentication | SPEC-BE-002 | meta fail-closed and signed/unsigned contract | DEFERRED: SPEC-BE-002 |
| API3 Broken Object Property Level Authorization | HTTP platform | DTO whitelist, unknown-field and mass-assignment tests | VERIFIED |
| API4 Unrestricted Resource Consumption | HTTP/outbox platform | body/time/batch bounds; P95/P99/load gates | BLOCKED: load evidence |
| API5 Broken Function Level Authorization | Specs 003-014; database baseline | role/function grants pgTAP and ownership gate | BLOCKED: pgTAP |
| API6 Sensitive Business Flows | future financial Specs | no financial mutation endpoint in this Spec; scope gate | N/A in SPEC-BE-001 |
| API7 SSRF | future provider Specs | no caller-selected outbound URL/provider in this Spec | N/A in SPEC-BE-001 |
| API8 Security Misconfiguration | platform | environment, exact CORS, Helmet, Swagger-off, workflow/image gates | BLOCKED: image gate |
| API9 Improper Inventory Management | platform | owned-resource allowlist and OpenAPI drift | VERIFIED |
| API10 Unsafe Consumption of APIs | queue/telemetry boundary | schema validation, timeout, redaction; no live provider | VERIFIED for owned boundary |

## OWASP Top 10:2025

| Risk | Evidence / blocking gate | State |
|---|---|---|
| A01 Broken Access Control | RLS/privilege pgTAP, deny-default, scope gate | BLOCKED: pgTAP |
| A02 Security Misconfiguration | strict config, Helmet/CORS, Swagger-off, non-root/image scan | BLOCKED: image gate |
| A03 Software Supply Chain Failures | lockfile, audit, pinned actions, SBOM, Trivy, Cosign | BLOCKED: release evidence |
| A04 Cryptographic Failures | crypto UUID/checksums, HTTPS deployment, runtime secrets | BLOCKED: runtime evidence |
| A05 Injection | DTO validation, parameterized SQL, fixed function search paths | BLOCKED: function pgTAP |
| A06 Insecure Design | Master Plan, Constitution, ownership and acceptance gates | VERIFIED locally |
| A07 Authentication Failures | fail-closed meta; production Clerk in SPEC-BE-002 | DEFERRED: SPEC-BE-002 |
| A08 Software/Data Integrity Failures | migration checksums, immutable image, signature/provenance | BLOCKED: release evidence |
| A09 Security Logging/Alerting Failures | redaction/telemetry tests and runbooks | BLOCKED: outbox metrics/alerts |
| A10 Mishandling Exceptional Conditions | safe filter, bounded timeout, retries, shutdown/recovery | BLOCKED: recovery rehearsal |

## MASVS 2.1 Backend Boundary

Mobile source is explicitly outside SPEC-BE-001. These rows cover only backend
contracts consumed by Mobile; device-side evidence remains with SPEC-BE-014 and
the relevant Mobile owner.

| Control group | Backend applicability | Evidence / blocking gate | State |
|---|---|---|---|
| MASVS-STORAGE | private server buckets; no client policy | storage privilege pgTAP | BLOCKED: Supabase |
| MASVS-CRYPTO | TLS/API contract and no client secret | HTTPS-only config, secret/image gates | BLOCKED: runtime evidence |
| MASVS-AUTH | backend JWT verification boundary | meta signed/unsigned/fail-closed contract | DEFERRED: SPEC-BE-002 |
| MASVS-NETWORK | bounded HTTPS API and exact CORS | HTTP security/timeout contracts | VERIFIED backend-side |
| MASVS-PLATFORM | no platform interaction owned | Mobile/Admin untouched scope gate | N/A backend-side |
| MASVS-CODE | dependency, API and release integrity | audit, SAST, OpenAPI drift, pinned workflow | VERIFIED locally |
| MASVS-RESILIENCE | mobile anti-tamper is not backend scope | immutable signed backend image gate only | BLOCKED: release evidence |
| MASVS-PRIVACY | no sensitive logs/payloads/provider data | sentinel redaction and safe-error tests | VERIFIED backend-side |

## Release Decision

Any `BLOCKED` or `DEFERRED` row that applies to the production path blocks
release. Feature flags cannot bypass a control. Security Engineering owns final
review and the evidence is retained with the immutable release artifact.
