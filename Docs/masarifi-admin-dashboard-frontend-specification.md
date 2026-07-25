# Masarifi Admin Dashboard — Frontend Product and Screen Specification

**Document Type:** Frontend-only Admin Dashboard Plan  
**Platform:** Masarifi  
**Primary Language:** Arabic RTL  
**Secondary Language:** English LTR  
**Purpose:** Build a complete high-fidelity Admin Dashboard prototype for client presentation before backend integration.

---

# 1. Document Purpose

This document defines the complete frontend scope for the Masarifi Admin Dashboard.

The Admin Dashboard is the internal operational interface used to monitor and manage the Masarifi mobile applications, platform services, subscriptions, imports, AI usage, support requests, system content, security events, and administrative access.

This phase is frontend-only.

The prototype will use realistic static data and simulated interactions.

It must not include:

- Real backend integration
- Real database access
- Real Supabase connection
- Real Stripe connection
- Real AI provider connection
- Real authentication
- Real user financial-data access
- Real system commands
- Production authorization logic

The dashboard should be visually complete enough to present to the client and validate:

- Information architecture
- Navigation
- Screen hierarchy
- Admin workflows
- Privacy controls
- Operational visibility
- Design direction
- Responsive behavior
- Component coverage

---

# 2. Product Context

Masarifi is an Arabic-first personal finance platform for users in the UAE and Gulf region.

Customers use the iOS and Android mobile applications to manage:

- Salary
- Income
- Expenses
- Accounts
- Budgets
- Debts and installments
- Savings goals
- Investments
- Reports
- AI financial insights
- Automatically detected transactions
- Receipt, screenshot, statement, SMS, notification, and Shortcut imports

The Admin Dashboard enables authorized staff to operate and monitor the platform without becoming an unrestricted financial-surveillance interface.

---

# 3. Admin Dashboard Goals

The dashboard must allow authorized staff to understand:

- How many users are active
- Whether mobile applications are working correctly
- Whether imports are succeeding or failing
- Whether AI providers are available
- Whether payments and subscriptions are healthy
- Which support cases require attention
- Whether parser rules are performing correctly
- Whether queues and background jobs are healthy
- Whether security incidents exist
- Whether content and system settings require updates
- Whether account-deletion and data-export requests are progressing

The dashboard should help the admin answer:

> What needs my attention now?

---

# 4. Privacy and Safety Principle

The Admin Dashboard must never expose private customer financial information by default.

Admins should not automatically see:

- Complete transaction histories
- Full salary values
- Merchant histories
- Debt details
- Savings balances
- Uploaded bank statements
- Raw SMS content
- Raw notification content
- Full AI conversations
- Unmasked account numbers

The default experience should show:

- Aggregated metrics
- Operational metadata
- Status information
- Masked identifiers
- Import-quality information
- Subscription status
- Support-case context

Temporary access to sensitive customer information must require:

- Existing support ticket
- Recorded reason
- Requested scope
- Approval
- Expiration time
- Audit record
- Masking where possible

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

The frontend prototype should include the following pages.

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

This screen is shown only in the prototype to demonstrate privacy controls.

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

Frontend-only edit forms.

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

Frontend-only settings preview.

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

# 38. Frontend Prototype Technology Guidance

This document does not require a production technology decision.

When implemented for presentation:

- Reuse the existing Masarifi design-system files.
- Use the existing project structure.
- Do not create backend integrations.
- Use static JSON or local mock data.
- Simulate filters and interactions.
- Avoid unnecessary dependencies.
- Keep reusable components.
- Preserve future API integration boundaries.

The prototype may use the existing frontend framework in the repository.

---

# 39. Recommended Prototype Scope

The complete specification contains many screens.

For the first client presentation, prioritize these 12 screens:

1. Admin Login
2. Platform Overview
3. Users List
4. User Profile Summary
5. Subscription Overview
6. Import Overview
7. Failed Imports
8. Parser Rules
9. AI Overview
10. Support Tickets
11. System Health
12. Audit Logs

These screens demonstrate:

- Product scale
- User operations
- Revenue
- Automation
- AI
- Support
- Security
- Infrastructure

After client approval, continue with all remaining screens.

---

# 40. Client Presentation Route

