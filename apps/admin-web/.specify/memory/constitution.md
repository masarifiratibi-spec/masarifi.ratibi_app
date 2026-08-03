<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
  - III. Frontend-Only, Backend-Aligned Boundaries — clarified production security deferral
  - V. Complete States and Evidence-Based Quality — added phase security review
- Added principles:
  - VI. Defense-in-Depth Frontend Security and Privacy
- Added sections: none
- Removed sections: none
- Dependent artifacts:
  - ✅ .specify/templates/plan-template.md — added security and privacy gates
  - ✅ .specify/templates/spec-template.md — added mandatory security specification fields
  - ✅ .specify/templates/tasks-template.md — added security implementation and review tasks
  - ✅ .specify/workflows/speckit/workflow.yml — no change required
  - ✅ specs/README.md — added security and privacy specification requirement
  - ✅ .agents/skills/speckit-* — reviewed; no additional change required
- Deferred items: none
-->

# Masarifi Admin Dashboard Constitution

## Core Principles

### I. Approved Visual Identity Is Immutable

The existing approved Masarifi Admin Dashboard is the implementation baseline.
Every change MUST preserve approved pages, routes, components, tokens, assets,
configuration, layout behavior, and interaction language. Existing approved
pages MUST NOT be redesigned or replaced. Masarifi Gulf Premium Design System
Version 2.1 is the visual source of truth.

Deep teal MUST remain the primary interaction color. Bronze MUST remain a
limited premium accent, with approximately 2%–3% visual coverage on Admin
screens. Admin interfaces MUST remain neutral, data-dense, professional, and
operational. Financial semantic colors MUST remain distinct from system status
colors. Existing semantic design tokens MUST be reused; raw color values MUST
NOT be scattered where an applicable token exists.

Rationale: visual continuity is an approved product constraint, not an
implementation preference.

### II. Arabic-First, Accessible Operations

Arabic and RTL MUST be the default interface language and direction. English
LTR readiness MUST be preserved through logical layout properties, direction-
safe components, and content behavior that works in both directions.

Every affected experience MUST support keyboard navigation, visible focus,
semantic HTML, accessible names, appropriate contrast, and reduced motion.
Every approved viewport—1440px, 1280px, 1024px, 768px, and 390px—MUST be
verified without changing the approved visual identity.

Rationale: localization, accessibility, and responsive operation are baseline
product requirements.

### III. Frontend-Only, Backend-Aligned Boundaries

The current phase is frontend-only. Work MUST NOT implement or initialize
NestJS, Supabase, Stripe, AI providers, databases, real authentication, or any
other backend runtime. Permission-aware UI MUST represent planned access rules
but MUST NOT be treated as a substitute for future backend authorization.

Every frontend feature MUST map to a planned backend capability in the Full
Product Technical Plan. Data flow MUST follow:
route or component → feature hook → typed service or repository → mock HTTP
adapter now → replaceable NestJS API later. Pages and presentation components
MUST NOT import raw mock arrays directly. Mock APIs MUST implement stable typed
contracts that can be replaced by the real NestJS API without redesigning the
page.

Sensitive customer financial data MUST be masked or aggregated by default.
Destructive or sensitive actions MUST require explicit confirmation.

Rationale: the frontend must remain realistic and integration-ready without
prematurely building the backend.

### IV. Fixed Stack and Conservative Extension

The approved frontend stack is fixed:

- Next.js App Router
- React
- TypeScript in strict mode
- Tailwind CSS
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Recharts
- Lucide Icons
- Mock Service Worker
- Vitest
- Playwright

No other framework, router, styling system, UI framework, state library, chart
library, or testing stack may replace these choices without explicit approval.
The existing project MUST be extended in place and MUST NOT be reinitialized.
Existing code, routes, components, tokens, assets, and configuration MUST be
reused where possible. Application code MUST NOT use `any`.

Existing direct fixtures or raw visual values are technical debt, not precedent:
when an affected flow is modified, it MUST be brought behind typed boundaries
and semantic tokens without unrelated rewrites or visual redesign.

