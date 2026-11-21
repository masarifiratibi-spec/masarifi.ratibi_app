# Public legal resources

This independent static adapter publishes only privacy, terms and an email account-deletion request explanation. It imports no Admin application, authentication provider, API client, credentials or JavaScript. The existing Admin production and authorization guards are unchanged.

After the VPS privacy wording update, the four canonical documents under `apps/mobile/src/features/legal/` are read verbatim from the reviewed `a95f37a9` source. The public Admin legal/deletion CSS and existing layout/brand are reused. A tiny CSS prefix explicitly supplies Tahoma/Arial system fonts and document resets instead of fetching Google fonts. Arabic and English are complete independent HTML responses. The exact query `?lang=en` selects English; default, invalid, duplicated and additional query parameters select Arabic. The preview and proposed Nginx maps share this rule.

`deletion-copy.json` reuses the existing deletion page's effect, contact and email-notice copy. Its introduction explicitly directs requests to email. The retention paragraph removes references to a nonexistent status panel or automated confirmation. It invents no retention deadline, completion guarantee or service level. Email begins a request; identity verification may still be needed. Whether the contact inbox is monitored and the legal/operator/retention statements are adopted remains an owner review requirement.

Preparation commands, from the repository root, with Python 3.11 or later:

```text
python apps/public-legal/build.py --preview --output E:/Masarifi-play-acceptance-20261112/public-web-packet/candidate-4
python apps/public-legal/qualify.py --candidate E:/Masarifi-play-acceptance-20261112/public-web-packet/candidate-4 --output E:/Masarifi-play-acceptance-20261112/public-web-packet/qualification-4.json
python apps/public-legal/preview.py --candidate E:/Masarifi-play-acceptance-20261112/public-web-packet/candidate-4 --port 4193
```

The builder refuses an existing output, checks the reviewed canonical inputs, emits exactly six HTML and two content-hashed CSS files, records source and output fingerprints, and creates a deterministic portable `masarifi-public-legal.tar` containing only `site/` files. No dependencies, native components, Next runtime or Docker build are needed. `canonicalSourceCommit` stays pinned to `a95f37a9`; it must be an ancestor of the current checkout. `sourceCommit` is the actual current HEAD, while `adapterCommit` identifies the last committed adapter change. A descendant source revision is valid only when the pinned canonical Git bytes remain unchanged. Full Git history containing the canonical base is required.

By default, release admission requires every adapter file to exist in HEAD, match its Git content and have a clean working tree/index. After committing the reviewed adapter, omit `--preview` to build a release-admitted packet. Explicit `--preview` permits uncommitted preparation but records `previewOnly=true` and `releaseAdmitted=false`; it never pretends that the canonical baseline contains new adapter files. The manifest separately records adapter tracking, byte-match and clean state. Windows checkout CRLF conversion is normalized back to canonical Git LF bytes for comparisons.

`qualify.py` validates actual HTTP responses, complete canonical content parity, CSS delivery, route/method restrictions, language fallback and escaping of hostile text. It additionally creates real temporary Git histories to verify later-descendant admission, dirty adapter rejection, explicit preview marking, committed canonical tamper rejection and unrelated-history rejection. Qualification refuses Python optimization mode because its checks use assertions. The preview listens only on `127.0.0.1`, has no directory listing and serves only the exact three routes and two assets.

`nginx-locations-review.conf` is a proposed snippet, not a full server configuration. Maps belong in the existing `http` context, and exact locations in the approved server. The root path is deliberately a review placeholder until an immutable deployment destination and current host configuration are admitted. Review the final response headers, existing locations, MIME mapping and rollback before activation. Preserve unrelated site/Admin routes. No TLS, DNS, root redirect, hosted overwrite or public publishing is performed by this adapter.

Local qualification is not deployment acceptance. Following approval, verify all six HTTPS language responses and assets anonymously on the intended public origin, with the expected hashes and no parked hosting page. An email link is not evidence of operational deletion completion, and no destructive deletion test or message send belongs to this preparation.
