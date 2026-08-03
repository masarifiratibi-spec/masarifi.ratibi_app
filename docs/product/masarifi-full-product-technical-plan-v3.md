# Masarifi Platform — Full Product and Technical Plan

**Revision:** Version 3 — Customer Web Dashboard Removed

## Document Purpose

This document defines the complete product direction, system architecture, technical stack, platform responsibilities, implementation phases, and long-term roadmap for the Masarifi platform.

The platform will include:

- Marketing Website
- Admin Dashboard
- Shared NestJS Backend
- iOS Mobile Application
- Android Mobile Application
- AI and automation capabilities
- Subscription and payment infrastructure
- Financial transaction tracking and analysis

The system must be designed from the beginning so the same backend can serve the Admin Dashboard and both mobile applications.

---

# 1. High-Level System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                             MASARIFI PLATFORM                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────── CLIENT APPLICATIONS ───────────────────────────┐
│                                                                              │
│  ┌──────────────────────┐  ┌────────────────────┐                           │
│  │ Marketing Website    │  │ Admin Dashboard    │                           │
│  │ Next.js              │  │ Next.js            │                           │
│  │ Public               │  │ Restricted         │                           │
│  └──────────┬───────────┘  └─────────┬──────────┘                           │
│             │                        │                                      │
│  ┌──────────┴───────────┐  ┌─────────┴──────────┐                           │
│  │ iOS Mobile App       │  │ Android Mobile App │                           │
│  │ React Native + Expo  │  │ React Native + Expo│                           │
│  │ Shortcuts/App Intents│  │ SMS/Notification   │                           │
│  └──────────┬───────────┘  └─────────┬──────────┘                           │
└─────────────┼────────────────────────┼──────────────────────────────────────┘
              │                        │
              └────────────────────────┴──────────────────┐
                                                         │
                                                         ▼
┌──────────────────────────────── BACKEND API ─────────────────────────────────┐
│                                                                              │
│                         Shared NestJS Backend                                │
│                                                                              │
│  Authentication │ Users │ Transactions │ Budgets │ Debts │ Goals │ Reports  │
│  Accounts │ Imports │ AI │ Notifications │ Subscriptions │ Admin │ Audit     │
│                                                                              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
               ┌───────────────────────┼────────────────────────┐
               │                       │                        │
               ▼                       ▼                        ▼
┌────────────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐
│ Supabase               │  │ Background Services   │  │ External Providers   │
│ PostgreSQL             │  │ Redis + BullMQ        │  │ Stripe               │
│ Auth                   │  │ Workers               │  │ AI Providers         │
│ Storage                │  │ Scheduled Jobs        │  │ Email Provider       │
│ Realtime               │  │ Retry Processing      │  │ Exchange Rates       │
│ Vault                  │  │ Import Processing     │  │ Push Notifications   │
└────────────────────────┘  └───────────────────────┘  └──────────────────────┘
```

The Marketing Website is public and primarily focused on product communication, acquisition, trust, pricing, and app downloads.

All authenticated customer financial activity will take place inside the iOS and Android applications.

The Admin Dashboard is the only authenticated web application in the revised scope.

---

# 2. Deployment and Container Architecture

```text
┌──────────────────────────── DOCKER COMPOSE ─────────────────────────────┐
│                                                                         │
│  ┌─────────────────────┐                                                │
│  │ Admin Web           │                                                │
│  │ Next.js Container   │                                                │
│  └──────────┬──────────┘                                                │
│             │                                                           │
│             ▼                                                           │
│  ┌─────────────────────┐                                                │
│  │ NestJS API          │                                                │
│  │ API Container       │                                                │
│  └──────────┬──────────┘                                                │
│             │                                                           │
│             ├──────────────────────┐                                    │
│             ▼                      ▼                                    │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │ Worker Container    │  │ Redis Container     │                       │
│  │ BullMQ Jobs         │  │ Queue / Cache       │                       │
│  └─────────────────────┘  └─────────────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Optional local or self-hosted container:

- Marketing Website container, only when it is not deployed through a managed Next.js platform
```

External Managed Services:

- Supabase Cloud
- Stripe
- AI Providers
- Email Provider
- Push Notification Providers
- Error Monitoring

Each deployable service must have its own Dockerfile.

One `docker-compose.yml` file may manage the complete local development environment, but the entire system must not run inside a single container.

The mobile applications are not Docker containers. They consume the shared NestJS API.

---

# 3. Product Vision

Masarifi is a personal financial management platform designed for Arabic-speaking users, especially users in the UAE and Gulf region.

The core product promise is:

> Help users automatically capture financial activity, understand where their money goes, manage salary and obligations, and receive personalized financial insights.

Customer-facing financial management will be delivered through the mobile applications. The platform combines:

- Fast transaction entry
- Automatic transaction discovery
- Salary-cycle management
- Expense tracking
- Budget management
- Debts and installments
- Savings goals
- Reports and financial insights
- AI-assisted analysis
- Cross-platform synchronization

The platform should not position itself as a bank. It should be presented as a personal finance management and financial awareness platform.

---

# 4. Platform Components

## Revised Platform Scope

The Customer Web Dashboard has been removed from the product scope.

Customers will manage their financial data through the iOS and Android mobile applications.

The remaining web surfaces are:

- Public Marketing Website
- Restricted Admin Dashboard

The backend and database remain shared and continue to support all customer financial features through the mobile applications.


## 4.1 Marketing Website

### Purpose

- Explain the product
- Build trust
- Convert visitors into registered users
- Promote the mobile applications
- Explain privacy and security
- Present pricing plans
- Support search engine optimization

### Main Pages

- Home
- Features
- How It Works
- AI Features
- Automatic Transaction Tracking
- Pricing
- Security and Privacy
- Supported Banks and Message Formats
- FAQ
- Blog or Financial Education
- Contact
- Terms of Service
- Privacy Policy
- Cookie Policy
- Download App
- Login or account handoff to the mobile experience, if required
- Create Account or app-download handoff, depending on the final acquisition flow

### Recommended Stack

- Next.js
- TypeScript
- Tailwind CSS
- Server Components where appropriate
- Static generation for marketing pages
- SEO metadata and structured data
- Privacy-aware analytics

---


## 4.2 Admin Dashboard

The Admin Dashboard is an operational and support system. It must not become an unrestricted financial surveillance interface.

### Platform Overview

- Total users
- Active and new users
- Paid and free users
- Daily and monthly active users
- Transaction import volume
- AI usage
- Subscription revenue
- Failed payment count
- System health
- Queue health
- Error rates

### User Management

- Search users
- View account and subscription status
- View registration date and last activity
- Suspend or reactivate account
- Verify account
- Manage roles
- Force logout
- Reset selected security settings
- View device list

Admin users should not see private financial transaction details by default.

### Controlled Support Access

- A support case must exist
- A reason must be recorded
- Access must be time-limited
- Access must be logged
- Sensitive fields remain masked where possible
- User approval may be required
- All support actions appear in audit logs

### Subscription and Payment Management

- View subscriptions
- Failed payments
- Cancellations
- Plan changes
- Stripe webhook status
- Manual reconciliation
- Promotional codes
- Plan feature limits
- AI usage limits
- Billing errors

### Transaction Import Monitoring

- SMS import count
- Notification import count
- Manual, voice, receipt, and statement import counts
- Failed parsing count
- Duplicate detection count
- Unsupported message formats
- Parser performance by bank
- Unknown merchants
- Low-confidence transactions

### Bank and Message Rules

- Supported banks
- Supported sender names
- Message keywords
- Message templates
- Bank-specific parsing rules
- Generic parsing rules
- Merchant rules
- Category rules
- Parser versions
- Parser test cases
- Enable or disable rules

### AI Management

- AI provider status
- Model configuration
- Prompt versions
- Feature limits
- Usage reports
- Failed requests
- Cost tracking
- Safety rules
- Output quality review
- Provider fallback configuration

### Content Management

- Default categories
- Financial tips
- FAQ
- Help content
- Onboarding content
- Email templates
- Push notification templates
- Announcement banners

### Support and Feedback

- User feedback
- Support tickets
- Import issues
- Account deletion requests
- Billing requests
- AI response reports
- Abuse reports
- Internal support notes

### Audit and Security

- Admin activity logs
- User security events
- Authentication events
- Support-access logs
- Permission changes
- Subscription changes
- Account deletion events
- Failed login events
- Suspicious activity

### Recommended Stack

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Role-based navigation
- Strict backend authorization
- Mandatory audit logging

---

## 4.3 Shared NestJS Backend

The Shared NestJS Backend is the main application layer. All business rules must live in the backend. The Admin Dashboard and mobile applications must not directly control sensitive financial logic.

### Core Principles

- Modular Monolith first
- One backend for web and mobile
- REST API with versioning
- Strong authentication
- Role- and permission-based authorization
- Strict ownership checks
- Validation on every input
- Idempotent financial operations
- Audit logging
- Background processing
- Provider abstraction for AI and external services

### Main Modules

```text
src/modules/
├── auth/
├── users/
├── profiles/
├── devices/
├── accounts/
├── categories/
├── transactions/
├── transaction-imports/
├── transaction-parsers/
├── budgets/
├── salary/
├── recurring-transactions/
├── debts/
├── savings-goals/
├── investments/
├── reports/
├── files/
├── ai/
├── notifications/
├── subscriptions/
├── payments/
├── support/
├── feedback/
├── admin/
├── audit-logs/
└── system-settings/
```

### Authentication

- Supabase Auth integration
- JWT verification
- Session validation
- Roles and permissions
- Device registration
- Session revocation
- Admin authentication policies

### Transactions

- Income
- Expense
- Transfer
- Refund
- Recurring transaction
- Imported transaction
- Pending, confirmed, and rejected statuses
- Duplicate detection
- Attachments
- Transaction history
- Source tracking

### Import Sources

- Manual
- Voice
- Receipt image
- Bank screenshot
- CSV
- PDF statement
- Android SMS
- Android notification
- iOS Shortcut
- Web clipboard
- Future Open Finance integration

### Parsing Pipeline

```text
Raw Input
   │
   ▼