Rationale: conservative extension protects the approved frontend and keeps
future integration predictable.

### V. Complete States and Evidence-Based Quality

Every route and data-driven feature MUST define and implement all relevant
loading, empty, error, success, warning, and permission states. Specifications
and plans MUST state which states are relevant and how they behave; omission
requires an explicit, testable justification.

Type checking, linting, tests, and the production build MUST pass before work is
declared complete. A verification claim MUST name the command actually run and
MUST reflect its real successful result. No command may be reported as passing
if it was skipped, failed, or inferred.

Rationale: operational Admin software must fail clearly, handle incomplete
data safely, and provide auditable evidence of quality.

### VI. Defense-in-Depth Frontend Security and Privacy

Admin Web engineering MUST apply OWASP-aligned frontend security practices where
applicable. Cross-site scripting, unsafe rendering, URL and form injection, open
redirects, sensitive-data exposure, insecure client storage, broken
access-control assumptions, unsafe uploads or previews, and dependency risks
MUST be addressed in specifications, implementation tasks, and tests.

All external, mocked, user-entered, URL-provided, imported, and API-provided
values MUST be treated as untrusted. Forms, filters, query parameters,
identifiers, imported data, and mutation payloads MUST be parsed, normalized,
and validated with Zod before use. Raw HTML, Markdown, JSON, provider payloads,
imported SMS or notification content, and AI-generated content MUST NOT be
rendered without appropriate sanitization and safe presentation.
`dangerouslySetInnerHTML` MUST NOT be used unless a documented requirement,
security review, and sanitization boundary are approved.

Secrets, API keys, tokens, private credentials, service-role keys, and sensitive
configuration MUST NOT appear in frontend source, fixtures, logs, screenshots,
documentation, or browser-accessible environment variables. Only values
intentionally safe for browser exposure may use a public environment-variable
prefix. Authentication tokens, financial data, sensitive customer details,
temporary-access data, and private identifiers MUST NOT be stored in
`localStorage` without explicit approval and security review.

Mock authentication and role simulation MUST be isolated and identified as
development-only behavior. Hidden navigation, disabled controls, client route
guards, and mock permissions are UX controls only. Every future NestJS
operation MUST independently enforce authorization. No frontend-only control
may be described as sufficient security.

Security controls MUST follow defense in depth. No single client-side control
MUST be treated as sufficient protection.

Privacy MUST be the default. Interfaces MUST minimize customer data, mask
sensitive values, and avoid full financial records, emails, phone numbers,
device identifiers, IP addresses, tokens, provider payloads, and imported
messages unless explicitly required. Mocks and tests MUST use sanitized
fictional data. User-facing errors and logs MUST NOT expose stack traces,
internal paths, SQL details, secrets, raw exceptions, private payloads,
infrastructure details, passwords, authentication tokens, full payment or
financial payloads, unmasked personal data, uploaded contents, or AI prompts
containing private customer information.

Destructive, privileged, privacy-sensitive, billing, security, and access
actions MUST include a clear scope and consequence explanation, confirmation,
permission-aware UI, an expected audit event, and loading, success, failure,
and conflict states. Sensitive mutations MUST be locked while pending to
prevent unsafe duplicate submissions.

Upload and preview interfaces MUST validate allowed type, size, safe filename,
unsupported formats, upload failure, and malicious or invalid file scenarios.
External links opened in a new tab MUST prevent opener access. Redirect targets
and all URL or search parameters MUST be validated and normalized before use.

Dependencies MUST be minimized and reviewed before installation. Abandoned,
unnecessary, duplicative, known-vulnerable, or stack-conflicting packages MUST
NOT be introduced. Feature work MUST NOT upgrade or replace dependencies unless
the change is required, scoped, tested, and explicitly documented.

Security-sensitive behavior MUST receive relevant Vitest and Playwright
coverage, including permission visibility, access-denied and session-expired
states, temporary-access expiration, masking, validation failures, unsafe input
handling, and destructive-action confirmation. Security controls MUST remain
keyboard and screen-reader accessible.

