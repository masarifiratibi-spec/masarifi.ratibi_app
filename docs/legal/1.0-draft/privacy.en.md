# Privacy Policy

Proposed wording — 1.0-draft, prepared 29 October 2026. This draft is not legally approved and has no effective date. Descriptions reflect reviewed application code, not certification of every deployed service. Unverified practices and missing operator decisions are expressly identified for approval before publication.

## 1. Who is responsible and how to contact us

This proposed policy concerns مصاريفي وراتبي (Masarifi & Ratibi), intended for launch in the United Arab Emirates. The brand is not a verified registered legal entity. The legal operator/controller name, registered address and registration details remain pending confirmation. The product owner has confirmed masarifi.ratibi@gmail.com as the privacy and support email. Any legally required data-protection officer or representative must still be assessed and identified.

Contact that address for privacy or support enquiries, using only the information necessary to explain the request. Do not send passwords, authentication codes or unnecessary financial documents. An in-app support route also exists where available. The public deletion-request resource, identity-verification procedure and legally applicable response periods remain to be completed and verified; this draft does not invent them.

## 2. Scope and sources of information

Data can come from information you enter, Google/Clerk authentication, financial activity you import or authorize the application to detect, your use of enabled features, your device and responses from service providers. Only features available in your build and enabled for your account apply. Hidden or deferred functionality is not activated by this policy.

Required core data, optional permissions and feature-specific choices must be distinguished. Declining an optional tracking or AI feature can limit that feature without itself authorizing unrelated collection. Do not include unnecessary information about other people in financial notes, recordings, prompts, imports or support messages.

## 3. Account, profile and device information

Authentication can involve your Google account identifiers and profile details, Clerk user and session identifiers, authentication tokens and session status. Masarifi's backend maintains an owner profile and device/session records. Profile and preference fields can include name, email or masked contact information, optional phone, optional birthday or gender where supplied, language, timezone, country, currency and application settings. Not every field is required or remotely stored in the same way.

Device registration, notification delivery and security may involve application-generated device identifiers, platform/app version, device label, push token, permission state, timestamps and security or operational events. Service infrastructure may also process network metadata such as IP addresses. The exact production log inventory, access permissions and retention schedule require confirmation. Google authentication is not permission to read your Gmail inbox.

## 4. Financial records and planning data

Records can include account names and types, institution labels, last four digits supplied for recognition, currencies, opening balances, card limits and payment terms, transaction amounts and dates, merchants, descriptions, categories, transfers, refunds, obligations, recurring records, salary information, budgets and savings goals. The application also maintains record versions, synchronization status, operation identifiers, conflicts and duplicate-review information to reconcile changes safely.

Financial overviews, calculations, trends and reports derive from these records using the selected accounts, periods, currencies and filters. Local pending information is different from server-confirmed data. Ordinary record entry does not require banking passwords or card security codes; do not add them to free-text fields.

## 5. SMS, notification access and imported content

When separately enabled on supported Android devices, SMS access can read message text, sender and time, and notification access can receive notification title/text, source application, identifiers and time. Android grants broad technical access; financial-source and content filters reduce which information is admitted for tracking but are not a guarantee that unrelated text is never encountered during classification.

Native queues and application records can retain admitted content and processing metadata while offline. Financial content, extracted fields, source references and, in supported import flows, original JSON/CSV payloads can be sent to the backend and stored for processing or review. The backend has storage and deletion paths for tracking imports. It would be inaccurate to describe all tracking as remaining only on the device.

Tracking is used to identify financial activity, match it to authorized accounts, detect duplicates and present uncertain items for review. Change source settings or revoke SMS/notification access in the device settings to stop future permitted capture. That does not automatically erase prior records. A general legal checkbox does not replace prominent source-specific disclosure and permission.

## 6. Voice and AI processing

If you use voice entry, microphone audio, uploaded recordings, transcripts, extracted fields, proposed transactions and processing status may be handled by the application, backend storage and an external AI provider. The microphone is needed for a recording you initiate; do not record others without the required authority.

