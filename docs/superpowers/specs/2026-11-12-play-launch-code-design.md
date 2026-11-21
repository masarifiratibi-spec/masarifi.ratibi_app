# Play launch code and update notices

User-approved scope: execute the 12 November Google Play readiness plan, finish code gaps, prepare public privacy/account-deletion pages and Console instructions, without a new build. The user additionally chose **both in-app and external notifications** for future updates.

## Decisions

- Preserve the current branch, package, signing identity, Clerk identity, local data, and unrelated Admin/operations work. No APK, AAB, IPA, frontend production build, image build, deployment, real deletion or customer notification is performed as part of preparation.
- Public Arabic/English privacy and terms reuse the mobile documents. Account deletion retains Clerk verification and truthful completion; an email request alternative is clearly identified as a request, never confirmed erasure. Publishing/DNS and publisher/retention facts need operator evidence.
- Explain AI/voice recipients, purpose, optionality and withdrawal before processing. Keep existing financial posting authorization and recovery protections.
- Updates use a dedicated public, versioned policy endpoint; do not add fields to the old strict `/api/v1/meta` contract. Android policy is disabled by default and activated only after the specified Play version is publicly available.
- Compare actual installed Android versionCode when available, with semantic-version fallback. Preserve the version name in runtime metadata; device registration can use valid SemVer build metadata (`version+code`) within its existing 32-character contract.
- The in-app notice offers Update now and Later, rate-limits repeat prompts, never signs the customer out or discards pending work, and does not prevent offline use. Store URL is pinned to this Android package, never taken from an arbitrary push URL.
- External notices reuse the existing approved campaign/delivery/provider pipeline, with an Android-update audience bound to the active published policy. Filter eligible Android device tokens again at delivery, respect disabled preferences, preserve existing retry/receipt behavior, and support withdrawal of a release announcement.
- A push tap opens an application update route that fetches the current policy rather than trusting an old notification. No automatic installation and no Play Core dependency are introduced.

## Approaches considered

1. Play Core native updates: appropriate for native download/install UX, but adds an SDK and extra final-binary qualification. Not selected for this preparation.
2. Store scraping or a client hardcoded latest version: unreliable or requires another release to announce a new version. Not selected.
3. Published server policy plus existing notification campaigns: selected because availability is operator-controlled and existing push security/delivery are retained. Installed build metadata reuses the already installed and locked `expo-application` 55.0.19 module, now declared directly; no SDK upgrade, package installation or binary build was performed.

The first installed release containing this implementation is necessary for the new in-app and push-tap behavior. Existing client binaries cannot gain new behavior merely from a source change. Play determines actual update installation/eligibility; announcements are activated only for a fully available intended audience.
