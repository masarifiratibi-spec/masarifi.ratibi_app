# Same-app Voice recovery

The recording-to-review hang is recovered on the existing customer107. One new actual Redmi recording reached visible manual review in one processing attempt, with owner-matching analysis context and no failure. The user confirmed speaking3.25SAR; transcript and proposal match. No financial entry was confirmed or created, and the original balance remains unchanged. No APK build/install, data clear, uninstall, logout or identity bypass occurred.

The cause was an intake/worker mismatch: the API flag MASARIFI_VOICE_ANALYSIS_ONLY was false, so manual contract2 captures lacked the context required by the existing analysis-only worker. The two earlier clips finalized but were never claimed before cancellation. The existing code already supports the correct explicit-review admission. The app retains manual review and automatic-posting=false.

The user explicitly approved the [one-key override and rollback plan](../../ops/releases/2026-11-05-voice-review-recovery/deployment-runbook.md). Core-api-only activation completed exit0 at16:10:52.913821UTC. At16:11:28.743099UTC, loopback/public live and ready all returned200. Only MASARIFI_VOICE_ANALYSIS_ONLY changed, false to true: every other actual environment value, the image and original API env file bytes remained identical. All30 other container IDs/images/startedAt, including all27 original services, were retained. The existing worker was not restarted; its poll interval is already500ms. No manual SQL/policy/grant, key, worker, DNS or TLS change was made.

The reviewed manifest/runbook remain byte-identical historical approval inputs. Release-local attributes preserve the exact reviewed manifest bytes in Git. [Execution](../../ops/releases/2026-11-05-voice-review-recovery/execution-result.json) and [acceptance](../../ops/releases/2026-11-05-voice-review-recovery/acceptance-result.json) are recorded separately. A future base-Compose-only deployment restores false: retain the approved override for the active review configuration.

The new5.976second/95,448byte recording has this backend timeline:

| Segment | Seconds |
| --- | ---: |
| Session created to upload recorded | 2.916138 |
| Upload recorded to processing finalized | 2.276741 |
| Finalized to transcript/proposal creation | 2.685206 |
| Session created to proposal creation | 7.878085 |
| Session created to proposed status update | 8.138700 |

These are backend timestamps, not Stop-to-first-visible result timing. The bounded USB observer ended before the user's later recording; subsequent XML/screenshots prove visible review without establishing its first-render time. The initial viewport was below the review. Two ordinary scrolls exposed it without Retry, Cancel, ReRecord, field editing or confirmation. No instant-response, end-to-end latency reduction percentage or production-readiness claim is made.

The new proposal remains unconfirmed. Read-only metadata proves zero new owner transactions since activation and zero confirmed/executed new proposals. Original Voice001 and both cancelled clips retain previous status, updated_at and attempt counts; none was replayed. Backend/image inputs are unchanged from97e66588. Seven previously passing Voice/environment suites were reused individually, plus fresh image/config and actual device proof. The historical whole run had two unrelated failures and is not represented as a whole green gate. No full suite, image/APK build or closed performance campaign was repeated.

The earlier connection-unavailable screen was captured before navigation. Public health200 and Android validated network were observed; one ordinary Retry restored the same Home. This establishes recovery from that occurrence without establishing the transient connection error's cause or a permanent connectivity fix.

Installed/delivered customer107 remains SHA25695098ae581392454e0a37fc03975aa9b983eed8c5b0e74c0ad46dabb59177a27. Private evidence under the existing production APK readiness directory includes task13-hosted-approval.json, task13-activation-verified.private.json, task13-validation-reuse.json, task13-new-voice-actual.private.json, task13-new-voice-timing-qualified.json, task13-voice-user-confirmation.json, the completed observer observations and task13-new-voice-review-visible.private.png. No credentials, owner/session values, voice content or screenshots are added to Git. Broader ProductionReady remains false.

Unsuppressed Gitleaks identifies the frozen manifest's API-env SHA256 as one generic-key false positive. Its exact reviewed manifest bytes and live file-checksum provenance were verified. There are zero credential or unreviewed findings; no scanner allowlist, baseline or inline suppression was added. The raw finding is retained in private evidence.