For the financial assistant, your questions, relevant conversation history and authorized financial context or query results can be sent through the AI gateway for an answer. The reviewed backend routes external AI requests through OpenRouter to allowed model providers; code includes Google Vertex and OpenAI routes. Actual active routes, provider contracts, countries and account-level settings must be verified for the release.

The gateway requests restricted provider routing with data-collection denial and zero-retention parameters. Request parameters alone do not verify all provider behavior or create an absolute no-training/no-retention guarantee. Gateway metadata, optional account logging, legal/safety exceptions and provider-specific terms require review. Do not assume AI data stays in the same country as the application database. Masarifi itself can retain conversation and voice-processing records until its applicable deletion or retention process completes.

AI may make errors. A response is not professional advice or a completed action. Feature-specific consent, current authorization, preview and confirmation controls remain separate from registration consent. New AI processing needs connectivity; saved history is only a record of an earlier exchange.

## 7. Purposes and legal grounds

Processing supports authentication and account access; storing and synchronizing your records; calculations and planning; optional financial tracking; requested AI/voice processing; reports and exports; support and feedback; notification delivery; security, duplicate prevention, recovery and legal obligations. Optional analytics settings exist, and some application event helpers exclude sensitive fields. This does not establish that every infrastructure or third-party log is anonymous or that the analytics switch controls necessary security logging.

Before publication, the operator must map each purpose to a valid ground under the UAE regime that actually applies. Where Federal Decree-Law No. 45 of 2021 applies, consent and its statutory exceptions must be assessed specifically. A general “legitimate interest” or the usefulness of a feature must not be assumed sufficient. The assessment must also consider any relevant banking/credit-data or free-zone rules; not every financial record is automatically exempt from privacy law. Optional permissions, AI processing and any future marketing choice remain separate from a general Terms acknowledgement.

## 8. Storage, security and offline copies

The mobile implementation uses an owner-specific encrypted SQLite database for local financial and workflow records, with encryption keys stored through the operating system's secure-storage mechanism. It also uses secure storage, preferences, temporary files and owner-bound native tracking queues. Saved display projections reuse the existing owner database and retain their original update timestamps. This architecture is designed to avoid displaying one owner's saved data to another owner.

Backend application data and files use Supabase PostgreSQL and Storage; application services run on hosted server infrastructure, currently evidenced on Hostinger VPS. Access controls, server authorization, private-object and signed-link flows are implemented for relevant resources. This is not end-to-end encryption that prevents the authorized backend from processing data.

Device/app lock, hidden balances, encryption and access checks provide different protections. No system guarantees absolute security. Notifications, screenshots, downloaded files, device backups, compromised devices and copies opened in another app need separate consideration. The production backup configuration, all processing locations, staff access and incident-response arrangements require operational verification.

## 9. Service providers and other recipients

The reviewed integration includes Google and Clerk for authentication; Supabase for database and object storage; Hostinger for application hosting; OpenRouter and the selected AI provider for enabled AI processing; and Expo/native push services with Google Firebase Cloud Messaging on Android when remote notifications are configured and permitted. Apple push delivery is relevant only to a supported configured Apple build. Email/report delivery also has provider interfaces; the actual outbound email provider and activation must be confirmed rather than inferred from code.

Authorized support or administrative personnel may process support messages, attachments, account status and permitted diagnostic information for their work, subject to access controls. Downloads and sharing go to the destination or recipient you choose. Legally required disclosures and necessary security investigations need a valid basis and appropriate limits. Any business transfer and its safeguards must be legally reviewed before related processing occurs.

The operator must maintain an approved vendor/subprocessor register covering each recipient, data scope, purpose, location, contract and deletion arrangement. No sale, advertising, training or unrelated secondary-use practice is authorized merely by this draft, and a blanket assertion that such practices never occur across all vendors has not been verified.

## 10. Processing locations and international transfers

The production database region, VPS location, authentication locations, AI endpoints, notification delivery, backups and remote support access must be assessed together. A database region alone does not prove that all information stays there. The exact release locations and applicable transfer safeguards are not yet approved for this policy.

Before public release, the operator must identify applicable transfer restrictions, necessary assessments, agreements and notices for the intended markets. This draft does not treat general consent or a vendor's compliance statement as sufficient permission for every international transfer.

