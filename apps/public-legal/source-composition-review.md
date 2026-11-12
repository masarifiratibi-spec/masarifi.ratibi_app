# Preparation composition review

Baseline: `ae290abac9b3d55c1f482ec8198e91200a8ea0b4`.

The approved preparation uses a separate static resource surface instead of changing Admin guards to make a public production mode. Only `apps/public-legal/` is new. No existing Admin, API, mobile, canonical legal JSON, auth, proxy, runtime, DNS or hosted configuration is modified.

Reuse is explicit: all four legal JSON files and both legal CSS files are pinned against Git baseline bytes. Legal page structure, section navigation, language links, brand and contact links follow `PublicLegalPage.tsx`. The deletion page reuses existing accurate effect/contact/email-notice text, keeps the shared legal links, removes all sign-in/status/form interactions, and explains only the email request route. No automated deletion capability is packaged. The email address and current source legal claims still require owner adoption.

Every text insertion is HTML escaped. Section IDs must be unique ASCII identifiers. Payload files contain no inline or external JavaScript, forms, iframes, images, font requests, telemetry, API clients or authentication runtime. Existing CSS containing an import or resource URL is rejected. HTTP headers prohibit scripts, embedded content, form actions and framing. Query strings and request metadata are not logged by the loopback preview.

The canonical content baseline is immutable and may be an ancestor of the actual source HEAD. Release builds require committed, Git-matched, clean adapter files; an explicit preview build remains marked as unadmitted. Canonical content changes are rejected even if committed on a valid descendant. The current uncommitted composition is a preparation preview, and is not attributed to the canonical baseline as committed adapter source. An explicit system Tahoma/Arial body font supplies the missing global Next styling without adding a font request or changing the design.

Source preparation and packet qualification are authorized. Publication, DNS/site overwrite and the final Nginx context are separate reviewed operations. The snippet intentionally contains no standalone server/TLS/DNS configuration. A portable stdlib-generated static tar avoids Windows/Linux native dependency differences.
