# Ordinary APK account deletion — 2026-10-22

## Scope and authorization

The user requested the same confirmed deletion and loading popup in ordinary
Staging APK and regular DEV, without an additional OTP. The initial instruction
to preserve the current phone account was explicitly superseded: the user
confirmed that the currently open account may be deleted for the physical test.
Other owners and the separate DEV package remain outside that authorization.

## Repair

The ordinary build had no public DEV variant and therefore selected the older
deletion panel. The runtime admission helper now selects the existing completion
state machine for both ordinary and regular DEV builds on the exact Staging API.
The isolated privacy sandbox retains its own base. Production and mismatched
variants remain excluded. No implementation was commented out.

Both regular clients use `/account-deletion` for the deletion POST and capability
completion GET. Old `/dev-account-deletion` aliases and the canonical legacy
deletion endpoint remain available for older installed clients.

The two explicit Nginx routes use the already deployed immediate-deletion API on
127.0.0.1:3027 (`masarifi-backend:dev-immediate-delete-2764f849`). Its Staging
qualification, zero cooling period, and self-deletion setting were checked.
Session authentication, owned principal, durable operation ID, completion token,
server receipt, and local owner cleanup remain authoritative.

Server configuration backup: `/opt/masarifi/ordinary-account-deletion-20261022/`.
Nginx validation and reload passed. Before SHA256:
`31301e27c668b660fda091df199f1d84d544f0fb0a72062b0fc45dde17832727`.
After SHA256:
`e050e384de36b06221e27464021c1e5b02fcda87a6f5683dd646584b1ce6d0b5`.
Rollback: restore that folder's `nginx.before` to the Staging site configuration,
run `nginx -t`, and reload Nginx. Earlier financial sync routes are preserved.

## Verification so far

- Mobile deletion, recovery, and admission: 77 tests passed. Includes ordinary
  confirmation, visible progress, one POST, completed owner cleanup, session
  revocation, recovery, and owner fences.
- API security / immediate deletion / completion unit suites: 54 tests passed.
- Real disposable PostgreSQL immediate-deletion suite: 13 tests passed. Includes
  ownership isolation, durable completion, lost replies, and stale recovery.
- Mobile TypeScript check passed.
- Public new POST with JSON but without authentication returns 401. Completion
  without a valid capability returns 404. Unexposed namespace endpoints return
  404. No account was deleted by these route checks.

The first test run exposed test isolation problems: replacing `process.env`
detached imported runtime readers, and reusing a completed owner hid the second
panel. Restoring environment keys in place and using distinct fixture owners
resolved them without weakening the negative admission cases.

## APK and physical acceptance

The initial local builds ran out of Windows commit memory; the user closed
unnecessary applications and a smaller single-worker build succeeded in 8m18s.
The first APK's signature, package, non-debuggable status, ten bundled source
files, and installed hash were verified before the destructive test.

First APK SHA256:
`f5d934984da42cd4b2df8e76f35b99102490676a535e488478bb33545ad4df73`.
Its physical test was **not a pass**: confirmation and server deletion completed
without additional OTP, but local cleanup displayed a retry banner. The server
completed the single request in 4.523 seconds. The target's six transactions and
one account were erased; its profile is a deleted tombstone with contact and
name fields erased.

The physical failure exposed another DEV gate inside Android
`TrackingOwner.purgeOwner`. A real Robolectric regression reproduced the exact
`privacy_development_required` exception for the ordinary package (one failure,
four passing cases). The package allowlist now also admits `com.masarifi.mobile`;
unknown package rejection, owner digest validation, and foreign-owner isolation
remain intact. All five native regression cases passed after the correction.

The pending local cleanup will be resumed from the durable server-completed
checkpoint on the same phone. No new deletion POST or replacement account is
needed to retest this failure.

### Corrected APK and same-phone recovery

The corrected ordinary APK built successfully in 2m10s and was installed with
`adb install -r`, without clearing app data or touching the DEV package.

- APK: `D:/Masarifi-builds/Masarifi-Ratibi-2026-10-22-unified-deletion-v2-arm64.apk`
- SHA256: `a86e0f0ab30660d620037f995d65d952ef608d83ead711477d06d09696f1f2df`
- Package: `com.masarifi.mobile`; standalone arm64; non-debuggable; Staging.
- Signing certificate remains
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Actual installed APK hash matches the verified local artifact. Its JS bundle
  matches all ten checked source files; native release code was rebuilt.

On opening v2, the retained server-completed checkpoint finished local cleanup
automatically and the retry banner disappeared. Force-stop and an old protected
transaction deep link returned to the clean welcome screen, with no old
transaction or deletion error. This retests the original native failure on the
same phone. The final v2 did not submit another deletion or create a new account.
Confirmation and the original deletion POST were exercised on the first APK;
full confirmation/progress/receipt behavior also passes the mobile regression.

Final independent checks: Clerk user lookup returns 404. Staging has exactly one
completed, error-free deletion request for the target. Transactions, accounts,
categories, imports, and notices for that owner are all zero. The deleted profile
is an anonymized tombstone. The other owners' 19 transaction records and versions
have the same checksum before and after (`9af6e4d0c6f7910583d90d605d08dfa8`).

Evidence includes the confirmation, initial retry screen, corrected recovery UI,
cold restart XML and screenshot, APK identities, native red/green results, and
`sanitized-final-receipt.json`. The attempted first video was not finalized and
is not claimed as evidence. Direct extraction of private release-app files was
not performed; owner file/key/queue removal and isolation are covered by the
native and mobile regression tests, with durable recovery verified on device.

This is bounded Staging account-deletion acceptance. It does not complete the
broader application or client release acceptance. Changes remain in the working
tree on base HEAD `6d7619c03cf8c981232244c2d07d46a6fac3cb77`.

Evidence: `D:/Masarifi-preservation-2026-10-18/ordinary-account-deletion-20261022/`.