Create a presentation index that contains:

- Admin Dashboard summary
- Main navigation map
- Key screens
- Role summary
- Privacy principles
- Responsive previews
- Design-system summary
- Links to full-screen prototypes

Do not present the Admin Dashboard as an unrestricted customer-data viewer.

---

# 41. Implementation Phases

## Phase 1 — Discovery and File Inspection

- Read the product plan.
- Read the design system.
- Inspect logo and assets.
- Confirm page inventory.
- Confirm admin roles.
- Confirm prototype scope.

## Phase 2 — Information Architecture

- Build sidebar groups.
- Build route map.
- Define page hierarchy.
- Define global search.
- Define permission visibility.

## Phase 3 — Admin Design Foundations

- Adapt the Masarifi design system for admin density.
- Define table rules.
- Define chart rules.
- Define status and severity rules.
- Define admin-specific components.

## Phase 4 — Application Shell

- Login
- Sidebar
- Header
- Global search
- Notifications
- Profile
- Responsive navigation

## Phase 5 — Core Presentation Screens

- Overview
- Users
- Subscriptions
- Imports
- AI
- Support
- Health
- Audit

## Phase 6 — Operations Screens

- Payments
- Parsers
- Notifications
- Jobs
- Data requests
- Security

## Phase 7 — Governance Screens

- Admin team
- Roles
- Permissions
- Settings
- Content

## Phase 8 — States and Responsive Design

- Loading
- Empty
- Error
- Permission denied
- Desktop
- Laptop
- Tablet
- Mobile

## Phase 9 — Client Presentation

- Presentation index
- Full-size routes
- Screen descriptions
- Responsive previews
- Final visual review

---

# 42. Deliverables

The frontend Admin Dashboard package should contain:

- Complete route map
- Sidebar navigation
- Application shell
- All page layouts
- Reusable component library
- Mock data
- Arabic RTL
- English LTR readiness
- Light mode
- Dark-mode compatibility
- Responsive behavior
- Loading states
- Empty states
- Error states
- Access-denied states
- Permission-aware navigation examples
- Client-presentation index
- UX notes
- Accessibility notes

---

# 43. Final Acceptance Criteria

The prototype is ready for client presentation when:

- The Admin Dashboard clearly monitors the entire mobile application platform.
- All major operational areas are represented.
- Private customer finance data is hidden by default.
- Roles and permissions are visually clear.
- Imports, parsers, AI, subscriptions, support, security, and system health are covered.
- Arabic RTL is implemented correctly.
- The design uses the approved Masarifi identity.
- The interface is responsive.
- Tables and charts are readable.
- Attention states are clear.
- No backend integration is required for the demo.
- All primary routes are accessible from the presentation index.
- The final prototype has been visually reviewed at all target viewport sizes.

---

# 44. Final Navigation Map

```text
Admin Dashboard
├── Authentication
│   ├── Login
│   ├── Two-Factor Verification
│   ├── Forgot Password
│   ├── Access Denied
│   └── Session Expired
│
├── Platform
│   ├── Overview
│   ├── System Health
│   └── Jobs and Queues
│
├── Customers and Revenue
│   ├── Users
│   │   ├── User List
│   │   ├── User Profile
│   │   ├── Devices
│   │   └── Sessions
│   ├── Controlled Support Access
│   ├── Subscriptions
│   ├── Payments
│   └── Data and Privacy Requests
│
├── Operations
│   ├── Imports
│   ├── Parser Management
│   ├── AI Management
│   └── Notifications
│
├── Support and Content
│   ├── Support Tickets
│   ├── Feedback and Reports
│   └── Content Management
│
└── Governance
    ├── Security Center
    ├── Audit Logs
    ├── Admin Team
    ├── Roles and Permissions
    └── System Settings
```

---

# 45. Final Recommendation

Start the frontend prototype with:

1. Application shell
2. Platform Overview
3. Users
4. Subscriptions
5. Imports
6. AI
7. Support
8. System Health
9. Audit Logs

These screens provide the strongest client-facing demonstration of the Admin Dashboard.

The first presentation should prioritize clarity and product confidence rather than attempting to show every configuration form at once.

After the client approves the visual direction and information architecture, complete the remaining operational and governance pages.
