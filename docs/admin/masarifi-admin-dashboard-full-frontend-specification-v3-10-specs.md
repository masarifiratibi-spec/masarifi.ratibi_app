# Masarifi Admin Dashboard — Full Frontend Product Specification

**Document Type:** Full Frontend Product and Feature Specification  
**Specification Version:** 3.0 — Ten-Spec Delivery Plan  
**Platform:** Masarifi  
**Primary Language:** Arabic RTL  
**Secondary Language:** English LTR  
**Implementation Mode:** Frontend-only with typed mock API contracts  
**Design Reference:** Masarifi Gulf Premium Design System — Version 2.1  
**Architecture Reference:** Masarifi Platform — Full Product and Technical Plan, Version 3  
**Delivery Method:** GitHub Spec Kit / Specification-Driven Development  
**Active Frontend Workspace:** `D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web`

---

# 1. Purpose

This document defines the complete frontend implementation plan for the Masarifi Admin Dashboard.

The complete Admin Dashboard frontend will be built before the production backend. Every route, screen, filter, action, form, permission, state, chart, and data type must still correspond to a capability planned in the shared NestJS backend and the full Masarifi technical plan.

The work must continue inside the existing approved frontend application:

```text
D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web
```

Do not initialize a replacement Admin application. Do not rebuild the approved frontend from scratch.

The existing implementation is the approved visual and interaction foundation. New modules must extend it using the same component language, spacing, typography, colors, responsive behavior, RTL rules, density, and design tokens.

---

# 2. Non-Negotiable Design Preservation

Masarifi Gulf Premium Design System Version 2.1 is mandatory.

The implementation must preserve:

- The current approved Admin Dashboard identity
- Deep teal as the main brand and interaction color
- Neutral Admin surfaces
- Limited bronze usage, approximately 2%–3% of Admin screens
- IBM Plex Sans Arabic and IBM Plex Sans
- Arabic-first RTL behavior
- English LTR readiness
- Existing spacing and density principles
- Existing component styling
- Existing responsive behavior
- Existing light-mode design
- Dark-mode compatibility
- Accessibility and privacy rules
- Separation between financial semantics and operational status semantics

Do not:

- Redesign approved pages
- Replace the visual identity
- Introduce a generic dashboard template
- Change the approved palette
- Replace typography
- reinterpret the Admin experience as a mobile layout
- scatter raw colors across new components
- create incompatible visual patterns between old and new screens
- alter approved components unless a required new state or variant is missing

When a new component is required, derive it from the current design system and existing approved components.

---

# 3. Frontend-Only Boundary

## Included

- Complete Admin routes and page layouts
- Complete frontend interactions
- Reusable components
- Typed feature contracts
- Mock HTTP adapters
- Realistic fictional data
- Simulated loading and latency
- Simulated success and failure states
- Simulated roles and permissions
- Search, filters, sorting, pagination, and bulk selection
- Forms, drawers, dialogs, and confirmation flows
- Arabic RTL and English LTR readiness
- Responsive layouts
- Light and dark theme support
- Accessibility behavior
- Frontend tests

## Excluded

- Real NestJS backend implementation
- Real Supabase access
- Real database operations
- Real Stripe operations
- Real AI provider operations
- Real queue control
- Real production authentication or authorization
- Real infrastructure monitoring
- Real customer data

All API routes defined in the Specs are:

> Proposed frontend contracts — backend not implemented yet.

---

# 4. Required Frontend Architecture

Every feature must follow this boundary:

```text
Route / Page
    ↓
Feature Components
    ↓
Feature Hooks
    ↓
Typed Repository or Service Interface
    ↓
Mock HTTP Adapter now
    ↓
NestJS API Adapter later
```

Pages and presentation components must not import fixture arrays directly.

Recommended structure inside the existing application:

```text
apps/admin-web/src/
├── app/
├── features/
├── components/
│   ├── ui/
│   ├── admin/
│   ├── tables/
│   ├── charts/
│   └── feedback/
├── core/
│   ├── api/
│   ├── auth/
│   ├── permissions/
│   ├── routing/
│   ├── localization/
│   └── config/
├── mocks/
│   ├── handlers/
│   ├── fixtures/
│   ├── factories/
│   └── scenarios/
├── styles/
└── tests/
```

Do not perform a large unrelated refactor if the existing structure already provides equivalent boundaries.

---

# 5. Cross-Platform Customer Data Model

The Admin Dashboard monitors customer activity coming from the iOS and Android mobile applications.

Every relevant overview, report, KPI, chart, filter, table, and operational summary must distinguish between:

1. **iOS data**
2. **Android data**
3. **Combined total**

The combined total must be calculated correctly and must not blindly add duplicated users who use both platforms.

## 5.1 Required Presentation Pattern

For relevant metrics, show:

```text
All Platforms
├── Total
├── iOS
└── Android
```

The UI may use:

- Segmented controls: All / iOS / Android
- Comparison cards
- Grouped bars
- Stacked charts
- Platform columns
- Platform filters
- Side-by-side trend summaries

The default view should normally be **All Platforms**, with iOS and Android available as explicit breakdowns.

## 5.2 User Counting Rules

The frontend mock contracts must distinguish between:

- `uniqueCustomersTotal`: unique customer accounts across the platform
- `iosCustomers`: customers with at least one active or registered iOS device
- `androidCustomers`: customers with at least one active or registered Android device
- `multiPlatformCustomers`: customers using both platforms
- `iosOnlyCustomers`
- `androidOnlyCustomers`

The following is not valid:

```text
Total Customers = iOS Customers + Android Customers
```

because customers may use both platforms.

The correct total is a unique-customer count returned by the future backend contract.

## 5.3 Device and Installation Metrics

Device totals are allowed to be additive because one customer may own multiple devices.

Track separately:

- Total registered devices
- iOS devices
- Android devices
- Active devices
- Revoked devices
- Push-enabled devices
- Tracking-permission state
- App-version distribution
- OS-version distribution

## 5.4 Platform-Specific Customer Data

### iOS

Relevant iOS data includes:

- iOS customer count
- iOS active customers
- New iOS customers
- iOS devices
- iOS app versions
- iOS OS versions
- Push-notification state
- Shortcut setup state
- App Intents activity
- Share Extension activity
- Screenshot imports
- Voice entry
- Widget or quick-action usage where supported
- iOS-specific support issues
- iOS-specific feature flags
- iOS import success and failure rates

The Admin Dashboard must not imply unrestricted access to iOS notifications or the SMS inbox.

### Android

Relevant Android data includes:

- Android customer count
- Android active customers
- New Android customers
- Android devices
- Android app versions
- Android OS versions
- Push-notification state
- SMS tracking permission state
- Notification Listener permission state
- Background processing state
- SMS imports
- Notification imports
- Sender and bank filtering results
- Android-specific support issues
- Android-specific feature flags
- Android import success and failure rates