Source Validation
   │
   ▼
Sensitive Data Filtering
   │
   ▼
Bank / Sender Detection
   │
   ▼
Bank-Specific Parser
   │
   ├── Success ──► Normalized Transaction
   │
   └── Failure
          │
          ▼
Generic Parser
          │
          ├── Success ──► Normalized Transaction
          │
          └── Failure
                 │
                 ▼
AI Fallback
                 │
                 ▼
Manual Review Queue
```

### Duplicate Prevention

The backend must detect when the same transaction arrives from SMS, bank notification, statement import, manual import, repeated webhook, or multiple devices.

Signals may include:

- Amount
- Currency
- Date and time
- Merchant
- Account
- Card last four digits
- Message hash
- Provider transaction ID
- Source priority
- Transaction status

### Other Core Modules

- Budget calculations and alerts
- Salary-cycle calculations
- Debt payment schedules
- Savings-goal progress
- Reports and exports
- Private file upload and retention
- Subscription and billing
- Notifications
- Admin tools
- Audit logs

---

# 5. Mobile Applications

The mobile application will be developed for iOS and Android using a shared React Native codebase.

## Shared Features

- Registration and login
- Onboarding
- Dashboard
- Transactions
- Accounts
- Budgets
- Salary tracking
- Debts
- Savings goals
- Reports
- AI assistant
- Receipt scanner
- Voice input
- Push notifications
- Subscription management
- Settings
- Biometric lock
- Offline-friendly transaction creation
- Background synchronization

## Android-Specific Features

- SMS Auto-Tracking
- Notification Listener
- Background import processing
- Bank-app filtering
- Sender filtering
- Duplicate prevention
- Local parsing before synchronization
- Permission management
- User-controlled enable and disable settings

## iOS-Specific Features

- Shortcuts integration
- App Intents
- Share Extension
- Screenshot import
- Voice transaction entry
- Widgets
- Quick actions
- Push notifications

The iOS application must not promise unrestricted direct access to notifications or the SMS inbox.

## Recommended Stack

- React Native
- Expo Development Builds
- TypeScript
- Expo Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Expo SecureStore
- Expo Notifications
- Sentry
- Custom native modules where required

---

# 6. AI Architecture

AI must be a backend capability, not a direct client-side integration.

```text
┌───────────────────────────── AI REQUEST FLOW ─────────────────────────────┐
│                                                                          │
│ Admin Web / Mobile                                                             │
│      │                                                                   │
│      ▼                                                                   │
│ NestJS AI Gateway                                                        │
│      │                                                                   │
│      ├── Authentication                                                  │
│      ├── Feature Limit Check                                             │
│      ├── Input Validation                                                │
│      ├── Sensitive Data Filtering                                        │
│      ├── Prompt Selection                                                │
│      ├── Provider Selection                                              │
│      ├── Usage Logging                                                   │
│      └── Response Validation                                             │
│             │                                                            │
│             ▼                                                            │
│     OpenAI / Gemini / Claude                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

## AI Use Cases

- Receipt analysis
- Bank screenshot analysis
- Bank statement extraction
- Voice-to-transaction
- Transaction categorization
- Unknown message parsing
- Merchant classification
- Spending behavior analysis
- Personalized insights
- Financial assistant chatbot
- Budget suggestions
- Savings suggestions
- Unusual transaction detection
- Recurring payment detection
- Report explanations
- Conversation memory summarization

## AI Rules

- Financial calculations must remain deterministic
- AI explains results but must not invent financial values
- Outputs must be validated
- Usage must be limited by subscription plan
- Provider failures require fallback behavior
- Prompts must be versioned
- Costs must be tracked
- Sensitive data must be minimized

---

# 7. Supabase Responsibilities

Supabase will provide:

- PostgreSQL
- Authentication
- Storage
- Realtime
- Vault
- Backups
- Database management tools

## Supabase Vault

Vault will be used only for database-level secrets and internal Supabase integrations.

Application-level secrets used by NestJS should be stored in the hosting provider's secret manager.

### Supabase Vault Examples

- Database integration credentials
- Internal SQL function secrets
- Internal Supabase service tokens where necessary

### Backend Secret Manager Examples

- Stripe secret key
- Stripe webhook secret
- OpenAI key
- Gemini key
- Claude key
- Email provider credentials
- Push notification credentials
- Encryption keys

## Core Database Entities

- users
- profiles
- roles
- permissions
- devices
- accounts
- transactions
- transaction_imports
- imported_message_records
- transaction_duplicates
- categories
- custom_categories
- monthly_budgets
- category_budgets
- salary_profiles
- recurring_transactions
- debts
- debt_payments
- savings_goals
- savings_goal_entries
- investments
- uploaded_files
- notifications
- notification_preferences
- subscriptions
- payment_events
- ai_usage
- ai_conversations
- ai_messages
- support_tickets
- feedback
- admin_access_requests
- audit_logs
- system_settings
- parser_rules
- parser_versions
- merchant_rules

---


# 8. Database Architecture and Detailed Schema

## 8.1 Database Strategy

Masarifi will use Supabase-managed PostgreSQL as the primary transactional database.

The database will be treated as a first-class product component, not only as storage. It will enforce:

- Referential integrity
- Financial data constraints
- User data ownership
- Uniqueness rules
- Idempotency
- Auditability
- Safe deletion
- Multi-currency support
- Subscription limits
- Import traceability
- AI usage traceability

The application backend will access the database through Prisma and reviewed SQL where direct SQL is more appropriate.

