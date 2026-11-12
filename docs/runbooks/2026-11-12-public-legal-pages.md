# Public legal pages handoff — 12 November 2026

Status: prepared in source, not published. This work does not create an APK, IPA, AAB, Next production build or container image, and does not deploy services or change DNS. The launch-plan observation on 12 November found the root domain serving Hostinger's parked-domain HTML, including for all three candidate routes. An HTTP 200 response from that page is not evidence that a legal document or deletion flow is available. See `docs/reports/2026-11-12-google-play-observations.json`.

## Candidate public URLs

These are intended routes after an authorized web deployment; they are not verified live legal URLs:

| Purpose | Arabic (default) | English |
| --- | --- | --- |
| Privacy Policy | `https://masarifiratibi.com/privacy` or `/privacy?lang=ar` | `https://masarifiratibi.com/privacy?lang=en` |
| Terms & Conditions | `https://masarifiratibi.com/terms` or `/terms?lang=ar` | `https://masarifiratibi.com/terms?lang=en` |
| Account/data deletion | `https://masarifiratibi.com/delete-account` | Same URL; select **English** on the page |

Privacy and terms are server-rendered documents with native language links, document navigation, contact and deletion links. They do not require a user account or browser interaction to display the full selected document. An unsupported or repeated language parameter defaults to Arabic. The deletion explanation and email fallback are publicly readable; submitting an automated deletion request still requires the account owner's Clerk sign-in, current authorization and reverification.

## Content and retention

The four existing files under `apps/mobile/src/features/legal/` (`privacy.ar.json`, `privacy.en.json`, `terms.ar.json`, `terms.en.json`) remain the single source for the documents. The new web server component imports these JSON files directly; it does not fetch them from the mobile application. Preserve those imports and include that part of the repository in the web deployment's source context. Keep future legal changes in the shared JSON sources so mobile and web remain aligned.

The public documents retain their existing disclosures and their stated operational uncertainties. No fixed deletion or retention period has been invented. The deletion explanation covers waiting periods, lawful holds, failed tasks, provider processing, backup cycles and separately controlled device/exported copies. A pending request is not deletion completion. Operational owners still need to confirm production retention schedules, backup handling and provider arrangements before treating those statements as fully resolved launch evidence.

When automated deletion or sign-in is unavailable, the deletion page provides `mailto:masarifi.ratibi@gmail.com?subject=Account%20deletion%20request`. Sending email starts a request and does not display a deletion-success state. It asks for only the account email and necessary information, excludes passwords/authentication codes/unnecessary financial documents, and explains that identity verification may be needed. Confirm that this inbox is monitored and that requests receive a verified operational response.

## Narrow deployment requirements for a later authorized action

1. Serve the prepared public routes on an approved HTTPS web origin. The candidate root domain currently needs actual web hosting/routing instead of the parked response. The hosting mechanism, DNS changes and production artifact have not been selected or changed by this task.
2. Use the complete monorepo source context for the shared JSON imports. No production web build or packaged deployment has been checked here; validate packaging during the separately authorized deployment work.
3. Public legal documents and the deletion explanation must remain reachable anonymously. Preserve the exact `/privacy`, `/terms` and `/delete-account` bypass in the shared UI provider. Preserve Clerk protection for `/admin(.*)` and `/invitations/accept(.*)`; do not broaden that bypass to similarly named or nested paths.
4. Automated deletion additionally needs the intended production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and an HTTPS `NEXT_PUBLIC_API_URL`, using the same user identity/backend environment as the mobile accounts. Configure Clerk for the approved web origin and sign-in return to `/delete-account`; allow that exact origin in API CORS. Do not use a secret key in any `NEXT_PUBLIC_*` value. Privacy and terms do not need those services to render.
5. Confirm the backend deletion/reverification, idempotency, request-status, cancellation and scoped-completion receipt endpoints operate against that environment. Never bypass account ownership or report completion based only on an accepted request, network failure or sent email.
6. After a separately authorized deployment, open each URL in a signed-out browser and check page title, Arabic/English text, direction, contact/deletion links, keyboard navigation and full HTML content with JavaScript disabled. Capture the deployed origin, revision, time and response contents; a parked-domain HTTP 200 is a failure.
7. Test automated deletion with an authorized disposable account, including fresh authentication, a failed/retried request and status after session revocation. This destructive live check was not performed in this task. Confirm the email fallback works as a contact link and does not claim successful erasure.

## Google Play Console handoff

After the deployed routes have passed the checks above, the account owner can use the verified privacy URL in the app's **Privacy policy** field and the verified `/delete-account` URL for the **Data safety / account deletion** web link. Confirm the exact fields in the current Console and save/review their changes there. Do not submit the current parked URLs as working legal links. These source changes do not update Console, declare Data safety, establish production deployment or require a new mobile binary by themselves.

## Verification without a build

From `apps/admin-web`, run:

```text
npm test -- src/features/public-legal/PublicLegalPage.test.tsx src/features/public-deletion/DeletionPage.test.tsx src/features/public-deletion/deletion-client.test.ts src/app/providers.test.tsx
npm test
npm run typecheck
npm run lint
```

The focused tests cover complete Arabic/English source parity, server-rendered content, safe language fallback, public contact/deletion links, metadata branding, anonymous provider behavior, strict route boundaries and the existing deletion retry/completion-receipt journeys. No `build`, `build:sites`, `test:e2e`, APK/IPA/AAB generation or deployment command belongs to this verification step.

Observed in this workspace on 12 November 2026: focused tests passed (4 files, 24 tests); the full admin suite passed (112 files, 1,068 tests); `npm run typecheck` and `npm run lint` both exited successfully. These are source-level checks, not evidence of deployed hosting or a production Next artifact.