## 5.5 Combined Platform Data

Combined views should include:

- Unique customers
- Active customers
- New customers
- Paid customers
- Revenue
- Subscriptions
- Support tickets
- AI usage
- Import volume
- Failed imports
- Security events
- App adoption
- Device totals
- Notification delivery
- Platform health indicators

Every combined metric must state whether it represents:

- Unique customers
- Devices
- Events
- Imports
- Requests
- Payments
- Tickets

## 5.6 Required Filters

Relevant modules must support a platform filter:

```text
All Platforms
Android
iOS
```

Additional values may include `Unknown` or `Unattributed` only when supported by a documented contract and visible data-quality state.

## 5.7 Mock Data Requirements

Mock fixtures must include:

- iOS-only customers
- Android-only customers
- Customers using both platforms
- Multiple devices for one customer
- Different iOS and Android app versions
- Platform-specific import sources
- Platform-specific permission states
- Platform-specific failures
- Combined totals that correctly deduplicate customers

---

# 6. Backend Alignment

The frontend must align with the modules planned in the shared backend:

| Frontend Area | Planned Backend Modules |
|---|---|
| Overview and platform analytics | users, profiles, devices, subscriptions, payments, imports, AI, support, jobs, audit |
| Users and access | users, profiles, devices, auth, roles, permissions, support, audit |
| Revenue | subscriptions, payments, reconciliation, audit |
| Imports and parsers | transaction-imports, transaction-parsers, files, jobs, duplicate detection |
| AI | AI gateway, providers, models, prompts, usage, processing jobs, safety |
| Support and communication | support, feedback, notifications, content, files |
| Security and governance | auth, devices, roles, permissions, audit, data requests |
| Health and processing | health, Redis, BullMQ, storage, providers, job runs |
| Platform administration | admin users, roles, permissions, settings, feature flags |

The backend remains the future source of truth for authorization, persistence, financial logic, security, and auditing.

---

# 7. Ten-Spec Delivery Plan

The complete Admin Dashboard frontend must be delivered through exactly **10 Spec Kit specifications**.

Each Spec corresponds to one implementation Phase.

```text
Phase 0 → Spec 001
Phase 1 → Spec 002
Phase 2 → Spec 003
Phase 3 → Spec 004
Phase 4 → Spec 005
Phase 5 → Spec 006
Phase 6 → Spec 007
Phase 7 → Spec 008
Phase 8 → Spec 009
Phase 9 → Spec 010
```

The Specs must be implemented sequentially unless an approved dependency plan allows limited parallel work.

---

# 8. Phase 0 — Spec 001: Admin Foundation and Design Preservation

**Spec folder:** `specs/001-admin-foundation`


The frontend stack is fixed and must not be replaced:

- Next.js App Router
- React
- TypeScript strict mode
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

Reuse the existing dependencies and project configuration whenever possible.

Do not migrate to another framework, router, state-management library, UI framework, CSS framework, chart library, or testing stack without explicit approval.





## Goal

Prepare the complete reusable foundation for all Admin modules while preserving the approved visual identity and existing working implementation.

## Scope

- Inspect the existing approved Admin frontend
- Document existing routes, components, patterns, tokens, and mock data
- Preserve the approved four-page implementation
- Establish feature-based frontend boundaries
- Design tokens and Admin theme integration
- Arabic RTL foundation
- English LTR readiness
- Light and dark theme compatibility
- Application shell
- Sidebar and navigation groups
- Topbar
- Breadcrumbs
- Page headers
- Global search shell
- Date-range controls
- Environment indicator
- Notification and incident panels
- Role and permission simulation foundation
- Typed API client foundation
- Repository and service interfaces
- Mock HTTP layer
- Error model
- Pagination model
- Query provider
- Toasts
- Dialogs
- Drawers
- Confirmation flows
- Table foundation
- Filter foundation
- Chart foundation
- Loading, empty, error, and access-denied states
- Responsive shell
- Accessibility foundation
- Test and verification foundation

## Design Constraint

No approved page may be visually redesigned during this Phase.

## Deliverables

- Stable Admin shell
- Shared component boundaries
- Typed mock API architecture
- Shared status and severity system
- Platform filter component: All / iOS / Android
- Development role switcher
- Base route map
- Test utilities
- Updated architecture documentation

---

# 9. Phase 1 — Spec 002: Platform Overview and Cross-Platform Customer Analytics

**Spec folder:** `specs/002-admin-overview-and-platform-analytics`

## Goal

Complete the main operational Overview and clearly present iOS, Android, and combined platform data.

## Scope

- Platform Overview
- Attention panel
- Operational summary
- Recent platform activity
- User growth
- Active and new customers
- Paid and free customers
- Subscription and revenue summaries
- Import volume
- AI usage
- Support volume
- Critical incidents
- Failed jobs
- Mobile platform distribution
- App-version adoption
- Device distribution
- Platform comparison trends

## Required Platform Breakdown

Every relevant metric must support:

- Combined total
- iOS
- Android

Include separate sections or views for:

### iOS Customer Overview

- Unique iOS customers
- Active iOS customers
- New iOS customers
- iOS devices
- Current app-version distribution
- Shortcut and Share Extension adoption
- iOS import volume and success rate
- iOS support issues

### Android Customer Overview

- Unique Android customers
- Active Android customers
- New Android customers
- Android devices
- Current app-version distribution
- SMS tracking adoption
- Notification Listener adoption
- Android import volume and success rate
- Android support issues

### Combined Overview

- Unique customer total
- Multi-platform customer count
- Total registered devices
- Combined active users
- Combined revenue
- Combined import volume
- Combined support and operational indicators

## Important Counting Rule

Do not calculate unique total customers by directly adding iOS and Android customer counts.

---

# 10. Phase 2 — Spec 003: Users, Devices, Sessions, and Controlled Access

**Spec folder:** `specs/003-admin-users-devices-and-access`

## Goal

Implement privacy-safe customer operations and controlled support access.

## Scope

- Users List
- User Profile Summary
- User Devices
- User Sessions
- Suspend and reactivate flows
- Force logout
- Verification state
- Risk indicators
- Bulk actions
- Access Requests List
- Access Request Details
- Temporary Access Workspace

## Platform Data Requirements

For each customer, show:

- Primary or most recently active platform
- All registered platforms
- iOS device count
- Android device count
- Total device count
- Last activity per platform
- App version per device
- Platform-specific permission states
- Push state
- SMS tracking state where Android applies
- Notification Listener state where Android applies
- Shortcut and Share Extension setup where iOS applies

Users must be filterable by:

- All platforms
- iOS
- Android
- Multi-platform

Sensitive customer financial information remains hidden by default.

---

