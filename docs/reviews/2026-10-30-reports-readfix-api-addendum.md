# Reports read fixes: API-only addendum awaiting approval

The current API returns HTTP500 for a maximum-sized history page and for an existing ready PDF's signed download URL. The history repository asks the owner-scoped RPC for101 rows, exceeding its100-row ceiling. Storage returns `/object/sign/...`; resolving that against the origin omits `/storage/v1`, so the existing exact-path check rejects the URL.

The source repairs preserve the100-row RPC ceiling and owner filters, using one bounded lookahead read inside the same repeatable-read transaction. The signing repair resolves the observed storage-relative path while retaining the exact HTTPS origin, bucket, and owner-hashed key checks. Mobile ordinary history uses50-row pages and creates no new report. PDF history displays only explicitly identified PDFs, refreshes the selected attempt before saving, and cancels work when its owner leaves.

## Concrete candidate

- Current API image: `sha256:137aeb426ade43b9d45af4c8bd24fd8e9bbc8d3104f58f0f3fad3a0f66e68fd6`.
- Prepared candidate: `sha256:03368f9630fc709f0ea8e77c4352a0a77db4a48583ef3b6e65de591e7ec9d72d`.
- Patch manifest: `ab7bf52a64a8fb59935b5c8271880827bae4f0a64b6ee94e7795c294eebd1a61`.
- Full runtime proposal: `b8eabdc1012da96e9ddc0981161b0ca25278987f0d9af8a3baf99ac51ddf73de`.

The candidate inherits the current image and replaces only the compiled history method and signed-path expression in two files. Before-method hashes matched the actual image. After-method bytes match the locally compiled, tested source. Other bytes in those files and base layers remain unchanged. The only image-configuration addition is the declared candidate manifest label. Two bounded, network-disabled syntax checks passed. No application process was started from the candidate, and all36 running services remained unchanged.

The packet in [2026-10-30-reports-readfix-api-addendum.json](2026-10-30-reports-readfix-api-addendum.json) pins both images, source/compiled hashes, exact created/running configurations, mounts and networks. It explicitly includes Docker's previously observed OOM representation: current `null`, created `false`, running `null`. No environment, permissions, database, dependency, or security-control change is proposed.

Source build-input hashes describe the qualified Windows CRLF bytes; separate Git-blob hashes describe the published LF bytes. Their source text was compared and is identical after newline normalization. Compiled method and image hashes are exact bytes.

Request packet SHA256: `572b3a2bff3f6e50511b09ef6d965eca4d8626ce5cb0f8c584de9d1a2d60967e`.

## Requested approval and order

Approve one API-only handover to this exact candidate, with a120-second deadline and rollback beginning by70seconds if any gate is uncertain. Retain the current API and earlier S1 backups. Preserve the other35 services, including Assistant and the generic worker. Recheck the existing host, client, financial, native-producer, Nginx, CA and post-pause quiescence gates; do not force-kill a slow process or replay an uncertain handover.

**Complete the original authorized ZIP window first.** Its launcher pins the current API image. The local-journal exception in [the earlier review](2026-10-30-S1-local-export-journal-addendum.md) remains separately pending. This API addendum does not grant that exception or amend the ZIP launcher.

After the ZIP reaches its terminal state and fresh gates pass, verify API live/readiness/routed health and ordinary history/detail reads, then save at most the two existing owner PDFs through native folder selection by the human. No new PDF/ZIP request, consumer window, renewal, email, share, provider question, financial mutation, APK rebuild/install, Metro restart, Admin deployment, or T20–T22 work is included.

If the API handover fails or its outcome is uncertain, restore the preserved current API under the existing bounded rollback rules and stop. Native file delivery remains unverified until the normal save succeeds. This document records a prepared proposal; human approval and promotion have not occurred.

Validation: the affected API report unit suites passed120cases, including the maximum-page regression; relevant storage/report security suites passed29cases. Full API types, exact-file lint and production TypeScript compilation passed. Mobile and device qualification are recorded in the continuation evidence; CI and task acceptance are separate gates.