The Admin Dashboard and mobile clients must not directly perform sensitive financial writes against the database. Sensitive operations must pass through the NestJS API.

---

## 8.2 Proposed Database Size

The complete production design contains:

- **1 Supabase-managed authentication table**
- **50 application tables**
- **4 primary reporting views**
- **Optional materialized views for high-volume reporting**

### Phase Distribution

- **MVP and core platform:** 33 application tables
- **Mobile transaction tracking and imports:** 7 additional tables
- **AI, support, and operational hardening:** 10 additional tables

Not every table must be implemented on the first day. The schema will be introduced through versioned migrations according to the implementation phases.

---

## 8.3 Database Schemas

```text
┌────────────────────────────── POSTGRESQL DATABASE ───────────────────────────┐
│                                                                              │
│  auth schema                                                                 │
│  └── users                       Managed by Supabase Auth                     │
│                                                                              │
│  public schema                                                               │
│  ├── Customer-facing financial and product data                              │
│  ├── Accounts, transactions, budgets, debts, goals                           │
│  ├── Subscriptions, notifications, imports, AI conversations                 │
│  └── Tables protected by ownership and authorization rules                   │
│                                                                              │
│  private schema                                                              │
│  ├── Sensitive internal processing data                                      │
│  ├── Raw import references where retention is required                       │
│  ├── Operational job state                                                   │
│  └── Tables inaccessible directly from client applications                   │
│                                                                              │
│  vault schema                                                                │
│  └── Database-level encrypted secrets managed through Supabase Vault          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8.4 Domain Table Summary

### Identity, Access, and Preferences — 8 Tables

1. `profiles`
2. `roles`
3. `permissions`
4. `role_permissions`
5. `user_roles`
6. `devices`
7. `user_preferences`
8. `user_consents`

### Core Finance — 15 Tables

9. `accounts`
10. `account_balance_snapshots`
11. `categories`
12. `transactions`
13. `transaction_attachments`
14. `recurring_transactions`
15. `salary_profiles`
16. `monthly_budgets`
17. `category_budgets`
18. `debts`
19. `debt_payments`
20. `savings_goals`
21. `savings_goal_entries`
22. `investments`
23. `investment_valuations`

### Imports and Transaction Automation — 8 Tables

24. `transaction_imports`
25. `imported_messages`
26. `import_items`
27. `duplicate_candidates`
28. `parser_rules`
29. `parser_versions`
30. `merchant_rules`
31. `merchant_aliases`

### Files and Notifications — 3 Tables

32. `uploaded_files`
33. `notifications`
34. `notification_preferences`

### Subscriptions and Payments — 3 Tables

35. `subscription_plans`
36. `subscriptions`
37. `payment_events`

### AI Platform — 4 Tables

38. `ai_usage`
39. `ai_conversations`
40. `ai_messages`
41. `ai_processing_jobs`

### Support, Administration, and Governance — 9 Tables

42. `support_tickets`
43. `support_ticket_messages`
44. `feedback`
45. `admin_access_requests`
46. `audit_logs`
47. `system_settings`
48. `data_export_requests`
49. `account_deletion_requests`
50. `job_runs`

### Supporting Reference Table

51. `exchange_rates`

`exchange_rates` is counted as a supporting application table. Therefore, the total implementation inventory is **51 application tables**, plus the Supabase-managed `auth.users` table.

The MVP does not require all 51 tables. The full number represents the complete target architecture.

---

## 8.5 Core Entity Relationship Overview

```text
auth.users
    │
    ├── 1:1 ── profiles
    ├── 1:N ── devices
    ├── M:N ── roles ── M:N ── permissions
    ├── 1:N ── user_consents
    ├── 1:1 ── user_preferences
    │
    ├── 1:N ── accounts
    │              │
    │              ├── 1:N ── account_balance_snapshots
    │              └── 1:N ── transactions
    │
    ├── 1:N ── categories
    ├── 1:N ── recurring_transactions
    ├── 1:1 ── salary_profiles
    ├── 1:N ── monthly_budgets
    ├── 1:N ── category_budgets
    ├── 1:N ── debts ── 1:N ── debt_payments
    ├── 1:N ── savings_goals ── 1:N ── savings_goal_entries
    ├── 1:N ── investments ── 1:N ── investment_valuations
    │
    ├── 1:N ── transaction_imports
    │              ├── 1:N ── imported_messages
    │              ├── 1:N ── import_items
    │              └── 1:N ── duplicate_candidates
    │
    ├── 1:N ── uploaded_files
    ├── 1:N ── notifications
    ├── 1:1 ── notification_preferences
    ├── 1:1 ── subscriptions ── 1:N ── payment_events
    ├── 1:N ── ai_conversations ── 1:N ── ai_messages
    ├── 1:N ── ai_usage
    ├── 1:N ── support_tickets ── 1:N ── support_ticket_messages
    ├── 1:N ── data_export_requests
    └── 1:N ── account_deletion_requests
```

---

## 8.6 Finance Relationship Diagram

```text
┌───────────────┐       1:N       ┌─────────────────────┐
│ accounts      │────────────────►│ transactions        │
└──────┬────────┘                  └───────┬─────────────┘
       │                                   │
       │ 1:N                               ├── N:1 ── categories
       ▼                                   ├── N:1 ── recurring_transactions
┌────────────────────────┐                 ├── 1:N ── transaction_attachments
│ account_balance_       │                 ├── 0:1 ── refund_of transaction
│ snapshots              │                 └── 0:1 ── source import_item
└────────────────────────┘

┌────────────────────┐      1:N      ┌───────────────────┐
│ debts              │──────────────►│ debt_payments     │
└────────────────────┘               └─────────┬─────────┘
                                              │
                                              └── 0:1 ── transactions

┌────────────────────┐      1:N      ┌────────────────────────┐
│ savings_goals      │──────────────►│ savings_goal_entries   │
└────────────────────┘               └─────────┬──────────────┘
                                              │
                                              └── 0:1 ── transactions

┌────────────────────┐      1:N      ┌────────────────────────┐
│ investments        │──────────────►│ investment_valuations  │
└────────────────────┘               └────────────────────────┘
```

---

## 8.7 Import and Automation Relationship Diagram

```text
┌────────────────────────┐
│ transaction_imports    │
│ one import session     │
└───────────┬────────────┘
            │
            ├── 1:N ── imported_messages
            │              SMS / Android notification / iOS Shortcut
            │
            ├── 1:N ── import_items
            │              Extracted normalized rows awaiting confirmation
            │
            └── 1:N ── duplicate_candidates
                           Possible match between an imported item
                           and an existing transaction

parser_versions
      │
      └── 1:N ── parser_rules
                      │
                      ├── N:1 optional bank or sender mapping
                      └── produces normalized import_items

merchant_rules
      │
      └── 1:N ── merchant_aliases
                      │
                      └── maps raw merchant names to categories
```

---

## 8.8 Table Specifications

### `profiles`

Purpose: Application profile linked to the Supabase authentication user.

Key columns:

- `user_id UUID PRIMARY KEY REFERENCES auth.users(id)`
- `display_name VARCHAR`
- `avatar_path TEXT`
- `preferred_language VARCHAR(5)`
- `preferred_currency CHAR(3)`
- `timezone VARCHAR`
- `country_code CHAR(2)`
- `onboarding_completed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Relationships:

- One profile belongs to one authenticated user.
- One user owns all customer financial records.

---

### `roles`

Purpose: System and administration roles.

Examples:

- `customer`
- `admin`
- `support_agent`
- `finance_operator`
- `content_manager`
- `security_admin`

Key columns:

- `id UUID`
- `key VARCHAR UNIQUE`
- `name VARCHAR`
- `description TEXT`
- `is_system BOOLEAN`

---

### `permissions`

Purpose: Fine-grained actions that may be assigned to roles.