# 11. Phase 3 — Spec 004: Subscriptions, Plans, Payments, and Revenue

**Spec folder:** `specs/004-admin-revenue-and-billing`

## Goal

Implement all frontend operations related to plans, subscriptions, payment events, failures, and reconciliation.

## Scope

- Subscription Overview
- Subscriptions List
- Subscription Details
- Plan Management
- Promotional Codes
- Payments Overview
- Payment Events
- Payment Event Details
- Failed Payments
- Billing Reconciliation

## Platform Breakdown

Where platform attribution is available, provide:

- Combined subscription totals
- iOS customer subscriptions
- Android customer subscriptions
- Multi-platform customer subscriptions
- Revenue by customer platform attribution
- Failed payments by platform
- Plan distribution by platform

A subscription belongs to a customer account, not to a device. Platform attribution must be presented as customer-usage context and must not duplicate revenue for multi-platform customers.

---

# 12. Phase 4 — Spec 005: Imports, Automation, Banks, and Parser Management

**Spec folder:** `specs/005-admin-imports-and-parsers`

## Goal

Implement the complete operational frontend for transaction capture, import processing, duplicate detection, bank coverage, and parser management.

## Scope

- Import Overview
- Import Sessions
- Import Session Details
- Failed Imports
- Low-Confidence Imports
- Duplicate Candidates
- Unsupported Formats
- Supported Banks
- Bank Details
- Sender Management
- Parser Rules
- Parser Rule Editor
- Parser Test Cases
- Parser Versions
- Merchant Rules
- Category Rules

## Android-Specific Data

- SMS imports
- Notification imports
- SMS permission state
- Notification Listener state
- Sender filtering
- Bank-app filtering
- Background processing
- Android parser performance
- Android app-version impact
- Android-specific unsupported formats

## iOS-Specific Data

- Shortcut imports
- App Intent submissions
- Share Extension imports
- Screenshot imports
- Receipt imports
- Voice entry
- iOS parser performance
- iOS app-version impact
- iOS-specific unsupported formats

## Combined Data

- Total import sessions
- Total extracted items
- Success rate
- Failure rate
- Duplicate candidate count
- Low-confidence count
- Average processing time
- Bank coverage
- Parser performance

All combined import totals are event totals and may be additive when the same event is not duplicated. Deduplication states must be visible.

---

# 13. Phase 5 — Spec 006: AI Management and Automation Intelligence

**Spec folder:** `specs/006-admin-ai-management`

## Goal

Implement complete AI operations, provider monitoring, usage, cost, prompts, safety, failures, and user reports.

## Scope

- AI Overview
- AI Providers
- Provider Details
- AI Models
- Prompt Versions
- Prompt Detail
- AI Usage
- AI Failures
- AI Response Reports
- AI Safety Rules

## Platform Breakdown

Where the originating client is available, show:

- Combined AI requests
- iOS AI requests
- Android AI requests
- Feature usage by platform
- Cost by platform
- Failure rate by platform
- Response time by platform
- Reported responses by platform

Relevant features include:

- Receipt analysis
- Screenshot analysis
- Voice parsing
- Categorization
- Financial assistant
- Spending insights
- Budget suggestions
- Behavior analysis
- Report explanation

Do not expose raw private AI conversations by default.

---

# 14. Phase 6 — Spec 007: Support, Feedback, Content, and Notifications

**Spec folder:** `specs/007-admin-support-content-and-notifications`

## Goal

Implement the complete support and communication workspace.

## Scope

- Support Dashboard
- Tickets List
- Ticket Details
- Ticket Assignment
- Support Categories
- Feedback Overview
- Feedback List
- Feedback Details
- Abuse Reports
- Default Categories
- Category Editor
- Financial Tips
- FAQs
- Onboarding Content
- Help Center Content
- Announcement Banners
- Email Templates
- Push Templates
- Notification Overview
- Notification Campaigns
- Campaign Creation
- Transactional Notifications
- Delivery Logs

## Platform Breakdown

Support and feedback must show:

- Combined ticket totals
- iOS tickets
- Android tickets
- Ticket type by platform
- App version
- OS version
- Platform-specific feature context
- iOS Shortcut or Share Extension issues
- Android SMS or Notification Listener issues

Notifications must show:

- Combined delivery totals
- iOS push delivery
- Android push delivery
- Failure rate by platform
- Token failure rate by platform
- Open rate by platform where available

---

# 15. Phase 7 — Spec 008: Security, Audit, and Data Privacy Requests

**Spec folder:** `specs/008-admin-security-audit-and-privacy`

## Goal

Implement security operations, immutable audit exploration, temporary access visibility, data exports, deletion workflows, and retention policies.

## Scope

- Security Overview
- Authentication Events
- Suspicious Activity
- Admin Security
- Permission Changes
- Active Support Access
- Security Incident Detail
- Audit Log Explorer
- Audit Event Details
- Data Export Requests
- Export Request Details
- Account Deletion Requests
- Account Deletion Detail
- Retention Policies

## Platform Breakdown

Security and customer-request views should support:

- Combined events
- iOS-originated events
- Android-originated events
- Device platform
- App version
- Session platform
- Risk indicators by platform

Security status must never rely on color alone.

---

# 16. Phase 8 — Spec 009: System Health, External Providers, Jobs, and Queues

**Spec folder:** `specs/009-admin-system-health-and-jobs`

## Goal

Implement the complete operational monitoring frontend for services, queues, processing jobs, and providers.

## Scope

- Health Overview
- API Monitoring
- Database Monitoring
- Storage Monitoring
- External Provider Health
- Queue Overview
- Job Runs
- Job Details
- Scheduled Jobs

## Platform-Specific Operational Views

Where jobs or errors originate from mobile clients, show:

- Combined volume
- iOS-originated volume
- Android-originated volume
- Failure rate by platform
- App-version correlation
- Platform-specific import queue state
- Platform-specific notification state

Infrastructure services remain global and should not be incorrectly divided by mobile platform when platform attribution does not apply.

---

# 17. Phase 9 — Spec 010: Admin Team, Roles, Permissions, Settings, and Final Integration

**Spec folder:** `specs/010-admin-governance-and-settings`

## Goal

Complete platform administration, role governance, feature configuration, cross-module consistency, and frontend-only release verification.

## Scope

- Admin Users
- Admin Profile
- Invite Admin
- Disable Admin
- Roles List
- Role Details
- Permission Matrix
- Create or Edit Role
- General Settings
- Mobile Application Settings
- Feature Flags
- Import Settings
- AI Settings
- Subscription Settings
- Security Settings
- Maintenance Mode
- Global Search completion
- Notification and Attention System completion
- Cross-module responsive review
- Cross-module accessibility review
- Design consistency review
- Mock contract consistency review
- Final route verification

## Mobile Settings Separation

Settings must clearly separate:

### iOS

- Minimum supported iOS version
- Latest iOS version
- Store link
- Force-update state
- Shortcut feature flag
- App Intents feature flag
- Share Extension feature flag
- Screenshot import flag
- Widget and quick-action flags

### Android

- Minimum supported Android version
- Latest Android version
- Store link
- Force-update state
- SMS tracking feature flag
- Notification Listener feature flag
- Background tracking flag
- Bank filtering flag

### Shared

- Receipt scan
- Voice entry
- AI assistant
- Budgets
- Debts
- Goals
- Advanced reports
- Investments
- Maintenance state

---

# 18. Required Structure of Every Spec

Each of the 10 Specs must include:

```text
# Feature Name

## Phase
## Goal
## Dependencies
## Related Backend Modules
## Related Database Entities
## Roles
## User Stories
## Routes
## Functional Requirements
## Platform Data Requirements
## UX and Design Requirements
## Responsive Requirements
## Accessibility Requirements
## Permissions
## Proposed API Contracts
## Frontend Types
## Mock Scenarios
## Loading States
## Empty States
## Error States
## Success States
## Warning and Confirmation States
## Audit Expectations
## Privacy Rules
## Out of Scope
## Acceptance Criteria
## Verification
```

Each Spec must explicitly identify itself, for example:

```text
Phase: Phase 0
Spec: 001-admin-foundation
```

---

# 19. Spec Kit Workflow

For each Phase, follow:

```text
/speckit.constitution
/speckit.specify
/speckit.clarify
/speckit.plan
/speckit.checklist
/speckit.tasks
/speckit.implement
```

Do not implement a Spec before:

- Its scope is isolated
- Dependencies are clear
- User stories are testable
- Platform data rules are defined
- Proposed API contracts are documented
- Permissions are documented
- Privacy requirements are documented
- Responsive behavior is documented
- Acceptance criteria are measurable

---

# 20. Mock API Requirements

The mock layer must simulate real HTTP behavior.

Required scenarios include:

- Default success
- Empty result
- Large result set
- Slow response
- Partial response
- Unauthorized
- Forbidden
- Not found
- Validation error
- Conflict
- Rate limited
- Provider unavailable
- Internal server error

Suggested common response types:

```ts
type ApiError = {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  correlationId?: string;
};

type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type PlatformBreakdown = {
  total: number;
  ios: number;
  android: number;
  multiPlatformCustomers?: number;
};
```

`PlatformBreakdown.total` must follow the semantic meaning of the metric. For unique customers, it must be deduplicated. For event counts, it may represent the sum of platform event counts when no duplication exists.

---

# 21. Global Route and Page Inventory

The detailed functional inventory below remains part of the specification. It defines the complete pages, fields, tables, filters, dialogs, and interactions that must be assigned to the 10 Specs above.

---

# 5. Admin User Roles

## 5.1 Super Admin

Can manage:

- Platform settings
- Admin roles
- Permissions
- AI providers
- Subscription plans
- Security settings
- Parser configuration
- Audit logs

## 5.2 Support Agent

Can manage:

- Support tickets
- Customer account status
- Device and session summary
- Account recovery workflows
- Temporary-access requests

Cannot freely access private financial data.

## 5.3 Billing Operator

Can manage:

- Subscriptions
- Payment failures
- Billing events
- Refund requests
- Plan changes
- Reconciliation issues

Cannot see customer transactions.

## 5.4 Parser and Import Operator

Can manage:

- Import failures
- Sender rules
- Bank-message templates
- Parser versions
- Unknown formats
- Duplicate-detection reports
- Merchant rules

Customer content must be masked or sanitized.

## 5.5 AI Operator

Can manage:

- AI providers
- Models
- Prompt versions
- Usage
- Cost
- Failure rates
- Safety reports
- User-reported AI responses

## 5.6 Content Manager

Can manage:

- Default categories
- Financial tips
- FAQs
- Onboarding content
- Email templates
- Push-notification templates
- Announcement banners

## 5.7 Security Administrator

Can manage:

- Security events
- Failed logins
- Suspicious sessions
- Permission changes
- Admin access logs
- Temporary support access
- Account deletion and export audits

---

# 6. Design Direction

Use the approved Masarifi Design System.

The Admin Dashboard should preserve:

- Official Masarifi logo
- Deep teal identity
- Warm cream and neutral surfaces
- Soft gold or bronze accents
- Arabic-first typography
- Clear financial and operational semantic colors
- Rounded surfaces
- Soft borders
- Restrained shadows

The Admin Dashboard should be more neutral and data-dense than the customer mobile application.

Use:

- Less decorative imagery
- Less gold
- Minimal Gulf patterns
- Strong tables
- Clear filters
- Compact cards
- High information clarity
- Strong status indicators

Avoid:

- Customer-style savings illustrations
- Marketing visuals
- Decorative landmarks
- Excessive gradients
- Excessive cards
- Crypto-dashboard styling
- Generic Bootstrap admin appearance
- Complex accounting-software density

---

# 7. Supported Viewports

Design and verify at:

- 1440px desktop
- 1280px laptop
- 1024px small laptop
- 768px tablet
- 390px mobile browser

The primary admin experience is desktop-first.

Responsive behavior:

- Desktop: full right RTL sidebar
- Laptop: compact sidebar option
- Small laptop: collapsible sidebar
- Tablet: drawer navigation
- Mobile: simplified monitoring and urgent-action experience

Complex tables should become:

- Responsive tables
- Horizontal-scroll tables
- Card lists
- Priority summaries

depending on the page.

---

# 8. Main Application Shell

## 8.1 Right Sidebar

Primary navigation:

1. Overview
2. Users
3. Subscriptions
4. Payments
5. Imports
6. Parser Management
7. AI Management
8. Support
9. Feedback
10. Content
11. Notifications
12. Security
13. Audit Logs
14. System Health
15. Jobs and Queues
16. Data Requests
17. Admin Team
18. Roles and Permissions
19. System Settings

Arabic labels:

- نظرة عامة
- المستخدمون
- الاشتراكات
- المدفوعات
- الاستيراد والمعاملات
- إدارة المحللات
- إدارة الذكاء الاصطناعي
- الدعم
- الملاحظات والبلاغات
- المحتوى
- الإشعارات
- الأمان
- سجلات التدقيق
- صحة النظام
- المهام والصفوف
- طلبات البيانات
- فريق الإدارة
- الأدوار والصلاحيات
- إعدادات النظام

The sidebar should support grouped navigation sections.

Recommended groups:

### Platform

- Overview
- System Health
- Jobs and Queues

### Customers and Revenue

- Users
- Subscriptions
- Payments
- Data Requests

### Operations

- Imports
- Parser Management
- AI Management
- Notifications

### Support and Content

- Support
- Feedback
- Content

### Governance