## 11. Retention and deletion limits

No complete approved retention schedule has been verified. The final schedule must separately address account/profile and financial records; pending changes and recovery journals; tracking source/import data; audio, transcripts and AI history; support messages/attachments; report/export files; notification/device records; security and audit logs; and backups. Fixed periods must not be inferred from cache limits or a code default.

The implementation contains configurable expiry, account-deletion, anonymization, retention-policy and legal-hold mechanisms. A mechanism's existence does not establish that its worker is active, every category is covered or a particular deadline is guaranteed. Failed jobs, required legal preservation, provider processing and backup lifecycles can affect completion. Any lawful retention exception and its criteria must be explained in the approved policy.

Deleting a transaction, clearing local data, deleting an account and uninstalling the application are different operations. Exported PDFs and recipient copies outside Masarifi may remain beyond its control. A time-limited download link expiring does not necessarily mean the underlying file has already been erased.

## 12. Your choices, rights and requests

Depending on applicable law, you may have rights to information, access and a copy of your personal data, correction, deletion, restriction or objection, portability where required, and withdrawal of consent for processing based on consent. Rights, legal exceptions and response periods must be assessed for the applicable jurisdiction. Withdrawal does not itself undo processing that was lawful before withdrawal.

Use enabled profile and preference controls for supported corrections and permissions. The application includes data-export and account-deletion request flows with verification and status reporting; these require online services and current authorization. A submitted or pending request is not confirmation that all processing or deletion has completed. The backend deletion design includes revoking sessions, removing or anonymizing domain records and deleting the Clerk identity, with recovery for failures.

The final operator must provide an accessible request channel for users who cannot sign in, a public deletion-request URL where required, proportionate identity checks and a complaint/escalation process. These contact details, public URL and service deadlines need confirmation. You retain any right to complain to the competent supervisory authority. No such authority or governing jurisdiction is selected solely by this draft.

## 13. Managing permissions and notifications

Use application and operating-system controls for SMS access, notification-listener access, microphone recording, push notifications and biometric/device authentication. Denying a permission can prevent the associated feature. System authentication returns an authentication outcome to the application; the reviewed application does not collect fingerprint images or biometric templates through that interface.

Optional notification and personalization settings do not erase existing records. Necessary account/security communications may be treated differently from optional reminders, subject to the final legal assessment. Do not assume an operating-system permission alone authorizes every server upload or optional use of the resulting content.

## 14. Minors and automated outputs

The product owner intends broad age availability only where UAE requirements permit. This draft does not authorize unrestricted child registration. Under the UAE Child Digital Safety framework, under-13 personal-data processing requires specific safeguards including documented, verifiable caregiver consent; age verification and platform duties depend on the applicable classification. The required age/guardian process is not implemented or verified by this draft. Do not treat a Google account, a birthday field or the registration checkbox as proof of eligibility.

Before opening the service to children, the operator must assess the permitted data and feature scope, guardian authority and withdrawal, suitable privacy defaults and notices, safety reporting and any restrictions on tracking, audio and third-party AI. Review of the current UAE rules and implementation decisions is pending professional verification. The all-ages product intention is not a declaration of legal permission.

Automated categorization, duplicate detection, tracking and AI analysis can affect records and presentation, and errors need review and correction. These features do not establish a credit approval, insurance decision or entitlement to a regulated financial product. Any future decision producing legal or similarly significant effects requires a separate assessment.

## 15. Policy updates and publication prerequisites

The final policy must identify its approval, effective date and version and communicate material changes appropriately. New optional purposes may require a separate choice or new consent. This draft does not make a past checkbox or continued use retroactively valid consent.

For the intended UAE launch, complete the registered operator identity, purpose/legal-ground assessment, vendor and transfer register, retention/backup schedule, rights and deletion channels, child eligibility/guardian safeguards, incident procedures and store disclosures. Obtain professional review of applicable UAE federal and any relevant free-zone or sector-specific rules. The confirmed contact is masarifi.ratibi@gmail.com; no legal compliance certification is asserted.
