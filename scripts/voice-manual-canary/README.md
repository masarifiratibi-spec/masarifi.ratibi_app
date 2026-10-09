# Bounded Staging Voice/Manual canary controls

These operational acceptance templates are outside the application image and APK. The host, database and processing entry points require the fixed Staging project and scoped owner, accounts, categories and bounded operations. Offline test approval fixtures never authorize a hosted financial operation.

Run from the repository root:

```sh
node --test scripts/voice-manual-canary/canary-controls.test.cjs scripts/voice-manual-canary/canary-closure.test.cjs
node --check scripts/voice-manual-canary/canary-host.cjs
```

The templates retain the reviewed cb2 source/image and namespace constants so the original evidence and tests remain reproducible. For a new independently verified candidate, generate a separate deployment copy after its exact CI image digest is known. Only replace these five exact literals: the complete old SHA, complete old image digest, `voice-manual-cb2` scope namespace, `voice-manual-canary-cb2` directory name and `masarifi-voice-manual-deadline` service name. Use the verified full SHA/digest and a unique candidate SHA prefix for each of the three names. Preserve the original committed templates. Record the source commit, all substitutions, every rendered file hash and the archive hash; prove no other content changed. Review the rendered copy and re-run its offline tests before installation. Environment credential hashes remain independent pins and must match the actual Staging files without exposing their contents.

Install the verified rendered files root-owned and not writable by container UID 65532, at the exact rendered control path. Do not create `approval-control.json` until explicit human financial authorization is received. A nonposting cleanup rehearsal needs no financial approval file and never runs `arm`, `enable`, `process`, `finalize` or `media`. Cleanup must confirm OFF before restoration; any closure/pin failure must block restoration. API stop/restore rehearsal is allowed only when the handset is available and no human capture is active.

Keep the general worker stopped, preserve unrelated backlog/media and all application data. Posting OFF does not permit a valid Manual Save. See the scoped handoff and final candidate delivery receipt for current authorization and remaining acceptance.
