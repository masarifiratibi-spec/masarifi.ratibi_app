# Production core: execution review packet

Prepared 5 November 2026. **Awaiting explicit execution approval; not deployed, not installed on the primary phone, and not production ready.** The existing delivery APK remains unchanged.

The current mobile application source is `2d8b5dfefedecd62ff8c48b01c12f89dfee43867`, on `codex/voice-promoted-operating-2026-10-13`. The backend/parser source remains `97e66588b2b516ae8c67e285f8439be591439dd6`; the mobile correction changes none of its image inputs. No branch push has occurred. The remote branch was read at `bc2c9c6489f6b31c72d719d5d31dd839d407723f` during preparation.

The [release package](../../ops/releases/2026-11-05-production-core/README.md) contains the exact selective database forward, pinned image/config/routing metadata, ACME bootstrap, [execution and recovery runbook](../../ops/releases/2026-11-05-production-core/deployment-runbook.md), [qualification summary](../../ops/releases/2026-11-05-production-core/qualification-summary.json) and [customer signing manifest](../../ops/releases/2026-11-05-production-core/signing-manifest.json). Private runtime values and signing keys remain outside Git.

## Corrections and evidence

The isolated current restore now has the missing owner-context layer in the retained Tracking finalizer chain. The repair preserves owner, lease, date, correlation and private-execution fences. Essential helper, malformed fee/reminder, salary-date, currency-ranking, committed-compensation and explicit production-consent compatibility is qualified through a five-file atomic forward, without stamping or changing the original 174-row migration history.

Independent review identified and closed three mobile protocol defects: an older pending enable could supersede a later offline disable; cold cleanup could not resume native purge safely; and an interrupted database purge could be blocked by an ordinary audio-enumeration read. The current code durably stages the newest consent before network/local preference writes, uses cleanup-only exact-generation native recovery, and persists a database-purge-ready phase only after native/audio removal. Previous prepared consent records remain readable, superseded evidence stays retained, and the compatible recovery APK includes the new durable record format.

| Proof | Result and limit |
| --- | --- |
| Current-clone owner context | 18 TAP cases passed after the production wrapper changed. |
| Semantic compatibility | 23 TAP cases passed. |
| Complete production Tracking DB flow | 40 TAP cases passed: actual parser/normalizer, API consent, real worker claims, prepare/finalize/commit/completion, accounting, retry and revocation. |
| Ledger and guarded compensation | 43 TAP cases passed, including real API-created refunds, exact refund cap and committed original UUID/version recovery with no duplicate effect. |
| Combined selective forward | Entire resulting catalog matched the qualified catalog inside rollback-only reconstruction; original logical data/history/membership fingerprints remained equal. |
| Final mobile source | 611 suites / 4,889 tests passed, natural runner exit0; 88 native tests passed; types and changed-file lint passed. |
| Review | No verified Critical or Important findings remained after focused re-review. |
| Server preparation | Pinned image runtime/config checks, Compose and staged Nginx syntax passed. These do not prove a deployed API or real production TLS. All 27 original serving containers retained their image/start identities. |
| Signing preparation | All three customer artifacts passed signature, Arabic/package identity, non-debuggable/backup policy, 16KB ZIP/ARM64 ELF and R8 checks. Their Hermes and embedded Expo config are identical. |

Qualification fixtures use synthetic namespaces and roll back. Logical equality is not physical database-byte equality. Failed fixture/preparation attempts and original receipts remain retained; no guard was weakened to make them pass. Unchanged completed API/source checks were reused. No Benchmark or performance campaign was resumed.

## Exact customer candidates

| Artifact | VersionCode / minimum API | APK SHA256 |
| --- | --- | --- |
| Existing-key lineage bridge | 100 / 33 | `0872d72fcb5a5d4b5463ad54dc9e453d6292e1844460aff07580b55fbe93ab5a` |
| Final customer APK | 101 / 24 | `29f087f9994016e21821629a9ca79802b83559886b18b1c936d65227427f0f19` |
| Higher-counter compatible recovery | 102 / 24 | `1d73c7e4f3bb13564288a5cdf431f2463aee4a16e94d22826de889bdcef555f2` |

All three contain mobile source `2d8b5df`; their common Hermes SHA256 is `439a241e34ac1f9ccb579236aa581a9a50ad028146f082834084201d9d7d0e41`. The existing Dev→Production lineage remains byte-identical and grants installed-data capability only. The bridge-only API33 permission overlay uses the previously qualified signing mechanism. API24–32 legacy upgrades remain separately unqualified.

The primary phone still has APK `a4378391e829540fb4c4e7f6345c2806b6c5da10e9437dd65e5e1eb2d391f89a`, version0.0.1/code2. The old delivery still has SHA256 `e9d2dbb77ab98447ed7287b41f6f22a305acacc6e968d74b0275ed3c282d10d3`. The separate QA application's completed signing test is supporting evidence only; it is not current customer-APK acceptance.

## Approval and remaining work

Execution approval covers the guarded forward, new scoped API/import consumer, exact DNS/TLS/routing changes, and the primary bridge→final update described in the runbook. Fresh OAuth's proposed independent target is one new secondary Android test user after session-policy/slot checks; existing users and the primary session stay preserved, and private Google input remains human-only.

After approval: refresh the bounded access and backup/preflight, execute the package once, prove real Redmi continuity and core/Tracking behavior, then update delivery/handoff and push this same branch to `ratibi`. No clear, uninstall, logout, identity bypass, key replacement, original pending-operation replay or Voice001 replay is authorized.

Production DNS/TLS, the actual final customer matrix, independent fresh Google OAuth, a distinct permitted voice test, approved legal operator/public notices and independent Storage/provider/key recovery limits remain open. Draft legal text is not approved publication. No readiness claim may rely on these automatic results alone.

The temporary SSH rule was removed after preparation: 33 rules returned to32 and all four UFW files matched their original bytes/mode/UID/GID. The Web Console and hPanel tabs were closed. No authenticated console continuity is assumed for the next stage.
