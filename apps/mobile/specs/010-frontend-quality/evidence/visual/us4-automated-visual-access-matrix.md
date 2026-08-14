# SPEC-010 US4 Automated Visual/Access Matrix Evidence

Date: 2026-08-13
Environment: Local Windows PowerShell, Jest/React Native Testing Library

Covered by automation:

- Arabic RTL and English LTR localization parity and key-as-output rejection.
- Feature component hard-coded user-string scan.
- 320×568 minimum viewport constants and large-text reachability for Home and transaction form.
- Hidden values, notification phone copy masking, assistant support context privacy, and protected account IDs.
- 44×44 minimum control targets, reduced motion, decorative subtree hiding, logical tab metadata, chart summary, and drill-down path.
- Existing validation routes: `/foundation/accessibility`, `/design-system`, and scenario selector route coverage.

Not claimed by this artifact:

- TalkBack, VoiceOver, participant outcomes, real-device screenshots, or native spoken usability.
- Those remain separate native/participant gates in `validation.md`.