Examples:

- `users.read_summary`
- `users.suspend`
- `support.request_access`
- `subscriptions.manage`
- `parsers.manage`
- `ai.configure`
- `audit.read`

---

### `role_permissions`

Purpose: Many-to-many mapping between roles and permissions.

Primary key:

- Composite key: `role_id`, `permission_id`

---

### `user_roles`

Purpose: Assign one or more roles to a user.

Key columns:

- `user_id UUID`
- `role_id UUID`
- `assigned_by UUID`
- `assigned_at TIMESTAMPTZ`
- `expires_at TIMESTAMPTZ NULL`

---

### `devices`

Purpose: Registered web and mobile devices.

Key columns:

- `id UUID`
- `user_id UUID`
- `platform VARCHAR`
- `device_name VARCHAR`
- `device_fingerprint_hash TEXT`
- `push_token_encrypted TEXT`
- `app_version VARCHAR`
- `last_seen_at TIMESTAMPTZ`
- `revoked_at TIMESTAMPTZ`

A user may own multiple devices.

---

### `user_preferences`

Purpose: Shared customer preferences.

Key columns:

- `user_id UUID PRIMARY KEY`
- `theme VARCHAR`
- `first_day_of_week SMALLINT`
- `default_account_id UUID NULL`
- `ai_personalization_enabled BOOLEAN`
- `automatic_categorization_enabled BOOLEAN`
- `transaction_confirmation_mode VARCHAR`

---

### `user_consents`

Purpose: Store explicit privacy and feature consent records.

Key columns:

- `id UUID`
- `user_id UUID`
- `consent_type VARCHAR`
- `version VARCHAR`
- `granted BOOLEAN`
- `granted_at TIMESTAMPTZ`
- `revoked_at TIMESTAMPTZ`
- `source VARCHAR`

Consent examples:

- Privacy policy
- Terms
- AI processing
- Receipt processing
- SMS tracking
- Notification tracking
- Analytics

---

### `accounts`

Purpose: Financial accounts, cards, wallets, and cash balances.

Key columns:

- `id UUID`
- `user_id UUID`
- `name VARCHAR`
- `account_type VARCHAR`
- `currency_code CHAR(3)`
- `opening_balance NUMERIC(18,4)`
- `current_balance NUMERIC(18,4)`
- `credit_limit NUMERIC(18,4) NULL`
- `institution_name VARCHAR NULL`
- `masked_number VARCHAR NULL`
- `is_default BOOLEAN`
- `is_archived BOOLEAN`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Constraints:

- Currency is required.
- A user may have only one default account per currency, unless the product chooses one global default.
- Financial values must never use JavaScript floating-point arithmetic.

---

### `account_balance_snapshots`

Purpose: Historical balance snapshots for reporting and reconciliation.

Key columns:

- `id UUID`
- `account_id UUID`
- `balance NUMERIC(18,4)`
- `available_balance NUMERIC(18,4) NULL`
- `captured_at TIMESTAMPTZ`
- `source VARCHAR`

---

### `categories`

Purpose: Global and user-defined categories.

Key columns:

- `id UUID`
- `user_id UUID NULL`
- `parent_id UUID NULL`
- `key VARCHAR`
- `name_ar VARCHAR`
- `name_en VARCHAR`
- `transaction_type VARCHAR`
- `icon VARCHAR`
- `color VARCHAR`
- `is_system BOOLEAN`
- `is_archived BOOLEAN`

Rules:

- `user_id IS NULL` represents a system category.
- User categories are private to their owner.
- System category keys must be unique.

---

### `transactions`

Purpose: The financial ledger of the customer.

Key columns:

- `id UUID`
- `user_id UUID`
- `account_id UUID`
- `category_id UUID NULL`
- `type VARCHAR`
- `status VARCHAR`
- `amount NUMERIC(18,4)`
- `currency_code CHAR(3)`
- `merchant_name VARCHAR NULL`
- `description TEXT NULL`
- `notes TEXT NULL`
- `occurred_at TIMESTAMPTZ`
- `posted_at TIMESTAMPTZ NULL`
- `source VARCHAR`
- `source_reference VARCHAR NULL`
- `recurring_transaction_id UUID NULL`
- `refund_of_id UUID NULL`
- `transfer_group_id UUID NULL`
- `import_item_id UUID NULL`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`
- `deleted_at TIMESTAMPTZ NULL`

Transaction types:

- `income`
- `expense`
- `transfer`
- `refund`
- `adjustment`

Transaction statuses:

- `pending`
- `confirmed`
- `posted`
- `rejected`
- `cancelled`

Constraints:

- Amount must be greater than zero.
- Refunds may reference an original transaction.
- Transfers must have a shared `transfer_group_id`.
- Every financial write must be idempotent where an external source is involved.

---

### `transaction_attachments`

Purpose: Link files to transactions.

Key columns:

- `id UUID`
- `transaction_id UUID`
- `uploaded_file_id UUID`
- `attachment_type VARCHAR`

---

### `recurring_transactions`

Purpose: Rules for expected repeated financial activity.

Key columns:

- `id UUID`
- `user_id UUID`
- `account_id UUID NULL`
- `category_id UUID NULL`
- `title VARCHAR`
- `type VARCHAR`
- `amount NUMERIC(18,4)`
- `currency_code CHAR(3)`
- `frequency VARCHAR`
- `day_of_month SMALLINT NULL`
- `next_run_at TIMESTAMPTZ`
- `auto_create BOOLEAN`
- `is_active BOOLEAN`

---

### `salary_profiles`

Purpose: Salary-cycle settings.

Key columns:

- `user_id UUID PRIMARY KEY`
- `salary_amount NUMERIC(18,4)`
- `currency_code CHAR(3)`
- `salary_day SMALLINT`
- `salary_source_name VARCHAR NULL`
- `salary_account_id UUID NULL`
- `next_salary_date DATE`
- `automatic_detection_enabled BOOLEAN`

---

### `monthly_budgets`

Purpose: Overall budget for one user and one month.

Key columns:

- `id UUID`
- `user_id UUID`
- `month DATE`
- `income_target NUMERIC(18,4) NULL`
- `expense_limit NUMERIC(18,4)`
- `savings_target NUMERIC(18,4) NULL`
- `rollover_enabled BOOLEAN`

Unique constraint:

- One monthly budget per user and month.

---

### `category_budgets`

Purpose: Spending limit for a category within a month.

Key columns:

- `id UUID`
- `user_id UUID`
- `monthly_budget_id UUID`
- `category_id UUID`
- `limit_amount NUMERIC(18,4)`
- `alert_threshold_percent SMALLINT`

Unique constraint:

- One category budget per category within the same monthly budget.

---

### `debts`

Purpose: Debts, loans, and installment plans.

Key columns:

- `id UUID`
- `user_id UUID`
- `title VARCHAR`
- `creditor_name VARCHAR NULL`
- `total_amount NUMERIC(18,4)`
- `paid_amount NUMERIC(18,4)`
- `currency_code CHAR(3)`
- `monthly_payment NUMERIC(18,4) NULL`
- `due_day SMALLINT NULL`
- `start_date DATE`
- `end_date DATE NULL`
- `status VARCHAR`
- `account_id UUID NULL`

Constraints:

- Paid amount cannot be negative.
- Paid amount cannot exceed total amount without an explicit overpayment rule.

---

### `debt_payments`

Purpose: Immutable history of debt payments.

Key columns:

- `id UUID`
- `debt_id UUID`
- `user_id UUID`
- `transaction_id UUID NULL`
- `amount NUMERIC(18,4)`
- `paid_at TIMESTAMPTZ`
- `notes TEXT NULL`

A debt payment may generate or reference an expense transaction.

---

### `savings_goals`

Purpose: User savings targets.

Key columns:

- `id UUID`
- `user_id UUID`
- `account_id UUID NULL`
- `title VARCHAR`
- `target_amount NUMERIC(18,4)`
- `current_amount NUMERIC(18,4)`
- `currency_code CHAR(3)`
- `deadline DATE NULL`
- `status VARCHAR`
- `is_emergency_fund BOOLEAN`

---

### `savings_goal_entries`

Purpose: Deposit and withdrawal history for a goal.

Key columns:

- `id UUID`
- `goal_id UUID`
- `user_id UUID`
- `transaction_id UUID NULL`
- `entry_type VARCHAR`
- `amount NUMERIC(18,4)`
- `occurred_at TIMESTAMPTZ`

---

### `investments`

Purpose: User-managed investment records.

Key columns:

- `id UUID`
- `user_id UUID`
- `title VARCHAR`
- `investment_type VARCHAR`
- `currency_code CHAR(3)`
- `initial_value NUMERIC(18,4)`
- `current_value NUMERIC(18,4)`
- `started_at DATE`
- `status VARCHAR`

---

### `investment_valuations`

Purpose: Historical investment valuations.

Key columns:

- `id UUID`
- `investment_id UUID`
- `value NUMERIC(18,4)`
- `valued_at TIMESTAMPTZ`
- `source VARCHAR`

---

### `transaction_imports`

Purpose: One import or tracking operation.

Examples:

- One bank statement upload
- One Android SMS scan
- One notification event
- One iOS Shortcut submission
- One receipt scan

Key columns:

- `id UUID`
- `user_id UUID`
- `source_type VARCHAR`
- `status VARCHAR`
- `device_id UUID NULL`
- `uploaded_file_id UUID NULL`
- `started_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ NULL`
- `total_items INTEGER`
- `successful_items INTEGER`
- `failed_items INTEGER`
- `parser_version_id UUID NULL`

---

### `imported_messages`

Purpose: Metadata for SMS, notifications, and Shortcuts inputs.

Key columns:

- `id UUID`
- `transaction_import_id UUID`
- `user_id UUID`
- `sender_hash TEXT`
- `message_hash TEXT`
- `received_at TIMESTAMPTZ`
- `source_platform VARCHAR`
- `raw_payload_retention_until TIMESTAMPTZ NULL`
- `sensitive_content_removed BOOLEAN`

The full raw message should not be retained by default.

---

### `import_items`

Purpose: Normalized items extracted from an import before or after user confirmation.

Key columns:

- `id UUID`
- `transaction_import_id UUID`
- `user_id UUID`
- `suggested_type VARCHAR`
- `suggested_amount NUMERIC(18,4)`
- `suggested_currency CHAR(3)`
- `suggested_merchant VARCHAR NULL`
- `suggested_category_id UUID NULL`
- `confidence NUMERIC(5,4)`
- `review_status VARCHAR`
- `created_transaction_id UUID NULL`

---

### `duplicate_candidates`

Purpose: Record possible duplicate matches.

Key columns:

- `id UUID`
- `user_id UUID`
- `import_item_id UUID`
- `existing_transaction_id UUID`
- `match_score NUMERIC(5,4)`
- `match_reasons JSONB`
- `resolution VARCHAR`

---

### `parser_versions`

Purpose: Version every deployed parser behavior.

Key columns:

- `id UUID`
- `name VARCHAR`
- `version VARCHAR`
- `status VARCHAR`
- `released_at TIMESTAMPTZ`
- `created_by UUID`

---

### `parser_rules`

Purpose: Configurable parsing rules for banks, senders, languages, and formats.

Key columns:

- `id UUID`
- `parser_version_id UUID`
- `bank_key VARCHAR NULL`
- `sender_pattern VARCHAR NULL`
- `message_pattern TEXT`
- `language VARCHAR`
- `priority INTEGER`
- `is_active BOOLEAN`
- `rule_definition JSONB`

---

### `merchant_rules`

Purpose: Categorization and normalization rules.

Key columns:

- `id UUID`
- `user_id UUID NULL`
- `canonical_name VARCHAR`
- `category_id UUID`
- `priority INTEGER`
- `is_active BOOLEAN`

Global rules have `user_id IS NULL`. User-specific rules override global rules.

---

### `merchant_aliases`

Purpose: Multiple raw merchant names mapped to one canonical merchant.

Key columns:

- `id UUID`
- `merchant_rule_id UUID`
- `alias_pattern VARCHAR`
- `match_type VARCHAR`

---

### `uploaded_files`

Purpose: File metadata. Actual binary content is stored in Supabase Storage.

Key columns:

- `id UUID`
- `user_id UUID`
- `bucket VARCHAR`
- `object_path TEXT`
- `original_name VARCHAR`
- `mime_type VARCHAR`
- `size_bytes BIGINT`
- `checksum TEXT`
- `purpose VARCHAR`
- `processing_status VARCHAR`
- `retention_until TIMESTAMPTZ NULL`
- `deleted_at TIMESTAMPTZ NULL`

---

### `notifications`

Purpose: User notification inbox.

Key columns:

- `id UUID`
- `user_id UUID`
- `type VARCHAR`
- `title VARCHAR`
- `body TEXT`
- `data JSONB`
- `read_at TIMESTAMPTZ NULL`
- `sent_at TIMESTAMPTZ NULL`
- `delivery_status VARCHAR`

---

### `notification_preferences`

Purpose: Per-user notification settings.

Key columns:

- `user_id UUID PRIMARY KEY`
- `push_enabled BOOLEAN`
- `email_enabled BOOLEAN`
- `expense_alerts BOOLEAN`
- `income_alerts BOOLEAN`
- `budget_alerts BOOLEAN`
- `debt_alerts BOOLEAN`
- `salary_alerts BOOLEAN`
- `ai_insights BOOLEAN`
- `quiet_hours JSONB`

---

### `subscription_plans`

Purpose: Versioned product plans.

Key columns:

- `id UUID`
- `key VARCHAR UNIQUE`
- `name VARCHAR`
- `billing_interval VARCHAR`
- `price_amount NUMERIC(18,4)`
- `currency_code CHAR(3)`
- `stripe_price_id VARCHAR NULL`
- `feature_limits JSONB`
- `is_active BOOLEAN`

---

### `subscriptions`

Purpose: Current subscription state of a user.

Key columns:

- `id UUID`
- `user_id UUID UNIQUE`
- `plan_id UUID`
- `provider VARCHAR`
- `provider_customer_id VARCHAR NULL`
- `provider_subscription_id VARCHAR NULL`
- `status VARCHAR`
- `current_period_start TIMESTAMPTZ NULL`
- `current_period_end TIMESTAMPTZ NULL`
- `cancel_at_period_end BOOLEAN`

---

### `payment_events`

Purpose: Immutable payment and webhook event ledger.

Key columns:

- `id UUID`
- `subscription_id UUID NULL`
- `provider VARCHAR`
- `provider_event_id VARCHAR UNIQUE`
- `event_type VARCHAR`
- `amount NUMERIC(18,4) NULL`
- `currency_code CHAR(3) NULL`
- `status VARCHAR`
- `received_at TIMESTAMPTZ`
- `processed_at TIMESTAMPTZ NULL`
- `payload_hash TEXT`

---

### `ai_usage`

Purpose: Track cost and limits by feature, user, and period.

Key columns:

- `id UUID`
- `user_id UUID`
- `feature VARCHAR`
- `provider VARCHAR`
- `model VARCHAR`
- `input_units INTEGER`
- `output_units INTEGER`
- `estimated_cost NUMERIC(18,6)`
- `billing_period DATE`
- `created_at TIMESTAMPTZ`

---

### `ai_conversations`

Purpose: Financial assistant conversations.

Key columns:

- `id UUID`
- `user_id UUID`
- `title VARCHAR`
- `summary TEXT NULL`
- `status VARCHAR`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

---

### `ai_messages`

Purpose: Messages within a conversation.

Key columns:

- `id UUID`
- `conversation_id UUID`
- `role VARCHAR`
- `content_encrypted TEXT`
- `structured_data JSONB NULL`
- `model VARCHAR NULL`
- `created_at TIMESTAMPTZ`

---

### `ai_processing_jobs`

Purpose: Asynchronous AI operations.

Examples:

- Receipt analysis
- Statement extraction
- Behavior analysis
- Monthly insights

Key columns:

- `id UUID`
- `user_id UUID`
- `job_type VARCHAR`
- `status VARCHAR`
- `input_reference JSONB`
- `result_reference JSONB NULL`
- `attempt_count INTEGER`
- `started_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `error_code VARCHAR NULL`