Before each phase is completed, changed work MUST be reviewed for sensitive-data
exposure, unsafe rendering, missing validation, incorrect permissions, insecure
storage, leaked environment values, unsafe errors or logs, dependency risks,
and broken privacy masking. Limitations and deferred backend protections MUST
be documented.

Production security belongs to future backend and infrastructure phases.
Frontend-only work MUST NOT implement penetration testing, backend security
controls, real authentication, encryption infrastructure, rate limiting,
database policies, or provider-secret handling. Required future protections in
NestJS, Supabase, infrastructure, and provider integrations MUST instead be
recorded as backend expectations.

Rationale: client-side controls improve safety and UX but cannot establish a
production trust boundary; layered frontend and future backend controls are
both required.

## Scope, Architecture, and Delivery Constraints

All governed work MUST remain inside
`D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web`. Admin Web specifications
MUST remain inside `apps/admin-web/specs`; API, Mobile, and Marketing
specifications belong only in their own future application folders.

Delivery MUST follow the approved 10-phase Admin frontend plan:

0. Foundation and contract hardening
1. Overview dashboard
2. User management
3. Financial operations
4. Subscription management
5. Analytics and reports
6. Content and support
7. AI operations
8. System health and audit
9. Final hardening and release readiness

The phases and their ten specifications MUST remain sequential unless an
explicitly approved plan documents a safe dependency exception. Backend module
and entity references are alignment inputs only; they do not authorize backend
implementation.

When sources appear to conflict, use this order within Admin Web: this
constitution governs non-negotiable rules; the Full Product Technical Plan
governs product architecture and future backend alignment; the Admin Dashboard
10-specification plan governs frontend delivery; and Gulf Premium Design System
Version 2.1 governs visual decisions.

## Specification and Quality Gates

Every feature specification MUST identify its phase, dependencies, planned
backend modules and entities, roles, user stories, routes, functional
requirements, platform data rules, UX constraints, responsive behavior,
accessibility requirements, permissions, proposed API contracts, frontend
types, mock scenarios, relevant UI states, sensitive data, validation rules,
security risks, audit and privacy behavior, safe error handling, expected
backend authorization, security-related mock scenarios, out-of-scope items,
acceptance criteria, and verification commands.

Before implementation, the plan and tasks MUST pass a Constitution Check that
confirms:

- the approved design and existing project are preserved;
- the work is frontend-only and maps to a planned backend capability;
- data crosses typed services or repositories rather than raw page fixtures;
- the fixed stack, strict TypeScript, semantic tokens, and no-`any` rule hold;
- RTL/LTR, accessibility, all approved viewports, UI states, privacy masking,
  permissions, and confirmations are covered; and
- untrusted input, safe rendering, storage, environment exposure, files, links,
  errors, logs, dependencies, and deferred backend protections are covered; and
- typecheck, lint, Vitest, Playwright, and production-build evidence is planned.

A failed gate MUST block implementation unless the constitution is explicitly
amended first. Implementation tasks MUST include the smallest relevant tests
and the actual verification commands; tests are not optional for changed
behavior.

## Governance

This constitution supersedes conflicting Admin Web working conventions,
templates, plans, and generated tasks. Every specification, plan, task set, and
implementation review MUST check compliance before work proceeds.

Amendments require explicit approval, a written rationale, an updated Sync
Impact Report, propagation to dependent Spec Kit artifacts, and a semantic
version change:

- MAJOR for removed or redefined principles or backward-incompatible governance;
- MINOR for a new principle or materially expanded mandatory guidance;
- PATCH for clarifications that do not change obligations.

Compliance reviews MUST cite concrete files, requirements, and executed command
results. Complexity or deviations MUST be documented and justified; convenience
alone is not sufficient.

**Version**: 1.1.0 | **Ratified**: 2026-07-27 | **Last Amended**: 2026-07-27
