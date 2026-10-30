# PDF-only download verification — 2026-10-30

The human explicitly cancelled ZIP work and requested only a working PDF download containing report data. This supersedes the earlier ZIP-first execution order and the broader continuation through T19a. No ZIP request, intent, consumer window or renewal was started. The two unpublished ZIP-specific source/test edits were backed up privately and restored to the published checkpoint; they are not part of this result. The previously approved local metadata archive remains recoverable.

## Approved API repair

The human had explicitly approved the API addendum published at `48d4a72707953f96bd6c4be3450f8c197816c7cc`, request SHA256 `572b3a2bff3f6e50511b09ef6d965eca4d8626ce5cb0f8c584de9d1a2d60967e`. The subsequent direct PDF-only instruction cancels the ZIP prerequisite while retaining that exact API repair. The original request packet is preserved unchanged in [the review](../reviews/2026-10-30-reports-readfix-api-addendum.md).

The deployed API image is `sha256:03368f9630fc709f0ea8e77c4352a0a77db4a48583ef3b6e65de591e7ec9d72d`. It repairs the history page limit and the storage-relative signed PDF path. The created and running configurations matched the approved full hashes, including the reviewed Docker OOM representation. The running configuration SHA256 is `29e1e6846dfa999fd58b5c616b6e1bef0af42abfc726d8509073261f0b15395c`.

The API-only handover committed in 22.69 seconds. It retained the previous API and original S1 backups, used graceful stops and a bounded rollback watchdog, and passed local live/readiness plus routed live health. A fresh read-only observation after API pause confirmed zero queued and zero processing assistant jobs. All other 35 services retained their identities, start times, restart counts, configurations, networks and mounts; this was checked again after the PDF download. Six handover/rollback regression tests passed locally and on the Linux host. No environment, database, grant, Nginx, CA, Assistant or generic-worker change was made.

## Actual file and data verification

The existing ready PDF for the selected account was downloaded through the ordinary Reports → PDF history flow on the current Android APK. The human selected Documents and confirmed saving. The resulting file was read from that exact visible native destination and compared byte for byte with the downloaded app cache: both were identical, 13,334 bytes.

The saved PDF was parsed and its complete page rendered and inspected. It is an unencrypted, valid one-page PDF containing the report period, timezone, SAR currency, selected-account scope, income, expenses, net cash flow, transaction count, savings rate and category breakdown. These values were compared with the existing owner-scoped report snapshot at ledger version 17; the negative values were also verified visually. The document is readable and contains the report data, rather than an error response or blank page. The financial PDF, extracted text, snapshot and screenshots remain private and are not committed.

A second save picker for the same report was opened during the human check. It was cancelled after the first saved copy had been verified; the saved copy was retained. No additional automated download was requested. No new PDF-generation POST, report-processing window, share, email or provider request was created. The existing report remained ready with its original processing-attempt count of one.

## Preservation and stopping point

All five original client projections remained exactly equal before and after verification: financial drafts, planning drafts (including the unchanged `2026-13` draft), sync operations, financial rows and queue/schema counts. Native capture/SMS/notification producers remained off. The installed APK hash and existing Metro process were unchanged. The temporary reverse mapping owned by this verification is removed at the safe end, restoring its prior absent state.

The qualified application repairs were already published at `48d4a727`; this checkpoint records their actual PDF deployment and native download result. ZIP work is cancelled. This result does not mark unrelated T19a criteria or CI as complete. Work stops at the human's PDF-only boundary.