---

### `support_tickets`

Purpose: Customer support cases.

Key columns:

- `id UUID`
- `user_id UUID`
- `assigned_to UUID NULL`
- `type VARCHAR`
- `priority VARCHAR`
- `status VARCHAR`
- `subject VARCHAR`
- `created_at TIMESTAMPTZ`

---

### `support_ticket_messages`

Purpose: Messages and internal notes attached to support tickets.

Key columns:

- `id UUID`
- `ticket_id UUID`
- `author_user_id UUID`
- `message_type VARCHAR`
- `content TEXT`
- `created_at TIMESTAMPTZ`

---

### `feedback`

Purpose: Ratings, suggestions, bug reports, and AI feedback.

Key columns:

- `id UUID`
- `user_id UUID NULL`
- `feedback_type VARCHAR`
- `rating SMALLINT NULL`
- `message TEXT`
- `status VARCHAR`
- `created_at TIMESTAMPTZ`

---

### `admin_access_requests`

Purpose: Controlled temporary access to sensitive customer data.

Key columns:

- `id UUID`
- `target_user_id UUID`
- `requested_by UUID`
- `approved_by UUID NULL`
- `support_ticket_id UUID`
- `reason TEXT`
- `scope JSONB`
- `status VARCHAR`
- `starts_at TIMESTAMPTZ NULL`
- `expires_at TIMESTAMPTZ NULL`

---

### `audit_logs`

Purpose: Append-only security and operational trail.

Key columns:

- `id UUID`
- `actor_user_id UUID NULL`
- `actor_type VARCHAR`
- `action VARCHAR`
- `resource_type VARCHAR`
- `resource_id UUID NULL`
- `target_user_id UUID NULL`
- `metadata JSONB`
- `ip_hash TEXT NULL`
- `created_at TIMESTAMPTZ`

Audit rows must not be editable through normal application flows.

---

### `system_settings`

Purpose: Versioned platform-wide settings.

Key columns:

- `key VARCHAR PRIMARY KEY`
- `value JSONB`
- `is_sensitive BOOLEAN`
- `updated_by UUID`
- `updated_at TIMESTAMPTZ`

Secrets must not be stored here. Secrets belong in Vault or the hosting secret manager.

---

### `data_export_requests`

Purpose: User requests to export personal data.

Key columns:

- `id UUID`
- `user_id UUID`
- `status VARCHAR`
- `requested_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ NULL`
- `uploaded_file_id UUID NULL`
- `expires_at TIMESTAMPTZ NULL`

---

### `account_deletion_requests`

Purpose: Safe account deletion workflow.

Key columns:

- `id UUID`
- `user_id UUID`
- `status VARCHAR`
- `requested_at TIMESTAMPTZ`
- `scheduled_for TIMESTAMPTZ`
- `subscription_cancelled_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`
- `failure_reason TEXT NULL`

---

### `job_runs`

Purpose: Operational history for scheduled and queued jobs.

Key columns:

- `id UUID`
- `job_name VARCHAR`
- `queue_name VARCHAR`
- `status VARCHAR`
- `attempt INTEGER`
- `started_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ NULL`
- `error_code VARCHAR NULL`
- `metadata JSONB`

---

### `exchange_rates`

Purpose: Cached exchange rates used by financial tools and reporting.

Key columns:

- `id UUID`
- `base_currency CHAR(3)`
- `quote_currency CHAR(3)`
- `rate NUMERIC(24,10)`
- `provider VARCHAR`
- `effective_at TIMESTAMPTZ`

Unique constraint:

- Base currency, quote currency, provider, and effective timestamp combination.

---

## 8.9 Primary Database Views

### `v_monthly_financial_summary`

Returns per user and month:

- Total income
- Total expense
- Net cash flow
- Savings rate
- Confirmed transaction count
- Pending transaction count

### `v_category_spending_summary`

Returns:

- User
- Month
- Category
- Total expense
- Transaction count
- Percentage of monthly expenses

### `v_salary_cycle_summary`

Returns:

- Salary-cycle start
- Next salary date
- Salary income
- Cycle expenses
- Upcoming obligations
- Remaining available amount
- Suggested daily spending

### `v_account_balance_summary`

Returns:

- Current balance
- Pending outflow
- Pending inflow
- Available estimated balance
- Last activity date

Views must still enforce user ownership through the API and database policies.

---

## 8.10 Important Constraints

The database must enforce at least the following:

- Financial amounts must be positive where negative values are not explicitly valid.
- Currency codes must use ISO 4217-compatible values.
- Debt payments cannot silently exceed the remaining debt.
- One user cannot reference another user's account or category.
- One user may only update records they own.
- Stripe provider event IDs must be unique.
- External import references must be idempotent.
- Duplicate transaction decisions must be traceable.
- Monthly budget uniqueness must be enforced.
- Default-account uniqueness must be enforced.
- Deleted financial records must not disappear from audit history.
- Admin access must expire automatically.
- Raw SMS and notification content must follow a short retention policy.

---

## 8.11 Indexing Strategy

### High-Priority Transaction Indexes

- `transactions(user_id, occurred_at DESC)`
- `transactions(user_id, account_id, occurred_at DESC)`
- `transactions(user_id, category_id, occurred_at DESC)`
- `transactions(user_id, status, occurred_at DESC)`
- `transactions(source, source_reference)`
- Partial index for non-deleted transactions
- Partial index for pending transactions

### Import Indexes

- `imported_messages(user_id, message_hash)`
- `transaction_imports(user_id, created_at DESC)`
- `import_items(transaction_import_id, review_status)`
- `duplicate_candidates(import_item_id, resolution)`

### Operational Indexes

- `notifications(user_id, read_at, created_at DESC)`
- `audit_logs(target_user_id, created_at DESC)`
- `payment_events(provider_event_id)`
- `ai_usage(user_id, billing_period, feature)`
- `support_tickets(status, priority, created_at)`

Indexes must be validated through query plans. The project must not add indexes blindly to every foreign key without reviewing actual workload.

---

## 8.12 Row-Level Security and Data Access

Supabase Row-Level Security should provide defense in depth, even when NestJS is the primary backend.

### Customer Rules

A customer may:

- Read and modify their own profile.
- Read and modify their own financial records.
- Read system categories and their own custom categories.
- Read their own notifications, subscription, AI conversations, and support tickets.
- Never read another user's records.

### Admin Rules

Admin access should not rely only on a generic `admin = true` flag.

Access must be permission-based.

Examples:

- Support may see account metadata but not full financial history.
- Billing staff may see subscriptions but not transactions.
- Parser operators may see anonymized failed formats.
- Security administrators may see audit events but not financial notes.

### Service Role Rules

The Supabase service-role key must only exist in trusted backend environments.

It must never be included in:

- Next.js browser bundles
- React Native applications
- Public environment variables
- Client logs

---

## 8.13 Deletion, Retention, and Privacy

### Soft Delete

Use `deleted_at` for records where recovery or financial auditability is required.

Examples:

- Transactions
- Accounts
- Categories
- Uploaded files

### Hard Delete or Anonymization

