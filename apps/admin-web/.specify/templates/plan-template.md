# Implementation Plan: [FEATURE]

**Phase / Spec**: [Phase N / Spec 00N]  
**Date**: [DATE]  
**Spec**: [link to `specs/[###-feature-name]/spec.md`]  
**Input**: Admin Web feature specification

## Summary

[Summarize the user outcome and the smallest Admin approach that preserves the approved implementation.]

## Technical Context

**Language**: TypeScript, strict mode  
**Framework**: Next.js App Router with React  
**UI and data stack**: Tailwind CSS, TanStack Query, TanStack Table, React Hook Form, Zod, Recharts, Lucide Icons  
**Mock boundary**: Mock Service Worker behind typed services or repositories  
**Testing**: Vitest and Playwright  
**Storage**: Browser boundary: use the API for server-owned records
**Direction**: Arabic RTL default; English LTR ready  
**Target viewports**: 1440px, 1280px, 1024px, 768px, 390px  
**Scope**: Existing `apps/admin-web` project with server contracts owned by apps/api
**Performance and scale**: [Use measurable requirements from the specification]

## Constitution Check

*GATE: Every item MUST pass before Phase 0 and after Phase 1.*

- [ ] Existing approved pages, routes, components, tokens, assets, and configuration are preserved.
- [ ] Gulf Premium Design System Version 2.1 remains the visual source of truth.
- [ ] The feature maps to its owning spec and live API capability, or identifies a proposed contract.
- [ ] Admin integrates with Clerk and the authorized API. Database credentials and provider calls belong to the server.
- [ ] Pages use typed services or repositories; no raw mock arrays are imported by presentation code.
- [ ] Mock HTTP contracts match the live NestJS API.
- [ ] The fixed stack is used without replacement libraries, project reinitialization, or `any`.
- [ ] RTL/LTR, accessibility, reduced motion, and all approved viewports are covered.
- [ ] Relevant loading, empty, error, success, warning, and permission states are covered.
- [ ] Sensitive financial data is masked or aggregated; destructive actions require confirmation.
- [ ] All external, mocked, user-entered, URL, imported, and API values are treated as untrusted and validated with Zod.
- [ ] Rendering, redirects, links, uploads/previews, client storage, environment exposure, errors, and logs are safe.
- [ ] Mock permissions remain development-only UX controls; server-enforced authorization is documented.
- [ ] Dependencies are minimized, reviewed, and unchanged unless a scoped upgrade is explicitly required.
- [ ] Security-sensitive behavior has accessible Vitest and Playwright coverage.
- [ ] Typecheck, lint, Vitest, Playwright, and production-build commands are identified.

## Project Structure

### Feature documentation

```text
specs/[###-feature-name]/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Existing Admin Web source

```text
src/
├── app/
├── components/
└── [existing feature-aligned folders only]
```

**Structure decision**: [Name the existing paths to reuse and the minimum new frontend files, if any.]

## Backend Alignment

**Planned modules**: [From the Full Product Technical Plan]  
**Planned entities**: [From the Full Product Technical Plan]  
**Proposed contracts**: [Typed live endpoint, server owner and matching test fixture]
**Server security**: [Required API permission, PostgreSQL policies, infrastructure controls and evidence]

## Complexity Tracking

> Complete only for a constitution deviation. A deviation requires explicit approval before implementation.

| Violation | Why Required | Approved By | Follow-up |
|-----------|--------------|-------------|-----------|
| [rule] | [necessity] | [approval] | [remediation] |