- Security
- Audit Logs
- Admin Team
- Roles and Permissions
- System Settings

## 8.2 Top Header

Include:

- Global search
- Date range
- Environment indicator
- Notifications
- Urgent incidents
- Language switcher
- Theme switcher
- Admin profile
- Quick actions

Environment options:

- Production
- Staging
- Development

Quick actions:

- Search user
- Open support ticket
- Review failed imports
- View critical incidents
- Create announcement

---

# 9. Global Frontend Components

Create reusable components for:

- Sidebar
- Topbar
- Breadcrumbs
- Page header
- Global search
- Date range selector
- Environment selector
- Metric card
- Trend card
- Status badge
- Severity badge
- Data table
- Filter toolbar
- Saved filters
- Pagination
- Bulk-selection toolbar
- Empty state
- Loading state
- Skeleton state
- Error state
- Access-denied state
- Drawer
- Dialog
- Confirmation dialog
- Temporary-access dialog
- User-summary drawer
- Incident drawer
- Notification panel
- Audit-log row
- Timeline
- Chart card
- Donut chart
- Line chart
- Bar chart
- Area chart
- Heatmap
- Health indicator
- Queue indicator
- JSON preview
- Masked-data field
- Copy button
- Export button
- Table column manager
- Activity feed
- Notes panel
- Internal-comment component
- Attachment component
- Permission matrix
- Role badge

Every interactive component must include:

- Default
- Hover
- Focus
- Active
- Selected
- Disabled
- Loading
- Success
- Warning
- Error

---

# 10. Complete Page Inventory

The complete frontend must include the following pages through separate Spec Kit feature specifications.

---

# 11. Authentication and Access Pages

## 11.1 Admin Login

Purpose:

- Demonstrate secure admin entry

Include:

- Email
- Password
- Two-factor authentication step
- Remember device
- Forgot password
- Security notice
- Environment label

## 11.2 Two-Factor Verification

Include:

- Verification code
- Recovery-code option
- Trusted-device notice
- Session details

## 11.3 Forgot Password

Include:

- Admin email
- Verification state
- Reset confirmation

## 11.4 Access Denied

Include:

- Missing permission
- Required role
- Return action
- Request-access action

## 11.5 Session Expired

Include:

- Expiration explanation
- Login action
- Unsaved-change warning

---

# 12. Overview Dashboard

## 12.1 Platform Overview

This is the main admin landing page.

Primary KPI cards:

- Total users
- Active users
- New users
- Paid users
- Free users
- Monthly recurring revenue
- Failed payments
- Imported transactions
- AI requests
- Open support tickets
- Critical incidents
- Failed background jobs

Recommended charts:

- User growth
- Daily active users
- Monthly active users
- Subscription distribution
- Revenue trend
- Import volume
- AI usage
- Mobile-platform distribution
- Application-version adoption
- Error-rate trend

Attention panel:

- Critical incidents
- Failed payments
- Import spikes
- AI provider outage
- Queue backlog
- Security alerts
- Pending account-deletion requests
- High-priority support tickets

Operational summary:

- API health
- Database health
- Redis health
- Worker health
- Storage health
- Stripe webhook health
- AI provider health
- Push notification health

Recent platform activity:

- New user
- Subscription upgrade
- Failed webhook
- Parser rule updated
- Admin role changed
- Support access approved
- Account deletion completed

---

# 13. User Management

## 13.1 Users List

Columns:

- User
- Masked email
- Country
- Language
- Platform
- Plan
- Account status
- Verification
- Registration date
- Last activity
- Risk indicator
- Actions

Filters:

- Status
- Plan
- Country
- Language
- Registration date
- Last activity
- Platform
- App version
- Verification state
- Risk state

Bulk actions:

- Export selected summary
- Send notification
- Suspend
- Reactivate
- Force logout

Sensitive bulk actions must require confirmation.

## 13.2 User Profile Summary

Tabs:

- Overview
- Subscription
- Devices
- Sessions
- Support
- Notifications
- Data requests
- Security events
- Audit history

Overview fields:

- User ID
- Name
- Masked email
- Country
- Language
- Currency
- Time zone
- Registration date
- Last activity
- Account status
- Onboarding status
- App platform
- App version
- Current plan

Aggregated financial metadata only:

- Number of accounts
- Number of transactions
- Number of goals
- Number of active debts
- Last synchronization time
- Import source counts

Do not display full values or transaction lists by default.

## 13.3 User Devices

Include:

- Device name
- Platform
- OS version
- App version
- Last seen
- Push status
- Tracking permissions
- Session state
- Revoke action

## 13.4 User Sessions

Include:

- Device
- IP region
- Started at
- Last activity
- Risk state
- Revoke session

## 13.5 Suspend User Dialog

Include:

- Reason
- Duration
- Internal note
- User-notification option
- Confirmation

## 13.6 Force Logout Dialog

Include:

- Selected sessions
- All devices option
- Reason
- Confirmation

---

# 14. Controlled Support Access

## 14.1 Access Requests List

Columns:

- Request ID
- User
- Support ticket
- Requested by
- Requested scope
- Reason
- Status
- Created
- Starts
- Expires
- Approved by

Statuses:

- Pending
- Approved
- Active
- Expired
- Rejected
- Revoked

## 14.2 Access Request Details

Include:

- Ticket summary
- User summary
- Requested fields
- Masking rules
- Requested duration
- Business reason
- Approval timeline
- Audit timeline

Actions:

- Approve
- Reject
- Modify scope
- Shorten duration
- Revoke

## 14.3 Temporary Access Workspace

This frontend screen demonstrates the required privacy controls and future controlled-access workflow.

Include:

- Persistent access-expiration banner
- Visible support-ticket reference
- Masked data
- Limited approved sections
- Watermark or access notice
- Audit indicator
- End-access action

---

# 15. Subscription Management

## 15.1 Subscription Overview

KPIs:

- Active subscriptions
- Trial users
- Free users
- Basic users
- Premium users
- New upgrades
- Downgrades
- Cancellations
- Churn rate
- MRR
- Failed renewals

Charts:

- Subscription growth
- Plan distribution
- Upgrade funnel
- Cancellation reasons
- Revenue by plan

## 15.2 Subscriptions List

Columns:

- User
- Plan
- Status
- Provider
- Renewal date
- Amount
- Currency
- Cancel at period end
- Payment status
- Actions

## 15.3 Subscription Details

Include:

- User summary
- Current plan
- Billing cycle
- Provider IDs
- Renewal date
- Cancellation state
- Feature limits
- AI usage limit
- Import limit
- Billing events
- Plan-change history

## 15.4 Plan Management

Include:

- Free
- Basic
- Premium
- Price
- Currency
- Billing intervals
- Feature limits
- AI limits
- Import limits
- Active status
- Stripe price mapping

