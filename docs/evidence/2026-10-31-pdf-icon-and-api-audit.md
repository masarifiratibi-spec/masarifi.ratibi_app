# Original PDF control and dependency audit correction

The human corrected the UI audit scope: preserve the original PDF download icon. The earlier full-width labelled replacement was not accepted. The control now retains its original 56dp circular primary surface, PDF glyph, inverse icon color, raised shadow and right-side placement. Its accessible Arabic/English label and all existing PDF lifecycle guards remain unchanged.

The transparent overlay uses `pointerEvents="box-none"` and has no persistent dock/background. Report scrolling reserves the button height and safe-area clearance so the final content can be read above it. Transient progress/error/success feedback remains available above the action.

The two existing Arabic/English journey regressions failed against the labelled replacement, then both affected suites passed **31 cases** after correction. Full mobile TypeScript and exact three-file ESLint passed. This is a presentation correction: no export request, ZIP, native build or installation is part of its automated verification. Physical verification is recorded separately when complete.

The latest Backend Foundation application job passed types, lint, formatting, configured tests and build, then failed its unchanged high-severity dependency gate. Its only high finding was Joi's email splitting denial-of-service advisory [GHSA-4528-x5fx-h6hg](https://github.com/advisories/GHSA-4528-x5fx-h6hg). The API dependency and lockfile now pin the patched **18.3.1**; no other dependency version changed and no audit rule was weakened. The two real environment/security configuration suites passed **99 cases** with that installed version. The subsequent lockfile audit has **zero high/critical findings**; lower-severity findings remain and are not represented as a zero-vulnerability result.

The preserved Staging API image is not replaced by this source dependency correction. A later API release must qualify and deploy the patched dependency separately. The requested dashboard deployment uses its retained Admin dependencies.

This supplements [the UI audit](2026-10-31-ui-audit.md), rather than treating its rejected labelled PDF control as current acceptance.