User deletion must define what happens to:

- Financial records
- Uploaded documents
- AI conversations
- Support messages
- Feedback
- Audit logs
- Payment records

Payment and security audit records may need anonymization rather than immediate physical deletion.

### Suggested Retention Rules

- Raw SMS or notification content: do not retain by default.
- Message hashes and extracted metadata: retain for deduplication.
- Temporary receipt and statement files: short configurable retention.
- Generated exports: automatic expiration.
- Audit records: longer controlled retention.
- Failed processing payloads: sanitized before retention.

The final legal retention periods must be confirmed before production launch.

---

## 8.14 Backup and Recovery

The database plan must include:

- Supabase automated backups
- Point-in-time recovery where the selected plan supports it
- Regular restoration tests
- Migration backups before risky releases
- Storage backup strategy for critical uploaded files
- Defined Recovery Point Objective
- Defined Recovery Time Objective
- Documented restore runbook

A backup is not considered valid until restoration has been tested.

---

## 8.15 Migration Strategy

All schema changes must be version-controlled.

Recommended directory:

```text
supabase/
├── migrations/
│   ├── 0001_identity.sql
│   ├── 0002_finance_core.sql
│   ├── 0003_budgets_and_salary.sql
│   ├── 0004_debts_and_goals.sql
│   ├── 0005_import_pipeline.sql
│   ├── 0006_subscriptions.sql
│   ├── 0007_ai.sql
│   └── 0008_admin_and_audit.sql
├── seed/
├── policies/
└── tests/
```

Migration rules:

- Never edit a migration already applied to a shared environment.
- Add a new migration for every change.
- Review destructive changes manually.
- Use expand-and-contract migrations for risky changes.
- Backfill data in controlled jobs.
- Keep Prisma schema and SQL migrations synchronized.
- Run database tests in CI.

---

## 8.16 Data Migration from Base44

The current Base44 project includes user, transaction, savings-goal, debt, investment, monthly-budget, category-budget, recurring-transaction, custom-category, account, and feedback entities.

These models will be treated as a migration baseline, not copied blindly.

Migration stages:

1. Export Base44 entities.
2. Validate ownership fields.
3. Normalize currency values.
4. Convert categories to explicit foreign keys.
5. Convert date and month strings to PostgreSQL date/timestamp types.
6. Create account references where missing.
7. Link refunds to original transactions where possible.
8. Migrate goals, debts, investments, and budgets.
9. Recalculate derived values.
10. Run reconciliation reports.
11. Obtain client approval before production cutover.

Unclear or incomplete Base44 records must enter a review report rather than being silently changed.

---

## 8.17 Database Testing

Required database tests:

- User ownership isolation
- Admin permission boundaries
- Transaction amount constraints
- Transfer atomicity
- Refund rules
- Debt payment atomicity
- Goal entry atomicity
- Monthly budget uniqueness
- Duplicate import detection
- Stripe event idempotency
- Account deletion workflow
- Audit-log immutability
- Currency precision
- Migration rollback or forward-recovery behavior

---

## 8.18 Database Implementation by Phase

### Phase 1

- Supabase project setup
- Migration framework
- Prisma connection
- Local database environment
- Naming and timestamp conventions

### Phase 2

- Identity and access tables
- Profiles
- Devices
- Preferences
- Consent
- RLS foundation
- Audit foundation

### Phase 3

- Accounts
- Categories
- Transactions
- Recurring transactions
- Salary
- Budgets
- Debts
- Goals
- Core financial views

### Phase 5

- Files
- Imports
- Imported messages
- Import items
- Duplicates
- Parser rules
- Merchant rules

### Phase 6

- AI usage
- Conversations
- Messages
- Processing jobs

### Phase 7

- Subscription plans
- Subscriptions
- Payment events

### Phase 9 and Phase 10

- Mobile device tracking metadata
- Android SMS and notification sources
- iOS Shortcut sources
- Import quality metrics

### Phase 12

- Retention automation
- Backup verification
- Performance tuning
- Archival strategy
- Security review

---


# 9. Security and Privacy

Because the platform handles financial data, security must be designed from the beginning.

## Required Controls

- HTTPS everywhere
- Strong authentication
- Device and session management
- Role-based access control
- Permission-based admin access
- Ownership checks
- Database constraints
- Secure file storage
- Signed file URLs
- Encryption in transit and at rest
- Secret rotation
- Rate limiting
- Brute-force protection
- Audit logs
- Data export controls
- Account deletion workflow
- Data retention rules
- Privacy policy
- Consent records
- Incident response process
- Dependency scanning
- Security monitoring

## Admin Privacy Rules

Admins must not automatically see:

- Full transaction history
- Full salary information
- Merchant names
- Debt details
- Uploaded bank statements
- Raw SMS content
- Raw notification content

Temporary support access must be controlled, time-limited, justified, and logged.

---

# 10. Repository Structure

