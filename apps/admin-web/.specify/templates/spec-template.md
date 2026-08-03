# Admin Web Feature Specification: [FEATURE NAME]

**Phase / Spec**: [Phase N / Spec 00N of 010]  
**Created**: [DATE]  
**Status**: Draft  
**Input**: "$ARGUMENTS"

## Goal

[State the operator outcome. This is a frontend-only, backend-aligned specification.]

## Dependencies

- **Prior phase/spec**: [required predecessor]
- **Existing routes/components/tokens/assets**: [items that MUST be reused]

## Backend Alignment

- **Planned backend modules**: [Full Product Technical Plan references]
- **Planned entities**: [entity names only]
- **Boundary**: Proposed contracts and mocks only; no backend implementation

## Roles and Permissions

- **Roles**: [authorized Admin roles]
- **Permission states**: [visible, disabled, hidden, or denied behavior]
- Permission-aware UI MUST NOT be described as backend authorization.

## User Scenarios and Testing

### User Story 1 — [Brief title] (Priority: P1)

[Describe the Arabic-first Admin journey.]

**Why this priority**: [value and dependency rationale]

**Independent test**: [observable outcome]

**Acceptance scenarios**:

1. **Given** [state], **When** [action], **Then** [outcome]
2. **Given** [state], **When** [action], **Then** [outcome]

[Add only necessary independently testable stories.]

## Routes

| Route | Purpose | Roles | Existing/New |
|-------|---------|-------|--------------|
| [route] | [purpose] | [roles] | [existing or approved addition] |

## Functional Requirements

- **FR-001**: The Admin Web frontend MUST [testable behavior].
- **FR-002**: The feature MUST [testable behavior].

## Platform Data Rules

- [Define iOS, Android, and All-platform filtering.]
- [Define deduplication where customer totals span platforms.]

## UX and Design Constraints

- Preserve the approved page and Masarifi Gulf Premium Design System Version 2.1.
- Keep deep teal primary and bronze limited to approximately 2%–3%.
- Keep Admin surfaces neutral, data-dense, professional, and operational.
- Keep financial semantic colors separate from system status colors.
- Use existing semantic tokens rather than scattered raw colors.

## Responsive and Directional Behavior

- **Arabic RTL default**: [behavior]
- **English LTR readiness**: [behavior]
- **1440px**: [expected layout]
- **1280px**: [expected layout]
- **1024px**: [expected layout]
- **768px**: [expected layout]
- **390px**: [expected layout]

## Accessibility

- [Keyboard navigation, visible focus, semantic HTML, accessible names, contrast, and reduced motion requirements.]

## Proposed API Contracts

| Method | Mock path | Request type | Response type | Planned NestJS capability |
|--------|-----------|--------------|---------------|----------------------------|
| [verb] | [path] | [type] | [type] | [module/capability] |

Pages MUST consume these contracts through typed services or repositories and
MUST NOT import raw mock arrays.

## Frontend Types

- **[Type]**: [purpose and required fields]
- Application types MUST NOT use `any`.

## Mock Scenarios and UI States

- **Loading**: [relevant behavior]
- **Empty**: [relevant behavior]
- **Error**: [relevant behavior and recovery]
- **Success**: [relevant behavior]
- **Warning**: [relevant behavior]
- **Permission**: [relevant behavior]

## Audit, Privacy, and Sensitive Actions

- [Planned audit event alignment.]
- [Masking or aggregation behavior for customer financial data.]
- [Confirmation behavior for destructive or sensitive actions.]
- [Sensitive data involved and the minimum safe display.]
- [Safe user-facing error and logging rules.]

## Security Requirements

- **Untrusted inputs**: [Forms, filters, URLs, identifiers, imports, mocks, and API values requiring Zod validation.]
- **Safe rendering**: [HTML, Markdown, JSON, provider, imported, notification, or AI content and its sanitization/presentation boundary.]
- **Client storage and environment**: [Values prohibited from storage or browser exposure.]
- **Files and links**: [Type, size, filename, invalid-file, redirect, and opener-safety requirements.]
- **Permissions**: [Frontend UX controls and independent future backend authorization.]
- **Dependencies**: [Security review and any explicitly required scoped change.]
- **Security mock scenarios**: [Denied, expired, invalid, unsafe-input, masking, conflict, and duplicate-submission cases.]
- **Deferred production controls**: [NestJS, Supabase, infrastructure, and provider protections not implemented now.]

Security controls MUST follow defense in depth and remain keyboard and
screen-reader accessible.

## Edge Cases

- [Boundary or failure case and expected result.]

## Out of Scope

- Backend implementation, real authentication, database work, and provider integrations.
- [Feature-specific exclusions.]

## Acceptance Criteria

- **AC-001**: [measurable acceptance criterion]
- **AC-002**: [measurable acceptance criterion]

## Verification

- **Typecheck**: [actual project command]
- **Lint**: [actual project command]
- **Unit/component tests (Vitest)**: [actual project command]
- **End-to-end tests (Playwright)**: [actual project command]
- **Production build**: [actual project command]
- **Viewport and accessibility checks**: [actual procedure]
- **Security review**: [Sensitive data, rendering, validation, permissions, storage, environment, errors, logs, dependencies, and privacy masking.]

Successful verification MUST NOT be claimed unless each named command was
executed successfully.