Complete frontend edit forms backed by typed mock service contracts.

## 15.5 Promotional Codes

Include:

- Code
- Discount
- Duration
- Redemptions
- Limit
- Expiration
- Status

---

# 16. Payments and Billing

## 16.1 Payments Overview

KPIs:

- Successful payments
- Failed payments
- Refunded payments
- Disputed payments
- Pending payments
- Reconciliation issues

## 16.2 Payment Events

Columns:

- Event ID
- User
- Subscription
- Event type
- Amount
- Currency
- Provider
- Status
- Received
- Processed
- Retry count

## 16.3 Payment Event Details

Include:

- Provider event ID
- Event type
- Processing timeline
- Sanitized payload preview
- Related subscription
- Error information
- Retry history

## 16.4 Failed Payments

Include:

- User
- Plan
- Failed amount
- Reason
- Attempt count
- Next retry
- Customer notification state
- Resolution action

## 16.5 Billing Reconciliation

Include:

- Internal subscription status
- Stripe subscription status
- Difference
- Recommended action
- Reconcile action

---

# 17. Import and Transaction Automation

## 17.1 Import Overview

KPIs:

- Total imports
- Successful imports
- Failed imports
- Partial imports
- Pending review
- Duplicate candidates
- Unsupported formats
- Average processing time

Source distribution:

- Android SMS
- Android notifications
- iOS Shortcut
- Receipt images
- Screenshots
- CSV
- PDF statements
- Voice
- Manual

Charts:

- Import volume by source
- Success rate by source
- Failure trend
- Processing time
- Bank coverage
- Platform distribution

## 17.2 Import Sessions

Columns:

- Import ID
- User
- Source
- Platform
- Status
- Items
- Successful
- Failed
- Parser version
- Started
- Duration

## 17.3 Import Session Details

Include:

- Metadata
- Source
- Processing timeline
- Item summary
- Duplicate summary
- Parser used
- Failure reason
- Sanitized extraction result
- Retry action

## 17.4 Failed Imports

Filters:

- Source
- Bank
- Platform
- Parser version
- Failure reason
- Date
- App version

Actions:

- Retry
- Assign parser issue
- Mark unsupported
- Create rule
- Add internal note

## 17.5 Low-Confidence Imports

Include:

- Suggested merchant
- Suggested category
- Confidence
- Source
- Masked content
- Review state

## 17.6 Duplicate Candidates

Include:

- Imported item
- Existing transaction metadata
- Match score
- Match reasons
- Resolution
- User decision

## 17.7 Unsupported Formats

Include:

- Sender
- Bank
- Country
- Platform
- Frequency
- First detected
- Last detected
- Sample sanitized structure
- Create parser rule

---

# 18. Parser Management

## 18.1 Supported Banks

Columns:

- Bank
- Country
- Supported sources
- Sender count
- Active rules
- Success rate
- Last parser update
- Status

## 18.2 Bank Details

Tabs:

- Overview
- Senders
- Message templates
- Parser rules
- Test cases
- Performance
- Versions

## 18.3 Sender Management

Include:

- Sender name
- Bank
- Platform
- Language
- Match pattern
- Status
- Last seen

## 18.4 Parser Rules

Columns:

- Rule
- Bank
- Sender
- Language
- Priority
- Version
- Status
- Success rate
- Last updated

## 18.5 Parser Rule Editor

Frontend fields:

- Rule name
- Bank
- Sender pattern
- Language
- Priority
- Status
- Rule definition
- Sample input
- Expected normalized output

Include test preview.

## 18.6 Parser Test Cases

Include:

- Test name
- Source type
- Sanitized sample
- Expected output
- Actual output
- Pass or fail
- Version

## 18.7 Parser Versions

Include:

- Version
- Status
- Released by
- Released at
- Rules count
- Test pass rate
- Rollback action

## 18.8 Merchant Rules

Include:

- Canonical merchant
- Aliases
- Default category
- Country
- Priority
- Scope
- Status

## 18.9 Category Rules

Include:

- Matching pattern
- Suggested category
- Confidence
- User override count
- Accuracy

---

# 19. AI Management

## 19.1 AI Overview

KPIs:

- Total requests
- Successful requests
- Failed requests
- Estimated cost
- Average response time
- Average token usage
- User reports
- Fallback usage

Feature distribution:

- Receipt analysis
- Screenshot analysis
- Voice parsing
- Categorization
- Chat assistant
- Spending insights
- Budget suggestions
- Behavior analysis
- Report explanation

## 19.2 AI Providers

Columns:

- Provider
- Status
- Default model
- Features
- Average latency
- Failure rate
- Cost
- Fallback priority

## 19.3 Provider Details

Include:

- Models
- Supported features
- Rate limits
- Health
- Latency
- Error trend
- Cost trend
- Fallback configuration

Do not expose API keys.

## 19.4 AI Models

Include:

- Model
- Provider
- Feature assignment
- Input limits
- Cost estimate
- Status
- Version

## 19.5 Prompt Versions

Include:

- Prompt name
- Feature
- Version
- Status
- Created by
- Updated
- Success metric
- Rollback

## 19.6 Prompt Detail

Include:

- System prompt preview
- Variable list
- Output schema
- Validation rules
- Version history
- Test cases

Use sanitized example data.

## 19.7 AI Usage

Filters:

- Feature
- Provider
- Model
- Plan
- Date
- Status

Table:

- User
- Feature
- Provider
- Model
- Input units
- Output units
- Cost
- Status
- Time

## 19.8 AI Failures

Include:

- Feature
- Provider
- Model
- Error
- Attempts
- Fallback used
- User impact
- Resolution state

## 19.9 AI Response Reports

Include:

- Report ID
- User
- Feature
- Reason
- Severity
- Sanitized response
- Model
- Prompt version
- Status
- Reviewer

## 19.10 AI Safety Rules

Include:

- Rule
- Feature
- Severity
- Status
- Trigger count
- Last triggered

---

# 20. Support Management

## 20.1 Support Dashboard

KPIs:

- Open tickets
- Urgent tickets
- Awaiting customer
- Awaiting agent
- Resolved today
- Average response time
- Average resolution time

Charts:

- Tickets by type
- Tickets by priority
- Tickets by platform
- Ticket trend
- Resolution SLA

## 20.2 Tickets List

Columns:

- Ticket
- User
- Subject
- Type
- Priority
- Status
- Assigned agent
- Created
- Last update
- SLA

## 20.3 Ticket Details

Include:

- Ticket conversation
- User summary
- Platform and app version
- Related import
- Related payment
- Related AI report
- Internal notes
- Attachments
- Activity timeline
- Access-request action

## 20.4 Ticket Assignment

Include:

- Team
- Agent
- Priority
- Internal note

## 20.5 Support Categories

Include:

- Account
- Billing
- Transaction import
- SMS tracking
- Notification tracking
- iOS Shortcut
- Receipt scan
- AI assistant
- Data export
- Account deletion
- Security
- Other

---

# 21. Feedback and Reports

## 21.1 Feedback Overview

KPIs:

- New feedback
- Bug reports
- Feature requests
- Ratings
- AI feedback
- Import feedback

## 21.2 Feedback List

Columns:

- Feedback ID
- User
- Type
- Rating
- Message summary
- Platform
- App version
- Status
- Created

## 21.3 Feedback Details

Include:

- Full feedback
- User summary
- Device
- App version
- Attachments
- Internal notes
- Linked support ticket
- Resolution state

## 21.4 Abuse Reports

Include:

- Report type
- Reporter
- Target
- Severity
- Evidence
- Status
- Reviewer

---

# 22. Content Management

## 22.1 Default Categories

Include:

- Arabic name
- English name
- Parent category
- Transaction type
- Icon
- Color
- Active state
- Usage count

## 22.2 Category Editor

Include:

- Arabic name
- English name
- Key
- Parent
- Type
- Icon
- Color
- Sort order
- Status

## 22.3 Financial Tips

Include:

- Arabic content
- English content
- Category
- Audience
- Schedule
- Status
- Preview

## 22.4 FAQs

Include:

- Question
- Answer
- Language
- Section
- Sort order
- Status

## 22.5 Onboarding Content

Include:

- Step
- Platform
- Arabic copy
- English copy
- Illustration
- CTA
- Status

## 22.6 Help Center Content

Include:

- Article
- Category
- Platform
- Language
- Status
- Last updated

## 22.7 Announcement Banners

Include:

- Title
- Message
- Audience
- Platform
- Start
- End
- Priority
- Status
- Preview

## 22.8 Email Templates

Include:

- Template
- Trigger
- Language
- Subject
- Preview
- Status

## 22.9 Push Templates

Include:

- Template
- Trigger
- Platform
- Language
- Title
- Body
- Data payload
- Status

---

# 23. Notification Operations

## 23.1 Notification Overview

KPIs:

- Sent
- Delivered
- Opened
- Failed
- Opt-out rate
- Push-token failures

## 23.2 Notification Campaigns

Include:

- Campaign
- Audience
- Channel
- Status
- Scheduled
- Sent
- Delivered
- Opened

## 23.3 Create Campaign

Frontend steps:

1. Audience
2. Channel
3. Content
4. Schedule
5. Review

Channels:

- Push
- Email
- In-app

## 23.4 Transactional Notifications

Include templates for:

- Detected transaction
- Budget warning
- Installment reminder
- Salary detected
- Payment failure
- Subscription renewal
- Security alert

## 23.5 Delivery Logs

Columns:

- User
- Channel
- Template
- Status
- Sent
- Delivered
- Opened
- Failure reason

---

# 24. Security Center

## 24.1 Security Overview

KPIs:

- Failed logins
- Suspicious sessions
- Locked accounts
- Revoked sessions
- Admin permission changes
- Active support access
- Critical security events

## 24.2 Authentication Events

Columns:

- User or admin
- Event
- Device
- Region
- Risk
- Time
- Status

## 24.3 Suspicious Activity

Include:

- Actor
- Event
- Risk score
- Signals
- Time
- Status
- Assigned reviewer

## 24.4 Admin Security

Include:

- Admin
- Role
- Two-factor status
- Last login
- Active sessions
- Risk state

## 24.5 Permission Changes

Include:

- Admin
- Previous permission
- New permission
- Changed by
- Reason
- Time

## 24.6 Active Support Access

Include:

- Agent
- User
- Ticket
- Scope
- Started
- Expires
- End access

## 24.7 Security Incident Detail

Include:

- Severity
- Timeline
- Affected services
- Affected users
- Actions taken
- Internal notes
- Resolution

---

# 25. Audit Logs

## 25.1 Audit Log Explorer

Columns:

- Time
- Actor
- Actor type
- Action
- Resource
- Target user
- Result
- IP region
- Metadata
- Correlation ID

Filters:

- Actor
- Action
- Resource type
- Target user
- Result
- Date
- Severity

## 25.2 Audit Event Details

Include:

- Actor summary
- Action
- Resource
- Before and after summary
- Metadata JSON
- Related support ticket
- Related security incident
- Correlation ID

Audit logs must appear immutable.

---

# 26. System Health

## 26.1 Health Overview

Service cards:

- NestJS API
- Supabase database
- Supabase Auth
- Supabase Storage
- Redis
- BullMQ workers
- Stripe
- AI providers
- Email provider
- Push providers
- Exchange-rate provider
- Sentry

Each card shows:

- Status
- Uptime
- Latency
- Error rate
- Last incident
- Last check

## 26.2 API Monitoring

Include:

- Request volume
- Error rate
- Latency
- Slow endpoints
- Status-code distribution

## 26.3 Database Monitoring

Include:

- Connection usage
- Query latency
- Slow queries
- Storage usage
- Backup state
- Replication or recovery status

## 26.4 Storage Monitoring

Include:

- Storage usage
- Upload count
- Failed uploads
- Temporary files
- Retention cleanup

## 26.5 External Provider Health

Include:

- Stripe
- AI providers
- Email
- Push
- Exchange rates

---

# 27. Jobs and Queues

## 27.1 Queue Overview

Queues:

- Imports
- AI processing
- Notifications
- Reports
- Data exports
- Account deletion
- Subscription reconciliation

KPIs:

- Waiting
- Active
- Completed
- Failed
- Delayed
- Retried

## 27.2 Job Runs

Columns:

- Job
- Queue
- Status
- Attempt
- Started
- Duration
- Error
- Correlation ID

## 27.3 Job Details

Include:

- Job name
- Queue
- Input summary
- Attempts
- Timeline
- Error details
- Retry action
- Cancel action

## 27.4 Scheduled Jobs

Include:

- Job
- Schedule
- Last run
- Next run
- Last status
- Enabled

---

# 28. Data and Privacy Requests

## 28.1 Data Export Requests

Columns:

- Request
- User
- Status
- Requested
- Processing started
- Completed
- Expires
- Download state

## 28.2 Export Request Details

Include:

- User
- Requested scope
- Processing timeline
- Generated file
- Expiration
- Errors

## 28.3 Account Deletion Requests

Columns:

- Request
- User
- Status
- Requested
- Scheduled
- Subscription cancelled
- Data cleanup
- Completed

## 28.4 Account Deletion Detail

Checklist:

- User notified
- Subscription cancelled
- Active sessions revoked
- Exports handled
- Files removed
- Financial data deleted or anonymized
- AI data deleted
- Audit records preserved as required
- Completion confirmation

## 28.5 Retention Policies

Include:

