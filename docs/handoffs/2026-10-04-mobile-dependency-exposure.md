# Inherited Mobile dependency exposure — 2026-10-04

Assessment baseline: frozen Voice candidate `397677423b9336722bc9af2405f1a5b1d7b3a623`. The capacity continuation does not change Mobile dependencies or its deep-link/authentication implementation. This is an exposure assessment, not a claim that all dependency advisories are remediated.

`npm audit --omit=dev` reported 43 high and 22 moderate **affected package nodes**, representing eight distinct upstream advisory URLs; many parent packages inherit the same transitive finding. No critical finding was reported. The production Android Expo export succeeded with source maps: 2,068 bundled Metro modules / 2,075 mapped sources. Exact `/node_modules/<package>/` matching avoids mistaking Expo's own UUID implementation for the vulnerable npm `uuid` package.

| Package | Shipped Android JavaScript | Assessed exposure |
| --- | --- | --- |
| brace-expansion | Absent | Three denial-of-service advisories in CLI/build glob expansion; untrusted patterns/filenames can affect build availability. |
| braces | Absent | Build/Metro/Jest pattern expansion availability exposure. |
| node-forge | Absent | Expo CLI/codesigning tooling; signature-validation advisory is not an Android runtime crypto path in this export. |
| stream-json | Absent | Tooling dependency; nested untrusted JSON can affect tool availability. |
| npm uuid | Absent | Vulnerable npm module absent. `expo-modules-core/src/uuid` is a different implementation, not proof of this advisory's runtime exposure. |
| decode-uri-component 0.2.2 | **Present** | External deep-link query decoding through query-string and React Navigation; reachable availability risk. |

The decoder path is `native external link → Expo Router linking → getStateFromPath → parseQueryParams → queryString.parse → decode-uri-component`. The existing native-intent hook sanitizes SSO callbacks but passes unrelated query-bearing links through; the later app-shell allowlist is not an adequate pre-decoding mitigation. A contained child-process reproduction using the installed query-string package and a fictional malformed percent-encoded query exceeded the two-second bound and was terminated. A valid Arabic query was included in the reproduction. This was a Node reproduction and static Android bundle/reachability assessment; it was not an exploit run on the user's device.

Upstream rates the decoder issue moderate and availability-only. A malicious link can stall decoding; this evidence does not establish remote code execution or financial/identity disclosure. [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

The patched decoder release is 0.5.0 and is ESM; installed query-string 7 expects a callable CommonJS require. Blindly overriding 0.2.2 to 0.5.0 risks breaking linking and onboarding. Before public release, validate a compatible upstream dependency upgrade or a narrowly tested pre-decoding mitigation, with cold/live links, malformed percent encodings, Arabic parameters and unchanged Clerk/WebBrowser callback handling. The bounded reproduction should pass, and a fresh production bundle must establish the resulting runtime path. No broad Expo/Clerk upgrade, dependency override or authentication refactor was performed in this continuation.

Build-time findings remain relevant to trusted CI inputs and toolchain integrity; absence from shipped JavaScript is not dismissal of those findings. Existing isolated CI/timeout/secrets/container gates remain in force. This report does not assess native Java/iOS libraries or constitute a complete native SBOM audit.

Primary advisory details: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [stream-json](https://github.com/advisories/GHSA-528h-pc64-c93x), [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq), [brace expansion quadratic rewrite](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [nested groups](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [comma recursion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p).

Disposition: non-posting capacity validation can use known fictional inputs and existing trusted authentication. **The inherited runtime decoder risk remains unresolved and must be visible in release approval; full public release security readiness is not certified.** Detailed audit and bundle maps are retained in the ignored release-evidence directory without adding customer data or authentication secrets to Git.