```text
masarifi/
├── apps/
│   ├── marketing-web/
│   ├── admin-web/
│   ├── api/
│   └── mobile/
│
├── packages/
│   ├── shared-types/
│   ├── validation/
│   ├── api-client/
│   ├── finance-core/
│   ├── transaction-parser/
│   ├── config/
│   ├── eslint-config/
│   └── ui-tokens/
│
├── supabase/
│   ├── migrations/
│   ├── seed/
│   ├── policies/
│   └── tests/
│
├── docker/
│   ├── local/
│   └── production/
│
├── docs/
│   ├── architecture/
│   ├── product/
│   ├── api/
│   ├── security/
│   └── deployment/
│
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

---

# 11. Recommended Technology Stack

## Monorepo and Tooling

- Turborepo
- pnpm workspaces
- TypeScript
- ESLint
- Prettier
- Husky
- lint-staged
- Commitlint

## Marketing Website

- Next.js
- TypeScript
- Tailwind CSS
- Server Components where appropriate
- Static generation
- SEO metadata and structured data
- Privacy-aware analytics

## Admin Dashboard

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Recharts where operational charts are required
- OpenAPI-generated API client
- Role-aware navigation and permission-aware actions

## Backend

- NestJS
- TypeScript
- REST API
- Swagger / OpenAPI
- Prisma
- PostgreSQL
- BullMQ
- Redis
- Pino
- Sentry

## Mobile

- React Native
- Expo Development Builds
- TypeScript
- Expo Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Expo SecureStore
- Expo Notifications
- Custom native modules

## Platform Services

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Vault
- Managed Redis
- Stripe
- AI providers
- Email provider
- Push notification providers
- Sentry

## Testing

- Jest
- Vitest where appropriate
- Supertest
- Playwright
- React Native Testing Library
- Database integration tests
- Parser test suites
- Security tests
- Load testing for critical endpoints

---

# 12. Implementation Phases

## Phase 0 — Product Discovery and Final Scope

### Objectives

- Confirm product positioning
- Confirm MVP scope
- Confirm supported languages
- Confirm UAE-first requirements
- Review the existing Base44 application
- Identify reusable UI and business logic
- Define delayed features
- Confirm subscription model
- Confirm privacy requirements

### Deliverables

- Approved product scope
- Feature priority matrix
- User personas
- User flows
- Product requirements document
- Risk register
- Migration decision document

---

## Phase 1 — Architecture and Foundation

### Objectives

- Create monorepo
- Configure TypeScript
- Configure Docker
- Configure CI
- Configure local development
- Create Supabase environments
- Create backend skeleton
- Create Marketing Website and Admin Dashboard skeletons
- Define coding standards

### Deliverables

- Monorepo structure
- Docker setup
- CI pipeline
- Environment strategy
- Logging and error handling foundation
- API versioning
- Base documentation

---

## Phase 2 — Database, Authentication, and Authorization

### Objectives

- Design PostgreSQL schema
- Create migrations
- Integrate Supabase Auth
- Implement NestJS JWT validation
- Implement roles and permissions
- Implement user profiles
- Implement device sessions
- Implement audit logging

### Deliverables

- Database schema
- Auth flow
- User profile API
- Roles and permissions
- Session management
- Admin access controls
- Audit log system

---

## Phase 3 — Core Financial Backend

### Objectives

- Accounts
- Categories
- Transactions
- Transfers
- Refunds
- Recurring transactions
- Salary profiles
- Monthly budgets
- Category budgets
- Debts
- Savings goals

### Deliverables

- Stable financial API
- Ownership rules
- Financial calculation library
- Transaction history
- Budget calculations
- Debt-payment transactions
- Savings-goal tracking
- Unit and integration tests

---


## Phase 4 — Admin Dashboard

### Objectives

- Admin authentication
- Platform overview
- User management
- Subscription monitoring
- Support tools
- Parser management
- AI monitoring
- Audit logs
- System settings

### Deliverables

- Secure admin dashboard
- Role-based admin access
- Support workflows
- Operational monitoring
- Parser configuration tools
- Privacy-safe user management

---

## Phase 5 — Import and Automation Foundation

### Objectives

- Receipt import
- Screenshot import
- CSV import
- PDF statement import
- Parsing pipeline
- Duplicate detection
- Review queue
- Import history

### Deliverables

- File upload system
- Import processing workers
- Normalized transaction format
- Duplicate prevention
- Manual review screens
- Import quality metrics

---

## Phase 6 — AI Platform

### Objectives

- AI gateway
- Provider abstraction
- Prompt management
- Usage limits
- Receipt analysis
- Voice transaction parsing
- Spending insights
- Chatbot
- Behavior analysis

### Deliverables

- AI module
- Provider fallback
- Cost tracking
- AI usage quotas
- Financial assistant
- Validated AI outputs
- AI monitoring in admin dashboard

---

## Phase 7 — Subscriptions and Payments

### Objectives

- Define plans
- Implement Stripe
- Checkout
- Webhooks
- Customer portal
- Feature gates
- Subscription reconciliation

### Deliverables

- Free, Basic, and Premium plans
- Stripe billing
- Subscription status
- Payment history
- Usage limits
- Billing administration

---

## Phase 8 — Mobile Application Foundation

### Objectives

- Shared React Native application
- Authentication
- Onboarding
- Dashboard
- Transactions
- Accounts
- Budgets
- Debts
- Goals
- Reports
- Notifications
- Offline support

### Deliverables

- iOS application base
- Android application base
- Shared API integration
- Push notification support
- Secure local storage
- Mobile-ready user flows

---

## Phase 9 — Android Transaction Tracking

### Objectives

- SMS Auto-Tracking
- Notification Listener
- Permission flows
- Local message filtering
- Local parsing
- Supported bank rules
- Duplicate protection
- Background synchronization

### Deliverables

- Android SMS import
- Android notification import
- Bank sender configuration
- Transaction confirmation flow
- Tracking preferences
- Parser analytics

### Major Risk

Google Play approval for SMS permissions must be validated before this feature becomes a release dependency.

---

## Phase 10 — iOS Transaction Tracking

### Objectives

- Shortcuts
- App Intents
- Share Extension
- Screenshot import
- Quick actions
- Widgets

### Deliverables

- iOS shortcut setup
- Bank-message import action
- Share-to-Masarifi flow
- Quick transaction creation
- User setup guide

---

## Phase 11 — Advanced Reports and Behavior Intelligence

### Objectives

- Spending behavior analysis
- Salary forecasting
- Recurring expense detection
- Unusual spending detection
- Smart budget suggestions
- Savings suggestions
- Monthly summaries

### Deliverables

- Behavior insights
- Predictive reports
- Personalized alerts
- Advanced AI recommendations
- Financial trend explanations

---

## Phase 12 — Production Hardening

### Objectives

- Security review
- Performance review
- Load testing
- Backup validation
- Disaster recovery
- Monitoring
- Alerting
- Privacy review
- Store policy review
- Penetration testing

### Deliverables

- Production readiness report
- Security checklist
- Performance baseline
- Incident response plan
- Backup and recovery plan
- Monitoring dashboards
- Launch checklist

---

## Phase 13 — Launch and Iteration

### Objectives

- Controlled beta
- Collect feedback
- Monitor failures
- Improve parsers
- Improve onboarding
- Improve AI quality
- Validate pricing
- Optimize retention

### Deliverables

- Beta release
- Production release
- User feedback reports
- Product analytics
- Prioritized improvement backlog
- Post-launch support process

---

# 13. MVP Recommendation

The complete platform is large. The recommended MVP includes:

- Marketing Website
- Admin Dashboard
- Shared NestJS Backend
- Authentication
- User profile
- Accounts
- Transactions
- Categories
- Salary tracking
- Monthly and category budgets
- Debts
- Savings goals
- Basic reports
- File import
- Receipt analysis
- Voice transaction entry
- Basic AI assistant
- Subscription foundation
- Android transaction-tracking proof of concept
- iOS Shortcut proof of concept

The following may be delayed:

- Advanced investments
- Advanced gamification
- Complex behavior prediction
- Multiple AI providers in the first release
- Open Finance integration
- Advanced social features
- Full CMS
- Microservices

---

# 14. Major Risks

## Product Risks

- Too many features before validating demand
- Weak differentiation
- Complex onboarding
- Low trust in financial automation
- Poor import accuracy
- High AI cost

## Technical Risks

- SMS permission approval
- Duplicate transactions
- Incorrect financial calculations
- Weak parser coverage
- AI hallucinations
- Long-running import tasks
- Sensitive-data exposure
- Inconsistent admin-web and mobile behavior

## Operational Risks

- Stripe webhook failures
- AI provider outages
- Redis or worker failures
- File-processing failures
- Support staff accessing sensitive data
- Poor audit coverage
- Incomplete deletion workflows

## Mitigation

- Start with a modular monolith
- Build deterministic financial logic
- Use AI only where appropriate
- Add parser test suites
- Add audit logs
- Use provider abstraction
- Implement background retries
- Add strict permissions
- Use feature flags
- Launch gradually

---

# 15. Final Architecture Decision

```text
Marketing Website:
Next.js

Customer Experience:
iOS and Android mobile applications only

Admin Dashboard:
Next.js

Shared Backend:
NestJS Modular Monolith

Database:
Supabase PostgreSQL

Authentication:
Supabase Auth + NestJS verification

Storage:
Supabase Storage

Realtime:
Supabase Realtime

Secrets:
Supabase Vault for database-level secrets
Hosting Secret Manager for backend secrets

ORM:
Prisma

Queues:
BullMQ + Redis

Mobile:
React Native + Expo Development Builds

Android Tracking:
SMS Auto-Tracking + Notification Listener

iOS Tracking:
Shortcuts + App Intents + Share Extension

AI:
NestJS AI Gateway with provider abstraction

Payments:
Stripe

Containers:
Separate Dockerfiles
One Docker Compose file for local development

Monitoring:
Sentry + structured logging

Repository:
Turborepo + pnpm workspaces
```

---

# 16. Final Recommendation

The system should be built as a modular platform, not as disconnected projects.

The backend must be the source of truth. The Admin Dashboard and mobile applications must be treated as clients of the same API.

The recommended implementation order is:

1. Architecture and database
2. Authentication and permissions
3. Core financial operations
4. Admin Dashboard
5. Import and AI foundation
6. Mobile applications
7. Platform-specific transaction tracking
8. Marketing Website completion and launch preparation
9. Production hardening

The project must not begin with microservices.

The project must not place all services inside one Docker container.

The project must not expose user financial data to administrators by default.

The project must not rely on AI for deterministic financial calculations.

The project must validate Android SMS permissions and iOS automation limitations before promising fully automatic tracking across both platforms.