- Data type
- Retention period
- Storage location
- Cleanup job
- Last cleanup
- Status

Complete settings interfaces backed by typed mock contracts.

---

# 29. Admin Team Management

## 29.1 Admin Users

Columns:

- Admin
- Role
- Department
- Status
- Two-factor
- Last login
- Active sessions
- Created

## 29.2 Admin Profile

Include:

- Profile
- Roles
- Permissions
- Assigned tickets
- Recent actions
- Sessions
- Security state

## 29.3 Invite Admin

Include:

- Email
- Name
- Role
- Department
- Expiration
- Message

## 29.4 Disable Admin

Include:

- Reason
- Session revocation
- Ticket reassignment
- Confirmation

---

# 30. Roles and Permissions

## 30.1 Roles List

Include:

- Role
- Users
- Permissions
- System role
- Updated
- Status

## 30.2 Role Details

Include:

- Role summary
- Assigned admins
- Permission groups
- Change history

## 30.3 Permission Matrix

Permission groups:

- Users
- Billing
- Imports
- Parsers
- AI
- Content
- Support
- Security
- Audit
- Settings

Actions:

- Read
- Create
- Update
- Delete
- Approve
- Export
- Temporary access

## 30.4 Create or Edit Role

Include:

- Name
- Description
- Permissions
- Expiration behavior
- Approval requirements

---

# 31. System Settings

## 31.1 General Settings

Include:

- Platform name
- Supported countries
- Supported currencies
- Supported languages
- Default time zone
- Maintenance mode
- Registration state

## 31.2 Mobile Application Settings

Include:

- Minimum supported iOS version
- Minimum supported Android version
- Latest version
- Force update
- Optional update
- Store links
- Feature flags

## 31.3 Feature Flags

Include:

- Feature
- Platform
- Audience
- Rollout percentage
- Status
- Start
- End

Example flags:

- Android SMS tracking
- Notification listener
- iOS Shortcut
- Receipt scan
- Voice entry
- AI assistant
- Investments
- Advanced reports

## 31.4 Import Settings

Include:

- Max file size
- Supported file types
- Processing timeout
- Retention
- Duplicate threshold
- AI fallback

## 31.5 AI Settings

Include:

- Feature limits
- Provider priorities
- Cost warning thresholds
- Safety state
- Fallback behavior

## 31.6 Subscription Settings

Include:

- Grace period
- Retry behavior
- Plan limits
- Trial length
- Cancellation policy

## 31.7 Security Settings

Include:

- Admin session duration
- Two-factor requirement
- Password policy
- Temporary-access maximum duration
- Risk thresholds

## 31.8 Maintenance Mode

Include:

- Status
- Message
- Affected platforms
- Start
- End
- Allowed admin roles

---

# 32. Search Experience

Global search should support:

- User ID
- Masked email
- Subscription ID
- Payment event ID
- Import ID
- Support ticket ID
- Audit event ID
- Job ID
- Parser rule
- Bank
- Admin user

Search results must be grouped by entity type.

---

# 33. Notification and Attention System

Admin notification types:

- Critical incident
- Failed payment spike
- AI provider outage
- Queue backlog
- Import failure spike
- Security alert
- Urgent support ticket
- Account deletion failure
- Backup issue
- Parser regression

Severity levels:

- Info
- Low
- Medium
- High
- Critical

Severity must use:

- Color
- Icon
- Label
- Text

not color alone.

---

# 34. Demo Data Requirements

Use realistic but fictional data.

Examples:

- UAE and Saudi users
- Arabic and English names
- AED and SAR
- iOS and Android devices
- Free, Basic, and Premium plans
- Successful and failed imports
- Different bank sources
- Different AI providers
- Operational incidents
- Support tickets

Do not use real personal data.

---

# 35. Frontend States

Every major page should demonstrate relevant states.

## Empty States

Examples:

- No incidents
- No failed payments
- No parser failures
- No support tickets
- No search results

## Loading States

- Page skeleton
- Table skeleton
- Chart skeleton
- Drawer loading

## Error States

- Failed to load
- Provider unavailable
- Permission denied
- Invalid filter
- Export failed

## Success States

- User suspended
- Rule created
- Ticket assigned
- Access approved
- Job retried

## Warning States

- Sensitive action
- Temporary access
- Plan change
- User suspension
- System setting change

---

# 36. Responsive Rules

## Desktop

- Full sidebar
- Multi-column overview
- Full tables
- Persistent filters
- Side drawers

## Laptop

- Compact sidebar
- Reduced horizontal padding
- Responsive table columns
- Overflow actions

## Tablet

- Sidebar drawer
- Two-column cards
- Filter drawer
- Tables with selective columns

## Mobile

Mobile admin is not intended for full configuration.

Prioritize:

- Incidents
- System health
- Support alerts
- User lookup
- Ticket summaries
- Approval actions
- Queue health

Complex settings should show a desktop-required notice where appropriate.

---

# 37. Accessibility Requirements

- WCAG-aligned contrast
- Keyboard navigation
- Visible focus states
- Semantic HTML
- Screen-reader labels
- 44px minimum touch targets
- Reduced-motion support
- Proper RTL order
- Clear table headers
- Accessible chart summaries
- Status labels beyond color
- Confirmation for destructive actions
- Accessible dialogs
- Logical tab order

---



---

# 22. Global Definition of Done

The complete Admin Dashboard frontend is ready only when:

- All 10 Specs are implemented.
- Work remains inside `D:\MY Work\0Part_Time\MASREFY _Final\apps\admin-web`.
- The approved visual identity is unchanged.
- Existing approved pages remain visually consistent.
- All new pages follow the same design architecture.
- Arabic RTL is correct.
- English LTR readiness is preserved.
- All target viewport sizes are verified.
- iOS, Android, and combined customer data are represented where relevant.
- Combined unique-customer totals are correctly deduplicated.
- Platform filters work consistently.
- All data access uses typed repositories or service interfaces.
- Mock HTTP handlers implement the proposed contracts.
- Loading, empty, error, permission, and success states exist.
- Sensitive customer data remains masked or excluded by default.
- Role and permission simulation works.
- Keyboard navigation works.
- Accessible chart summaries exist.
- TypeScript passes.
- Lint passes.
- Tests pass.
- Production build passes.
- Existing and new routes open without runtime errors.
- No new console errors exist.
- No real backend, database, payment, or AI integration was added.

---

# 23. Final Instruction

This document is the parent implementation plan for the complete Masarifi Admin Dashboard frontend.

Use exactly 10 Spec Kit specifications, mapped from Phase 0 through Phase 9.

Continue from the existing approved frontend. Do not replace it.

Preserve Masarifi Gulf Premium Design System Version 2.1 and all current approved design decisions.

Build only the frontend during these Phases, using typed mock contracts aligned with the planned NestJS backend.
